import { OPENING_ARMOURY } from "../armoury";
import type { NationEconomy } from "../economy/economy";
import { shareTransferred } from "../economy/economy";
import { industryByNation, provincePeople } from "../economy/industry";
import type { World } from "../geography/world";
import { valueAt } from "../grid";
import { itemAt } from "../lookup";
import type { LandProvince, ProvinceGraph } from "../provinces";
import { graphOf, landProvinces, provinceTerrain } from "../provinces";
import { UNASSIGNED } from "../spread";
import type { Wars } from "../wars";
import { atWar } from "../wars";
import type { AirCover } from "./air-cover";
import { coverOver } from "./air-cover";
import type { BattlePlan } from "./battle-plan";
import { battlePlansOf, NO_PLAN, onItsFront } from "./battle-plan";
import type { Theatre } from "./combat";
import { foughtOneDay, withdrawn } from "./combat";
import type { Division } from "./divisions";
import {
  supplyUseOf,
  dailyLevyBeside,
  marchDaysFor,
  raisedAt,
  regroupedEnough,
  strengthOf,
  terrainDefenceOf,
  worn,
} from "./divisions";
import { deploymentOf, enemyNeighbours, frontField, stepToward } from "./front";
import type { Deployment } from "./front";
import { combatWidth } from "./frontage";
import { musteredBy } from "./muster";
import type { Activity } from "./preparation";
import { prepared } from "./preparation";
import { paceUnder } from "./skies";
import type { Stance } from "./stance";
import { attackOddsFor, START_STANCE } from "./stance";
import type { Post, SupplyNetwork } from "./supply";
import { postOf, stackKey } from "./supply";

/** The armies of a world, the ground they hold, and what it all costs. */
export interface Armies {
  readonly divisions: readonly Division[];
  readonly economies: readonly NationEconomy[];
  /** Who holds each province, by province id. */
  readonly owners: Int32Array;
}

/** Stands in for a field no nation asked for. Every step off it stands still. */
const NO_FIELD = new Int32Array(0);

const NO_FIELDS: Fields = {
  line: NO_FIELD,
  open: { field: NO_FIELD, room: "full" },
  plan: NO_PLAN,
};

/** The divisions standing in each province, by province id. */
const byProvince = (
  divisions: readonly Division[]
): ReadonlyMap<number, readonly Division[]> => {
  const standing = new Map<number, Division[]>();
  for (const division of divisions) {
    const held = standing.get(division.province) ?? [];
    held.push(division);
    standing.set(division.province, held);
  }
  return standing;
};

/** What one province's day did to the rest of the world. */
interface Taken {
  readonly province: LandProvince;
  readonly from: number;
  readonly to: number;
}

/**
 * The world after every province taken today has changed hands.
 *
 * `owners` is copied here and nowhere else, so its identity changes on a day
 * ground changed hands and on no other. Each capture's share is counted
 * against what the loser still held after the captures before it, so a nation
 * that loses the last of its ground loses the last of its people with it.
 */
const occupied = (
  world: World,
  armies: Armies,
  taken: readonly Taken[]
): Armies => {
  if (taken.length === 0) {
    return armies;
  }
  const industry = industryByNation(
    world.provinces,
    armies.owners,
    world.nations.length
  );
  const remaining = Float64Array.from(industry, (held) => held.population);
  const owners = Int32Array.from(armies.owners);
  let { economies } = armies;
  for (const capture of taken) {
    owners[capture.province.id] = capture.to;
    const people = provincePeople(capture.province);
    const held = valueAt(remaining, capture.from);
    economies = shareTransferred(
      economies,
      capture.from,
      capture.to,
      people / Math.max(1, held)
    );
    remaining[capture.from] = held - people;
  }
  return { ...armies, economies, owners };
};

/**
 * What the armies are ordered by: everything a battle reads but who holds
 * what, which the armies carry, and how boldly each nation attacks.
 */
export interface Command extends Omit<Theatre, "owners"> {
  /** Each nation's stance, by nation id. */
  readonly stances: readonly Stance[];
}

/**
 * A day of fighting everywhere, the divisions that broke in it, and the
 * provinces nobody marches out of.
 */
