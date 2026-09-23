import type { AirCover } from "./air-cover";
import { coverOver } from "./air-cover";
import type { Armoury } from "./armoury";
import { OPENING_ARMOURY } from "./armoury";
import type { Backing, Division } from "./divisions";
import {
  attackOf,
  defenceOf,
  rested,
  strengthOf,
  terrainDefenceOf,
} from "./divisions";
import { combatWidth } from "./frontage";
import { valueAt } from "./grid";
import type { Insight } from "./insight";
import { edgeAgainst } from "./insight";
import { itemAt } from "./lookup";
import type { Modifiers } from "./modifiers";
import { NO_MODIFIERS } from "./modifiers";
import type { LandProvince, ProvinceGraph } from "./provinces";
import { isLand, neighboursOf } from "./provinces";
import { combatKeptUnder } from "./skies";
import { UNASSIGNED } from "./spread";
import type { SupplyNetwork } from "./supply";
import { postOf } from "./supply";
import type { Wars } from "./wars";
import { atWar } from "./wars";

/**
 * How much cohesion a point of the enemy's daily worth takes off one division,
 * shared across however many divisions are taking the fire.
 */
const ORGANISATION_PER_POWER = 0.5;

/** The men a division loses for each point of cohesion knocked off it. */
const MEN_PER_ORGANISATION = 60;

/** What a day in one province leaves behind. */
export interface Battle {
  /** The divisions still standing in the province after the day. */
  readonly standing: readonly Division[];
  /**
   * The divisions that broke and have to fall back, which the caller moves
   * once every province's day is known, so none falls back onto ground that
   * changed hands the same day.
   */
  readonly broken: readonly Division[];
  /** The nation that took the province, or `UNASSIGNED` where it did not move. */
  readonly captured: number;
  /** Whether anyone in the province was under fire, so nobody there marches. */
  readonly fought: boolean;
}

/** The nation whose divisions in the province weigh the most. */
const strongestOf = (divisions: readonly Division[]): number => {
  let winner = UNASSIGNED;
  let heaviest = 0;
  for (const nation of new Set(divisions.map((division) => division.nation))) {
    const weight = strengthOf(
      divisions.filter((division) => division.nation === nation)
    );
    if (weight <= heaviest) {
      continue;
    }
    heaviest = weight;
    winner = nation;
  }
  return winner;
};

/** The division with a day of the enemy's fire taken off it. */
const struck = (division: Division, organisation: number): Division => ({
  ...division,
  organisation: division.organisation - organisation,
  strength: Math.max(
    0,
    division.strength - organisation * MEN_PER_ORGANISATION
  ),
});

const canFight = (division: Division): boolean => division.organisation > 0;

/** A distance on a field, with ground the field never reached ranked past all of it. */
const reachOf = (distance: number): number => {
  if (distance === UNASSIGNED) {
    return Number.MAX_SAFE_INTEGER;
  }
  return distance;
};

/**
 * Where a broken division falls back to among `ownGround`, the provinces its
 * nation holds beside it: the one nearest its fallback line, the first of
 * them where none reaches the line, or `UNASSIGNED` where there are none.
 */
const fallbackStep = (
  retreat: Int32Array,
  ownGround: readonly number[]
): number => {
  let best = UNASSIGNED;
  let nearest = Number.POSITIVE_INFINITY;
  for (const beside of ownGround) {
    const reach = reachOf(valueAt(retreat, beside));
    if (reach >= nearest) {
      continue;
    }
    nearest = reach;
    best = beside;
  }
  return best;
};

/**
 * The broken division standing on the ground behind it that leads toward its
 * nation's fallback line, regrouping, or nothing where no ground of its
 * nation's touches it.
 *
 * A division with nowhere to fall back to is lost, which is how a pocket ends.
 */
export const withdrawn = (
  graph: ProvinceGraph,
  owners: Int32Array,
  retreat: Int32Array,
  division: Division
): readonly Division[] => {
  const beside = fallbackStep(
    retreat,
    neighboursOf(graph, division.province).filter(
      (next) => isLand(graph, next) && valueAt(owners, next) === division.nation
    )
  );
  if (beside === UNASSIGNED) {
    return [];
  }
  return [
    {
      ...division,
      arrival: "march",
      entrenchment: 0,
      marched: 0,
      movingTo: beside,
      organisation: 0,
      planning: 0,
      province: beside,
      task: "regroup",
    },
  ];
};

/**
 * What a battle reads beyond its own province: who holds what, who fights
 * whom, and how well each nation's divisions fight.
 */
export interface Theatre {
  readonly owners: Int32Array;
  readonly wars: Wars;
  /** Each nation's modifiers, by nation id. */
  readonly modifiers: readonly Modifiers[];
  /** What each nation's supply can do today. */
  readonly supply: SupplyNetwork;
  /** What the planes overhead do to the divisions below them today. */
  readonly air: AirCover;
  /** What each nation brings to a battle from what it knows of the enemy. */
  readonly insight: Insight;
  /** What each nation's research arms it with, by nation id. */
  readonly armouries: readonly Armoury[];
}

/**
 * Hearts of Iron IV's close air support: a battle takes no more planes than
 * three times the combat width the enemy fights with, and each plane strikes
 * a division for its ground attack three times a day, the 0.035 of it that
 * comes off the division's organisation. A division here fills one place of
 * a battle's width, and this game counts it as ten of Hearts of Iron IV's,
 * since its plains take eight divisions where Hearts of Iron IV's take
 * ninety width.
 */
