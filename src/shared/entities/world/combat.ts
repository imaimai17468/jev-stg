import type { Division } from "./divisions";
import {
  attackOf,
  defenceOf,
  rested,
  strengthOf,
  terrainDefenceOf,
} from "./divisions";
import { valueAt } from "./grid";
import { itemAt } from "./lookup";
import type { Modifiers } from "./modifiers";
import { NO_MODIFIERS } from "./modifiers";
import type { LandProvince, ProvinceGraph } from "./provinces";
import { isLand, neighboursOf } from "./provinces";
import { UNASSIGNED } from "./spread";
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

/**
 * The broken division standing on the first ground behind it its nation holds,
 * or nothing where no such ground touches it.
 *
 * A division with nowhere to fall back to is lost, which is how a pocket ends.
 */
export const withdrawn = (
  graph: ProvinceGraph,
  owners: Int32Array,
  division: Division
): readonly Division[] => {
  for (const beside of neighboursOf(graph, division.province)) {
    if (!isLand(graph, beside) || valueAt(owners, beside) !== division.nation) {
      continue;
    }
    return [
      {
        ...division,
        marched: 0,
        movingTo: beside,
        organisation: 0,
        province: beside,
      },
    ];
  }
  return [];
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
}

/**
 * One day of whatever is happening in a province that divisions stand in.
 *
 * The nation holding the ground defends it, and every nation at war with that
 * one attacks together, which is as close to a coalition as a world with no
 * diplomacy gets. A division that has already broken takes no part: it is
 * neither counted in the defence nor struck, and it leaves the province.
 */
export const foughtOneDay = (
  theatre: Theatre,
  province: LandProvince,
  present: readonly Division[]
): Battle => {
  const { owners, wars } = theatre;
  const modifiersOf = (division: Division) =>
    itemAt(theatre.modifiers, division.nation, NO_MODIFIERS);
  const holder = valueAt(owners, province.id);
  const fighting = present.filter(canFight);
  const broken = present.filter((division) => !canFight(division));
  const attacking = (division: Division) =>
    atWar(wars, holder, division.nation);
  const attackers = fighting.filter(attacking);
  if (attackers.length === 0) {
    return {
      broken: [],
      captured: UNASSIGNED,
      fought: false,
      standing: present.map((division) =>
        rested(division, modifiersOf(division))
      ),
    };
  }
  const defenders = fighting.filter((division) => division.nation === holder);
  if (defenders.length === 0) {
    return {
      broken,
      captured: strongestOf(attackers),
      fought: true,
      standing: fighting,
    };
  }
  const attack = attackers.reduce(
    (total, division) => total + attackOf(division, modifiersOf(division)),
    0
  );
  const defence =
    defenders.reduce(
      (total, division) => total + defenceOf(division, modifiersOf(division)),
      0
    ) * terrainDefenceOf(province.terrain);
  const toDefender = (attack * ORGANISATION_PER_POWER) / defenders.length;
  const toAttacker = (defence * ORGANISATION_PER_POWER) / attackers.length;
  const afterFire = fighting.map((division) => {
    if (division.nation === holder) {
      return struck(division, toDefender);
    }
    if (attacking(division)) {
      return struck(division, toAttacker);
    }
    return division;
  });
  return {
    broken: [...broken, ...afterFire.filter((division) => !canFight(division))],
    captured: UNASSIGNED,
    fought: true,
    standing: afterFire.filter(canFight),
  };
};