interface Fighting {
  readonly armies: Armies;
  /** The divisions that broke today, still standing where they broke. */
  readonly broken: readonly Division[];
  readonly engaged: ReadonlySet<number>;
}

/** The world after every province that holds divisions has had its day. */
const foughtEverywhere = (
  world: World,
  before: Armies,
  command: Command
): Fighting => {
  const standing = byProvince(before.divisions);
  const survivors: Division[] = [];
  const broken: Division[] = [];
  const taken: Taken[] = [];
  const engaged = new Set<number>();
  for (const province of landProvinces(world.provinces)) {
    const present = standing.get(province.id) ?? [];
    if (present.length === 0) {
      continue;
    }
    const battle = foughtOneDay(
      {
        air: command.air,
        armouries: command.armouries,
        insight: command.insight,
        modifiers: command.modifiers,
        owners: before.owners,
        supply: command.supply,
        wars: command.wars,
      },
      province,
      present
    );
    survivors.push(...battle.standing);
    broken.push(...battle.broken);
    if (battle.fought) {
      engaged.add(province.id);
    }
    if (battle.captured === UNASSIGNED) {
      continue;
    }
    taken.push({
      from: valueAt(before.owners, province.id),
      province,
      to: battle.captured,
    });
  }
  return {
    armies: occupied(world, { ...before, divisions: survivors }, taken),
    broken,
    engaged,
  };
};

/** The first division of a stack, which names its nation and its province. */
const firstOf = (stack: readonly Division[]): Division =>
  itemAt(stack, 0, raisedAt(UNASSIGNED, UNASSIGNED, "infantry"));

/**
 * Where a division stands after a day of walking toward `target`, slowed by
 * the air superiority its enemies hold over the ground it walks from.
 */
const walkedToward = (
  line: Line,
  division: Division,
  target: number
): Division => {
  if (target === division.province) {
    return { ...division, marched: 0, movingTo: division.province };
  }
  const pace = paceUnder(
    coverOver(line.air, "enemy", division.nation, division.province)
  );
  if (target !== division.movingTo) {
    return { ...division, marched: pace, movingTo: target };
  }
  if (
    division.marched + pace <
    marchDaysFor(division.kind, provinceTerrain(line.world.provinces, target))
  ) {
    return { ...division, marched: division.marched + pace };
  }
  return { ...division, arrival: "march", marched: 0, province: target };
};

/** The strength each province's holder has standing in it, by province id. */
const garrisons = (
  owners: Int32Array,
  divisions: readonly Division[]
): ReadonlyMap<number, number> => {
  const held = new Map<number, number>();
  for (const division of divisions) {
    if (valueAt(owners, division.province) !== division.nation) {
      continue;
    }
    held.set(
      division.province,
      (held.get(division.province) ?? 0) + division.strength
    );
  }
  return held;
};

/** What one day on the line can see: the ground, the wars, and who holds what. */
interface Line {
  readonly world: World;
  readonly graph: ProvinceGraph;
  readonly owners: Int32Array;
  /** Who held each province when the day began, before its battles changed hands. */
  readonly heldAtDawn: Int32Array;
  readonly wars: Wars;
  /** Each nation's stance, by nation id. */
  readonly stances: readonly Stance[];
  readonly garrisons: ReadonlyMap<number, number>;
  readonly supply: SupplyNetwork;
  readonly air: AirCover;
}

/**
 * What `nation` posts to `province` on its front line: as many divisions as a
 * battle on that ground holds, and no more supply than it keeps there.
 */
interface Posting {
  /** The most divisions it posts there. */
  readonly width: number;
  /** The supply it keeps there, counted in infantry divisions. */
  readonly supply: number;
}

const postingAt = (line: Line, nation: number, province: number): Posting => ({
  supply: postOf(line.supply, nation, province).capacity,
  width: combatWidth(provinceTerrain(line.world.provinces, province), 1),
});

/**
 * Whether a province posted `posting`, with `post` standing there, has room
 * for another division: an empty one always, to hold it, and otherwise one
 * under its width with the supply for another infantry division left.
 */
const hasRoom = (posting: Posting, post: Post): boolean =>
  post.stationed === 0 ||
  (post.stationed < posting.width &&
    post.demand + supplyUseOf("infantry") <= posting.supply);

