import type { Division } from "./divisions";
import {
  enemyContact,
  fieldFrom,
  heldGroundDistance,
  stepToward,
} from "./front";
import { valueAt } from "./grid";
import type { Nation } from "./nations";
import type { Province, ProvinceGraph } from "./provinces";
import { neighboursOf } from "./provinces";
import { UNASSIGNED } from "./spread";
import type { Wars } from "./wars";
import { atWar } from "./wars";

/**
 * How many provinces behind the front line the fallback line runs, where a
 * nation's broken divisions regroup. The depth is this game's own.
 */
const FALLBACK_DEPTH = 2;

/** One unbroken stretch of a nation's front, and where its offensive leads. */
export interface Front {
  /** The nation's own provinces on this stretch, each touching the enemy. */
  readonly line: readonly number[];
  /**
   * The provinces the offensive walks through: the one on the line it sets
   * out from, then the enemy's up to the objective. Empty where no enemy
   * capital is reachable over enemy ground.
   */
  readonly offensive: readonly number[];
}

/** Everything a nation's army is ordered by at war, drawn afresh each day. */
export interface BattlePlan {
  readonly fronts: readonly Front[];
  /** The nation's own provinces its fallback line runs through. */
  readonly fallback: readonly number[];
  /**
   * How many provinces of the nation's own ground each one is behind its
   * front, with `UNASSIGNED` where no march over its own ground reaches it.
   */
  readonly depth: Int32Array;
  /**
   * How many provinces of enemy ground each enemy province is from the
   * nearest objective, with `UNASSIGNED` where no walk over enemy ground
   * reaches one. The whole front advances down it, and each front's arrow
   * draws the one route of it that crosses the border nearest an objective.
   */
  readonly approach: Int32Array;
  /**
   * How many provinces of the nation's own ground each one is from its
   * fallback line, with `UNASSIGNED` where there is no line to fall back to.
   */
  readonly retreat: Int32Array;
}

const NO_FIELD = new Int32Array(0);

/** Stands in for the plan of a nation the world does not hold, which fronts nothing. */
export const NO_PLAN: BattlePlan = {
  approach: NO_FIELD,
  depth: NO_FIELD,
  fallback: [],
  fronts: [],
  retreat: NO_FIELD,
};

/**
 * `members` grouped into the stretches that touch each other, each stretch in
 * the order a walk from its lowest id reaches it and the stretches in the
 * order of their lowest id.
 */
const stretchesOf = (
  graph: ProvinceGraph,
  members: readonly number[]
): readonly (readonly number[])[] => {
  const onLine = new Set(members);
  const seen = new Set<number>();
  const stretches: number[][] = [];
  for (const start of members.toSorted((one, other) => one - other)) {
    if (seen.has(start)) {
      continue;
    }
    seen.add(start);
    const stretch = [start];
    for (let walked = 0; walked < stretch.length; walked += 1) {
      for (const beside of neighboursOf(graph, valueAt(stretch, walked))) {
        if (!onLine.has(beside) || seen.has(beside)) {
          continue;
        }
        seen.add(beside);
        stretch.push(beside);
      }
    }
    stretches.push(stretch);
  }
  return stretches;
};

/** The enemies' capitals the nation is at war with that an enemy still holds. */
const objectivesOf = (
  nations: readonly Nation[],
  owners: Int32Array,
  wars: Wars,
  nation: number
): readonly number[] =>
  nations.flatMap((enemy) => {
    if (
      !atWar(wars, nation, enemy.id) ||
      !atWar(wars, nation, valueAt(owners, enemy.capital))
    ) {
      return [];
    }
    return [enemy.capital];
  });

/**
 * How far each province of enemy ground is from the nearest of `objectives`,
 * walking over enemy ground alone.
 */
const approachTo = (
  graph: ProvinceGraph,
  owners: Int32Array,
  wars: Wars,
  nation: number,
  objectives: readonly number[]
): Int32Array =>
  heldGroundDistance(
    graph,
    owners,
    (owner) => atWar(wars, nation, owner),
    objectives
  );