const SUPPORT_PER_WIDTH = 3;
const WIDTH_PER_DIVISION = 10;
const STRIKES_PER_DAY = 3;
const ORGANISATION_PER_GROUND_ATTACK = 0.035;

/**
 * The organisation the close air support of `nations` takes off each division
 * of an enemy `line` in `province` today, the planes that join carrying their
 * share of the ground attack all of them flew in with.
 */
const supportStrikeOn = (
  air: AirCover,
  province: number,
  nations: ReadonlySet<number>,
  line: readonly Division[]
): number => {
  let planes = 0;
  let attack = 0;
  for (const nation of nations) {
    planes += coverOver(air, "support", nation, province);
    attack += coverOver(air, "supportAttack", nation, province);
  }
  const joined = Math.min(
    planes,
    SUPPORT_PER_WIDTH * WIDTH_PER_DIVISION * line.length
  );
  return (
    (((attack * joined) / Math.max(planes, Number.MIN_VALUE)) *
      ORGANISATION_PER_GROUND_ATTACK *
      STRIKES_PER_DAY) /
    line.length
  );
};

/**
 * How many neighbouring provinces the province is attacked from: every one held
 * by a nation at war with its holder.
 */
const attackDirections = (
  theatre: Theatre,
  province: LandProvince,
  holder: number
): number =>
  province.neighbours.filter((beside) =>
    atWar(theatre.wars, holder, valueAt(theatre.owners, beside))
  ).length;

/**
 * The divisions of one side that fight today: the `width` with the most
 * cohesion left, so a reserve steps in for one that is close to breaking.
 */
const lineOf = (
  side: readonly Division[],
  width: number
): readonly Division[] =>
  side
    .toSorted((one, other) => other.organisation - one.organisation)
    .slice(0, width);

/**
 * One day of whatever is happening in a province that divisions stand in.
 *
 * The nation holding the ground defends it, and every nation at war with that
 * one attacks together, which is as close to a coalition as a world with no
 * diplomacy gets. A division that has already broken takes no part: it is
 * neither counted in the defence nor struck, and it leaves the province. Each
 * side fights with no more divisions than the battle's width holds, and the
 * rest wait in reserve, neither firing nor struck. An attacker fights with
 * what its nation knows of the holder, and a defender with what the holder
 * knows of the attacker with the most men in the province.
 */
export const foughtOneDay = (
  theatre: Theatre,
  province: LandProvince,
  present: readonly Division[]
): Battle => {
  const { owners, wars } = theatre;
  const holder = valueAt(owners, province.id);
  const fighting = present.filter(canFight);
  const broken = present.filter((division) => !canFight(division));
  const attacking = (division: Division) =>
    atWar(wars, holder, division.nation);
  const attackers = fighting.filter(attacking);
  const leading = strongestOf(attackers);
  const backingOf = (division: Division): Backing => ({
    air: combatKeptUnder(
      coverOver(theatre.air, "enemy", division.nation, division.province)
    ),
    equipment: itemAt(theatre.armouries, division.nation, OPENING_ARMOURY)
      .infantry,
    fill: postOf(theatre.supply, division.nation, division.province).fill,
    insight: edgeAgainst(
      theatre.insight,
      division.nation,
      itemAt([holder, leading], Number(division.nation === holder), holder),
      province.id
    ),
    modifiers: itemAt(theatre.modifiers, division.nation, NO_MODIFIERS),
  });
  if (attackers.length === 0) {
    return {
      broken: [],
      captured: UNASSIGNED,
      fought: false,
      standing: present.map((division) =>
        rested(division, backingOf(division))
      ),
    };
  }
  const defenders = fighting.filter((division) => division.nation === holder);
  if (defenders.length === 0) {
    return {
      broken,
      captured: leading,
      fought: true,
      standing: fighting,
    };
  }
  const width = combatWidth(
    province.terrain,
    attackDirections(theatre, province, holder)
  );
  const attackLine = lineOf(attackers, width);
  const defenceLine = lineOf(defenders, width);
  const inLine = new Set([...attackLine, ...defenceLine]);
  const attack = attackLine.reduce(
    (total, division) => total + attackOf(division, backingOf(division)),
    0
  );
  const defence =
    defenceLine.reduce(
      (total, division) => total + defenceOf(division, backingOf(division)),
      0
    ) * terrainDefenceOf(province.terrain);
  const toDefender =
    (attack * ORGANISATION_PER_POWER) / defenceLine.length +
    supportStrikeOn(
      theatre.air,
      province.id,
      new Set(attackLine.map((division) => division.nation)),
      defenceLine
    );
  const toAttacker =
    (defence * ORGANISATION_PER_POWER) / attackLine.length +
    supportStrikeOn(theatre.air, province.id, new Set([holder]), attackLine);
  const afterFire = fighting.map((division) => {
    if (!inLine.has(division)) {
      return division;
    }
    if (division.nation === holder) {
      return struck(division, toDefender);
    }
    return struck(division, toAttacker);
  });
  return {
    broken: [...broken, ...afterFire.filter((division) => !canFight(division))],
    captured: UNASSIGNED,
    fought: true,
    standing: afterFire.filter(canFight),
  };
};