/**
 * The divisions of a stack past its first, the garrison, that go into an
 * attack on `target`: no more than a battle on that ground holds.
 */
const attackGroupOf = (
  line: Line,
  stack: readonly Division[],
  target: number
): readonly Division[] =>
  stack.slice(
    1,
    1 + combatWidth(provinceTerrain(line.world.provinces, target), 1)
  );

/** An enemy province a stack on the line could attack, and what holds it. */
interface Prospect {
  readonly province: number;
  /** The holder's strength standing in it, counted with the ground. */
  readonly defended: number;
  /** How far it is from the plan's nearest objective over enemy ground, `UNASSIGNED` where no such walk reaches one. */
  readonly approach: number;
}

/** Whether `one` is a better attack for the plan than `other`: nearer an objective, then weaker. */
const plannedBefore = (one: Prospect, other: Prospect): boolean =>
  one.approach < other.approach ||
  (one.approach === other.approach && one.defended < other.defended);

/**
 * The enemy neighbour the battle plan sends the stack at, which is the one
 * nearest an objective, the weakest of those on a tie, or none where no
 * neighbour reaches an objective over enemy ground.
 */
const plannedOf = (prospects: readonly Prospect[]): readonly Prospect[] => {
  let planned: readonly Prospect[] = [];
  for (const prospect of prospects) {
    if (prospect.approach === UNASSIGNED) {
      continue;
    }
    if (planned.every((held) => plannedBefore(prospect, held))) {
      planned = [prospect];
    }
  }
  return planned;
};

/** The enemy neighbour that is weakest held, the first of them on a tie. */
const weakestOf = (prospects: readonly Prospect[]): readonly Prospect[] => {
  let weakest: readonly Prospect[] = [];
  for (const prospect of prospects) {
    if (weakest.every((held) => prospect.defended < held.defended)) {
      weakest = [prospect];
    }
  }
  return weakest;
};

/**
 * The enemy province a stack on the line attacks today, or its own where it
 * holds.
 *
 * The first division of the stack stays behind as the garrison, so a stack of
 * one never attacks and the province it stands in is never left empty by it.
 * The rest attack where the battle plan's offensive sends them when they
 * outweigh the defence there by the odds the nation's stance asks for, and
 * otherwise the weakest enemy neighbour when they outweigh that one.
 */
const attackTarget = (
  line: Line,
  plan: BattlePlan,
  province: number,
  stack: readonly Division[],
  onTheLine: boolean
): number => {
  const { nation } = firstOf(stack);
  if (!onTheLine) {
    return province;
  }
  const prospects = enemyNeighbours(
    line.graph,
    line.owners,
    line.wars,
    nation,
    province
  ).map((beside): Prospect => ({
    approach: valueAt(plan.approach, beside),
    defended:
      (line.garrisons.get(beside) ?? 0) *
      terrainDefenceOf(provinceTerrain(line.world.provinces, beside)),
    province: beside,
  }));
  const odds = attackOddsFor(itemAt(line.stances, nation, START_STANCE));
  const sent = [...plannedOf(prospects), ...weakestOf(prospects)].find(
    (prospect) => {
      const attacking = strengthOf(
        attackGroupOf(line, stack, prospect.province)
      );
      return attacking > 0 && attacking >= odds * prospect.defended;
    }
  );
  return sent?.province ?? province;
};

/** The divisions grouped by the nation and the province they stand in. */
const stacksOf = (
  divisions: readonly Division[],
  nations: number
): ReadonlyMap<number, readonly Division[]> => {
  const stacks = new Map<number, Division[]>();
  for (const division of divisions) {
    const key = stackKey(nations, division.nation, division.province);
    const stack = stacks.get(key) ?? [];
    stack.push(division);
    stacks.set(key, stack);
  }
  return stacks;
};

/** The two fields a nation's divisions march by. */
interface Fields {
  /** How far each province is from the front line, zero on it. */
  readonly line: Int32Array;
  /** Where the nation has room for another division. */
  readonly open: Deployment;
  readonly plan: BattlePlan;
}