/** Where one step of an offensive leads from `from`, and how far that is from its objective. */
interface Step {
  readonly from: number;
  readonly into: number;
  readonly distance: number;
}

/**
 * The offensive of one stretch: from the province on it whose enemy neighbour
 * is nearest an objective, down the approach to that objective.
 */
const offensiveOf = (
  graph: ProvinceGraph,
  approach: Int32Array,
  stretch: readonly number[]
): readonly number[] => {
  let best: Step = { distance: UNASSIGNED, from: UNASSIGNED, into: UNASSIGNED };
  for (const from of stretch) {
    for (const into of neighboursOf(graph, from)) {
      const distance = valueAt(approach, into);
      if (
        distance === UNASSIGNED ||
        (best.distance !== UNASSIGNED && distance >= best.distance)
      ) {
        continue;
      }
      best = { distance, from, into };
    }
  }
  if (best.into === UNASSIGNED) {
    return [];
  }
  const route = [best.from, best.into];
  let at = best.into;
  for (let left = best.distance; left > 0; left -= 1) {
    at = stepToward(graph, approach, at);
    route.push(at);
  }
  return route;
};

/**
 * The nation's own provinces `FALLBACK_DEPTH` provinces behind the line, in
 * id order. Each stretch of its ground that marches to the line is weighed on
 * its own: one that runs less deep than that falls back as deep as it runs,
 * and one that is all line has no fallback line.
 */
const fallbackOf = (
  graph: ProvinceGraph,
  behindLine: Int32Array
): readonly number[] => {
  const reached: number[] = [];
  for (const [province, distance] of behindLine.entries()) {
    if (distance !== UNASSIGNED) {
      reached.push(province);
    }
  }
  return stretchesOf(graph, reached)
    .flatMap((ground) => {
      const deepest = Math.min(
        FALLBACK_DEPTH,
        Math.max(...ground.map((province) => valueAt(behindLine, province)))
      );
      if (deepest === 0) {
        return [];
      }
      return ground.filter(
        (province) => valueAt(behindLine, province) === deepest
      );
    })
    .toSorted((one, other) => one - other);
};

/**
 * The battle plan a nation fights by today, after Hearts of Iron IV's: a
 * front along every stretch of its ground that touches an enemy, an offensive
 * from each toward the nearest enemy capital, and a fallback line behind them
 * all. A nation at peace, or at war with nobody it touches, has none of them.
 */
export const battlePlanOf = (
  provinces: readonly Province[],
  nations: readonly Nation[],
  graph: ProvinceGraph,
  owners: Int32Array,
  wars: Wars,
  nation: number
): BattlePlan => {
  const line = enemyContact({ owners, provinces, wars }, nation);
  const approach = approachTo(
    graph,
    owners,
    wars,
    nation,
    objectivesOf(nations, owners, wars, nation)
  );
  const depth = fieldFrom(graph, owners, nation, line);
  const fallback = fallbackOf(graph, depth);
  return {
    approach,
    depth,
    fallback,
    fronts: stretchesOf(graph, line).map((stretch) => ({
      line: stretch,
      offensive: offensiveOf(graph, approach, stretch),
    })),
    retreat: fieldFrom(graph, owners, nation, fallback),
  };
};

/** Every nation's battle plan today, by nation id. */
export const battlePlansOf = (
  provinces: readonly Province[],
  nations: readonly Nation[],
  graph: ProvinceGraph,
  owners: Int32Array,
  wars: Wars
): readonly BattlePlan[] =>
  nations.map((nation) =>
    battlePlanOf(provinces, nations, graph, owners, wars, nation.id)
  );

/** Whether the division stands on its nation's front under the line's orders, which is where it plans an attack. */
export const onItsFront = (plan: BattlePlan, division: Division): boolean =>
  division.task === "line" && valueAt(plan.depth, division.province) === 0;
