import { foughtOneDay, withdrawn } from "./combat";
import type { Division } from "./divisions";
import {
  canRaise,
  marchDaysFor,
  paidForDivision,
  raisedAt,
  strengthOf,
  terrainDefenceOf,
} from "./divisions";
import type { NationEconomy } from "./economy";
import { NO_ECONOMY, shareTransferred } from "./economy";
import { enemyNeighbours, frontField, stepToward } from "./front";
import { valueAt } from "./grid";
import type { World } from "./index";
import { industryByNation, provincePeople } from "./industry";
import { itemAt } from "./lookup";
import { musteringAt } from "./muster";
import type { LandProvince, ProvinceGraph } from "./provinces";
import { graphOf, landProvinces, provinceTerrain } from "./provinces";
import { UNASSIGNED } from "./spread";
import type { Stance } from "./stance";
import { attackOddsFor, START_STANCE } from "./stance";
import type { Wars } from "./wars";

/** The armies of a world, the ground they hold, and what it all costs. */
export interface Armies {
  readonly divisions: readonly Division[];
  readonly economies: readonly NationEconomy[];
  /** Who holds each province, by province id. */
  readonly owners: Int32Array;
}

/** Stands in for a field no nation asked for. Every step off it stands still. */
const NO_FIELD = new Int32Array(0);

/** What one day of the depots produced and what it cost. */
interface Raised {
  readonly divisions: readonly Division[];
  readonly economies: readonly NationEconomy[];
}