/**
 * The divisions of a stack that stay: from the first, each one the province's
 * posting still has room for once it counts in the ones kept before it, or
 * the whole stack where the way on leads nowhere but here.
 */
const heldBack = (
  stack: readonly Division[],
  posting: Posting,
  nowhereToSend: boolean
): readonly Division[] => {
  if (nowhereToSend) {
    return stack;
  }
  const kept: Division[] = [];
  let used = 0;
  for (const division of stack) {
    const use = supplyUseOf(division.kind);
    if (
      kept.length > 0 &&
      (kept.length >= posting.width || used + use > posting.supply)
    ) {
      break;
    }
    kept.push(division);
    used += use;
  }
  return kept;
};

/** One division before its orders for the day and after them. */
interface Order {
  readonly before: Division;
  readonly after: Division;
}

/**
 * Where every division in one stack is heading today. Behind the line, while
 * the line has room, it walks toward the nearest front province that does.
 * Otherwise, and on the line, it keeps the divisions the province is posted,
 * sends the rest on to where there is room, and on the line attacks with no
 * more than the battle it starts holds.
 */
const orderedStack = (
  line: Line,
  fields: Fields,
  province: number,
  stack: readonly Division[]
): readonly Order[] => {
  const { open } = fields;
  const onward = stepToward(line.graph, open.field, province);
  const onTheLine = valueAt(fields.line, province) === 0;
  const sent = (division: Division, target: number): Order => ({
    after: walkedToward(line, division, target),
    before: division,
  });
  if (!onTheLine && open.room === "line" && onward !== province) {
    return stack.map((division) => sent(division, onward));
  }
  const { nation } = firstOf(stack);
  const staying = heldBack(
    stack,
    postingAt(line, nation, province),
    onward === province
  );
  const target = attackTarget(line, fields.plan, province, staying, onTheLine);
  const attacking = new Set(attackGroupOf(line, staying, target));
  const kept = new Set(staying);
  return stack.map((division) => {
    if (!kept.has(division)) {
      return sent(division, onward);
    }
    if (attacking.has(division)) {
      return sent(division, target);
    }
    return sent(division, province);
  });
};

/**
 * What a division in a battle did today: attacked ground the enemy held at
 * dawn, which it may have taken since, or held its own.
 */
const inBattle = (line: Line, division: Division): Activity => {
  if (
    atWar(
      line.wars,
      division.nation,
      valueAt(line.heldAtDawn, division.province)
    )
  ) {
    return "attacking";
  }
  return "defending";
};

/**
 * What a division out of battle did today, read off its orders: it marched
 * where it changed province or set out for another, and otherwise held, on
 * its front where it stands on it under the line's orders.
 */
const outOfBattle = (plan: BattlePlan, { after, before }: Order): Activity => {
  if (after.province !== before.province || after.movingTo !== after.province) {
    return "marching";
  }
  if (onItsFront(plan, after)) {
    return "holding-front";
  }
  return "holding";
};

/**
 * Where a regrouping division is today: walking toward its nation's fallback
 * line, or back under the line's orders once it has recovered enough, which it
 * takes up tomorrow from where it stands.
 */
const regrouped = (
  line: Line,
  plan: BattlePlan,
  division: Division
): Division => {
  if (regroupedEnough(division)) {
    return {
      ...division,
      marched: 0,
      movingTo: division.province,
      task: "line",
    };
  }
  return walkedToward(
    line,
    division,
    stepToward(line.graph, plan.retreat, division.province)
  );
};

/** What the day's fighting leaves the marchers to read. */
interface Aftermath {
  /** The provinces a battle was fought in today, which nobody marches out of. */
  readonly engaged: ReadonlySet<number>;
  /** Who held each province before today's battles. */
  readonly heldAtDawn: Int32Array;
  /** Every nation's battle plan, drawn after today's battles, by nation id. */
  readonly plans: readonly BattlePlan[];
}

/**
 * The world after every division out of contact has had its orders: a broken
 * one falls back to regroup, behind the line one walks toward it, and on the
 * line its stack holds or attacks.
 */
