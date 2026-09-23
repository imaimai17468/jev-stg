import { valueAt } from "./grid";
import type { Province, ProvinceGraph } from "./provinces";
import {
  isLand,
  landIdsWhere,
  neighboursOf,
  overTheProvinces,
} from "./provinces";
import { distanceFrom, UNASSIGNED } from "./spread";
import type { Wars } from "./wars";
import { atWar, enemiesOf } from "./wars";

/** Whether the province is held by a nation that `accepts` names. */
const heldBy = (
  owners: Int32Array,
  province: number,
  accepts: (owner: number) => boolean
): boolean => {
  const owner = valueAt(owners, province);
  return owner !== UNASSIGNED && accepts(owner);
};

/**
 * What the nation's army lines up against: the enemy's ground at war, and at
 * peace any foreign ground, since a border is where an army waits.
 */
const facingFor = (
  owners: Int32Array,
  wars: Wars,
  nation: number
): ((province: number) => boolean) => {
  if (enemiesOf(wars, nation).length > 0) {
    return (province) =>
      heldBy(owners, province, (owner) => atWar(wars, nation, owner));
  }
  return (province) => heldBy(owners, province, (owner) => owner !== nation);
};

/** The nation's own provinces that touch ground `facing` accepts. */
const touching = (
  provinces: readonly Province[],
  owners: Int32Array,
  nation: number,
  facing: (province: number) => boolean
): readonly number[] =>
  landIdsWhere(
    provinces,
    (province) =>
      valueAt(owners, province.id) === nation &&
      province.neighbours.some(facing)
  );

/**
 * The nation's own provinces that touch what it faces, which is where its
 * divisions stand to hold the line and where they attack from.
 *
 * A war against a nation whose ground no longer touches this one's leaves no
 * line to face, so the army falls back to watching its borders rather than
 * standing wherever it was raised.
 */
const frontLine = (
  provinces: readonly Province[],
  owners: Int32Array,
  wars: Wars,
  nation: number
): readonly number[] => {
  const facing = touching(
    provinces,
    owners,
    nation,
    facingFor(owners, wars, nation)
  );
  if (facing.length > 0) {
    return facing;
  }
  return touching(provinces, owners, nation, (province) =>
    heldBy(owners, province, (owner) => owner !== nation)
  );
};

/**
 * How many provinces of the nation's own ground each one is from its front
 * line, with `UNASSIGNED` where no march over its own ground reaches the line.
 *
 * A division reads one neighbour of this and walks to whichever is lower, so
 * the line can move under it without any division holding a route that has
 * gone stale. The field never runs onto foreign ground: crossing the line is an
 * attack, which a stack standing on it decides for itself.
 */
export const frontField = (
  provinces: readonly Province[],
  graph: ProvinceGraph,
  owners: Int32Array,
  wars: Wars,
  nation: number
): Int32Array =>
  distanceFrom(
    provinces.length,
    overTheProvinces(graph.adjacency),
    (province) =>
      isLand(graph, province) && valueAt(owners, province) === nation,
    frontLine(provinces, owners, wars, nation)
  );

/** The enemy-held land provinces touching `province`. */
export const enemyNeighbours = (
  graph: ProvinceGraph,
  owners: Int32Array,
  wars: Wars,
  nation: number,
  province: number
): readonly number[] =>
  neighboursOf(graph, province).filter(
    (beside) =>
      isLand(graph, beside) &&
      heldBy(owners, beside, (owner) => atWar(wars, nation, owner))
  );

/**
 * The neighbour a division standing at `province` walks into next, or
 * `province` itself where it is already on the line or no route leads there.
 */
export const stepToward = (
  graph: ProvinceGraph,
  field: Int32Array,
  province: number
): number => {
  const standing = valueAt(field, province);
  if (standing <= 0) {
    return province;
  }
  let best = province;
  let closest = standing;
  for (const beside of neighboursOf(graph, province)) {
    const distance = valueAt(field, beside);
    if (distance === UNASSIGNED || distance >= closest) {
      continue;
    }
    closest = distance;
    best = beside;
  }
  return best;
};