/** One day of the depots: every nation that can afford a division raises one. */
const raisedOneDay = (
  world: World,
  owners: Int32Array,
  economies: readonly NationEconomy[]
): Raised => {
  const added: Division[] = [];
  const paid = world.nations.map((nation) => {
    const economy = itemAt(economies, nation.id, NO_ECONOMY);
    const province = musteringAt(world, owners, nation);
    if (province === UNASSIGNED || !canRaise(economy)) {
      return economy;
    }
    added.push(raisedAt(nation.id, province));
    return paidForDivision(economy);
  });
  return { divisions: added, economies: paid };
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

/** What the armies are ordered by: who is at war, and how boldly each attacks. */
export interface Command {
  readonly wars: Wars;
  /** Each nation's stance, by nation id. */
  readonly stances: readonly Stance[];
}

/** A day of fighting everywhere, and the provinces nobody marches out of. */
interface Fighting {
  readonly armies: Armies;
  readonly engaged: ReadonlySet<number>;
}

/** The world after every province that holds divisions has had its day. */
const foughtEverywhere = (
  world: World,
  graph: ProvinceGraph,
  before: Armies,
  wars: Wars
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
    const battle = foughtOneDay(before.owners, wars, province, present);
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
  const after = occupied(world, { ...before, divisions: survivors }, taken);
  return {
    armies: {
      ...after,
      divisions: [
        ...after.divisions,
        ...broken.flatMap((division) =>
          withdrawn(graph, after.owners, division)
        ),
      ],
    },
    engaged,
  };
};

/** Where a division stands after a day of walking toward `target`. */
const walkedToward = (
  world: World,
  division: Division,
  target: number
): Division => {
  if (target === division.province) {
    return { ...division, marched: 0, movingTo: division.province };
  }
  if (target !== division.movingTo) {
    return { ...division, marched: 1, movingTo: target };
  }
  if (
    division.marched + 1 <
    marchDaysFor(provinceTerrain(world.provinces, target))
  ) {
    return { ...division, marched: division.marched + 1 };
  }
  return { ...division, marched: 0, province: target };
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
  readonly wars: Wars;
  /** Each nation's stance, by nation id. */
  readonly stances: readonly Stance[];
  readonly garrisons: ReadonlyMap<number, number>;
}

/**
 * The enemy province a stack on the line attacks today, or its own where it
 * holds.
 *
 * The first division of the stack stays behind as the garrison, so a stack of
 * one never attacks and the province it stands in is never left empty by it.
 * The rest attack when they outweigh the weakest enemy neighbour by the odds
 * the nation's stance asks for.
 */
const attackTarget = (
  line: Line,
  province: number,
  stack: readonly Division[]
): number => {
  const { nation } = itemAt(stack, 0, raisedAt(UNASSIGNED, province));
  const attacking = strengthOf(stack.slice(1));
  let target = province;
  let weakest = Number.POSITIVE_INFINITY;
  for (const beside of enemyNeighbours(
    line.graph,
    line.owners,
    line.wars,
    nation,
    province
  )) {
    const defended =
      (line.garrisons.get(beside) ?? 0) *
      terrainDefenceOf(provinceTerrain(line.world.provinces, beside));
    if (defended >= weakest) {
      continue;
    }
    weakest = defended;
    target = beside;
  }
  const odds = attackOddsFor(itemAt(line.stances, nation, START_STANCE));
  if (attacking === 0 || attacking < odds * weakest) {
    return province;
  }
  return target;
};

/** One nation's divisions standing in one province, out of contact. */
const stacksOf = (
  divisions: readonly Division[],
  engaged: ReadonlySet<number>,
  nations: number
): ReadonlyMap<number, readonly Division[]> => {
  const stacks = new Map<number, Division[]>();
  for (const division of divisions) {
    if (engaged.has(division.province)) {
      continue;
    }
    const key = division.province * nations + division.nation;
    const stack = stacks.get(key) ?? [];
    stack.push(division);
    stacks.set(key, stack);
  }
  return stacks;
};

/** Where every division in one stack is heading today. */
const orderedStack = (
  line: Line,
  field: Int32Array,
  province: number,
  stack: readonly Division[]
): readonly Division[] => {
  if (valueAt(field, province) !== 0) {
    const toward = stepToward(line.graph, field, province);
    return stack.map((division) => walkedToward(line.world, division, toward));
  }
  const target = attackTarget(line, province, stack);
  return stack.map((division, place) => {
    if (place === 0) {
      return walkedToward(line.world, division, province);
    }
    return walkedToward(line.world, division, target);
  });
};

/**
 * The world after every division out of contact has had its orders: behind the
 * line it walks toward it, and on the line its stack holds or attacks.
 */
const marchedEverywhere = (
  world: World,
  graph: ProvinceGraph,
  armies: Armies,
  command: Command,
  engaged: ReadonlySet<number>
): Armies => {
  const { wars } = command;
  const line: Line = {
    garrisons: garrisons(armies.owners, armies.divisions),
    graph,
    owners: armies.owners,
    stances: command.stances,
    wars,
    world,
  };
  const fields = world.nations.map((nation) =>
    frontField(world.provinces, graph, armies.owners, wars, nation.id)
  );
  const moved = armies.divisions.filter((division) =>
    engaged.has(division.province)
  );
  for (const stack of stacksOf(
    armies.divisions,
    engaged,
    world.nations.length
  ).values()) {
    const first = itemAt(stack, 0, raisedAt(UNASSIGNED, UNASSIGNED));
    moved.push(
      ...orderedStack(
        line,
        itemAt(fields, first.nation, NO_FIELD),
        first.province,
        stack
      )
    );
  }
  return { ...armies, divisions: moved };
};

/**
 * One day of every army in the world.
 *
 * The depots come first, then the fighting, then the marching, so a division
 * raised today takes its first day of marching the same day, and a province
 * taken today already belongs to the attacker when the marchers read their
 * fronts.
 */
export const armiesAfterOneDay = (
  world: World,
  command: Command,
  armies: Armies
): Armies => {
  const graph = graphOf(world.provinces);
  const raised = raisedOneDay(world, armies.owners, armies.economies);
  const fought = foughtEverywhere(
    world,
    graph,
    {
      divisions: [...armies.divisions, ...raised.divisions],
      economies: raised.economies,
      owners: armies.owners,
    },
    command.wars
  );
  return marchedEverywhere(
    world,
    graph,
    fought.armies,
    command,
    fought.engaged
  );
};