const marchedEverywhere = (
  world: World,
  graph: ProvinceGraph,
  armies: Armies,
  command: Command,
  day: Aftermath
): Armies => {
  const { wars } = command;
  const { engaged, plans } = day;
  const line: Line = {
    air: command.air,
    garrisons: garrisons(armies.owners, armies.divisions),
    graph,
    heldAtDawn: day.heldAtDawn,
    owners: armies.owners,
    stances: command.stances,
    supply: command.supply,
    wars,
    world,
  };
  const fields = world.nations.map((nation): Fields => ({
    line: frontField(world.provinces, graph, armies.owners, wars, nation.id),
    open: deploymentOf(
      world.provinces,
      graph,
      armies.owners,
      wars,
      nation.id,
      (province) =>
        hasRoom(
          postingAt(line, nation.id, province),
          postOf(command.supply, nation.id, province)
        )
    ),
    plan: itemAt(plans, nation.id, NO_PLAN),
  }));
  const moved = armies.divisions.flatMap((division) => {
    if (!engaged.has(division.province)) {
      return [];
    }
    return [prepared(division, inBattle(line, division))];
  });
  const free = armies.divisions.filter(
    (division) => !engaged.has(division.province)
  );
  const preparedAfter = (orders: readonly Order[]): void => {
    for (const order of orders) {
      moved.push(
        prepared(
          order.after,
          outOfBattle(itemAt(plans, order.after.nation, NO_PLAN), order)
        )
      );
    }
  };
  preparedAfter(
    free.flatMap((division): readonly Order[] => {
      if (division.task !== "regroup") {
        return [];
      }
      return [
        {
          after: regrouped(
            line,
            itemAt(plans, division.nation, NO_PLAN),
            division
          ),
          before: division,
        },
      ];
    })
  );
  preparedAfter(
    free.flatMap((division): readonly Order[] => {
      if (division.task !== "garrison") {
        return [];
      }
      return [{ after: division, before: division }];
    })
  );
  for (const stack of stacksOf(
    free.filter((division) => division.task === "line"),
    world.nations.length
  ).values()) {
    const first = firstOf(stack);
    preparedAfter(
      orderedStack(
        line,
        itemAt(fields, first.nation, NO_FIELDS),
        first.province,
        stack
      )
    );
  }
  return { ...armies, divisions: moved };
};

/**
 * The divisions with a day of whatever their supply falls short by worn off
 * them, and every one worn down to no men at all gone.
 */
const attrited = (
  divisions: readonly Division[],
  supply: SupplyNetwork
): readonly Division[] =>
  divisions.flatMap((division) => {
    const left = worn(
      division,
      postOf(supply, division.nation, division.province).fill
    );
    if (left.strength <= 0) {
      return [];
    }
    return [left];
  });

/**
 * One day of every army in the world.
 *
 * The supply wears on every division first, then the depots, then the
 * fighting, then the marching, so a division
 * raised today takes its first day of marching the same day, and a province
 * taken today already belongs to the attacker when the battle plans are drawn.
 * Every nation's plan is drawn once the day's ground has changed hands, so a
 * division that broke today falls back toward the same fallback line the
 * marchers read.
 */
export const armiesAfterOneDay = (
  world: World,
  command: Command,
  armies: Armies
): Armies => {
  const graph = graphOf(world.provinces);
  const raised = musteredBy(
    world,
    armies.owners,
    armies.economies,
    (nation) => itemAt(command.armouries, nation, OPENING_ARMOURY).kinds,
    dailyLevyBeside(armies.divisions)
  );
  const fought = foughtEverywhere(
    world,
    {
      divisions: [
        ...attrited(armies.divisions, command.supply),
        ...raised.divisions,
      ],
      economies: raised.economies,
      owners: armies.owners,
    },
    command
  );
  const { owners } = fought.armies;
  const plans = battlePlansOf(
    world.provinces,
    world.nations,
    graph,
    owners,
    command.wars
  );
  return marchedEverywhere(
    world,
    graph,
    {
      ...fought.armies,
      divisions: [
        ...fought.armies.divisions,
        ...fought.broken.flatMap((division) =>
          withdrawn(
            graph,
            owners,
            itemAt(plans, division.nation, NO_PLAN).retreat,
            division
          )
        ),
      ],
    },
    command,
    { engaged: fought.engaged, heldAtDawn: armies.owners, plans }
  );
};
