import { valueAt } from "../grid";
import type { LandProvince, Province, ProvinceGraph } from "../provinces";
import { distanceOver, isLand, landIdsWhere, neighboursOf } from "../provinces";
import { UNASSIGNED } from "../spread";
import type { Wars } from "../wars";
import { atWar } from "../wars";

/** Whether the province is held by a nation that `accepts` names. */
const heldBy = (
  owners: Int32Array,
  province: number,
  accepts: (owner: number) => boolean
): boolean => {
  const owner = valueAt(owners, province);
  return owner !== UNASSIGNED && accepts(owner);
};

/** Whether the province is held by a nation `nation` is at war with. */
const enemyHeld =
  (owners: Int32Array, wars: Wars, nation: number) =>
  (province: number): boolean =>
    heldBy(owners, province, (owner) => atWar(wars, nation, owner));

/** Whether the province is held by a nation other than `nation`. */
const foreignHeld =
  (owners: Int32Array, nation: number) =>
  (province: number): boolean =>
    heldBy(owners, province, (owner) => owner !== nation);

/** The nation's own land provinces that `accepts` names. */
const ownWhere = (
  provinces: readonly Province[],
  owners: Int32Array,
  nation: number,
  accepts: (province: LandProvince) => boolean
): readonly number[] =>
  landIdsWhere(
    provinces,
    (province) => valueAt(owners, province.id) === nation && accepts(province)
  );

/** The nation's own provinces that touch ground `facing` accepts. */
const touching = (
  provinces: readonly Province[],
  owners: Int32Array,
  nation: number,
  facing: (province: number) => boolean
): readonly number[] =>
  ownWhere(provinces, owners, nation, (province) =>
    province.neighbours.some(facing)
  );

/** Who holds what and who is fighting whom, which is all a front is drawn from. */
export interface Standoff {
  readonly provinces: readonly Province[];
  readonly owners: Int32Array;
  readonly wars: Wars;
}

/**
 * The nation's own provinces touching ground held by a nation it is at war
 * with, which is where its battle plans draw their fronts.
 */
export const enemyContact = (
  { owners, provinces, wars }: Standoff,
  nation: number
): readonly number[] =>
  touching(provinces, owners, nation, enemyHeld(owners, wars, nation));

/**
 * The nation's own provinces that touch what it faces, which is where its
 * divisions stand to hold the line and where they attack from: the enemy's
 * ground, and where no enemy's ground touches its own, any foreign ground,
 * since a border is where an army waits.
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
  const facing = enemyContact({ owners, provinces, wars }, nation);
  if (facing.length > 0) {
    return facing;
  }
  return touching(provinces, owners, nation, foreignHeld(owners, nation));
};

/**
 * How many provinces each one is from `seeds`, walking only over land held
 * by a nation `holds` accepts, with `UNASSIGNED` where no such walk reaches.
 */
export const heldGroundDistance = (
  graph: ProvinceGraph,
  owners: Int32Array,
  holds: (owner: number) => boolean,
  seeds: readonly number[]
): Int32Array =>
  distanceOver(
    graph,
    (province) => isLand(graph, province) && holds(valueAt(owners, province)),
    seeds
  );

/**
 * How many provinces of the nation's own ground each one is from `seeds`,
 * with `UNASSIGNED` where no march over its own ground reaches them.
 */
export const fieldFrom = (
  graph: ProvinceGraph,
  owners: Int32Array,
  nation: number,
  seeds: readonly number[]
): Int32Array =>
  heldGroundDistance(graph, owners, (owner) => owner === nation, seeds);

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
  fieldFrom(graph, owners, nation, frontLine(provinces, owners, wars, nation));

/**
 * Where a nation has room for another division: on its front line, in reserve
 * behind a line that is full, or nowhere, in which case the line takes it.
 */
export type Room = "line" | "reserve" | "full";

/** Where a nation has room, and how far each of its provinces is from it. */
export interface Deployment {
  readonly room: Room;
  /** How far each province of the nation's own ground is from the room. */
  readonly field: Int32Array;
}

/** The provinces a nation has room in, and which kind of room they are. */
interface Rooms {
  readonly room: Room;
  readonly seeds: readonly number[];
}

/** The provinces a nation has room in, and which kind of room that is. */
const roomFor = (
  provinces: readonly Province[],
  owners: Int32Array,
  wars: Wars,
  nation: number,
  open: (province: number) => boolean
): Rooms => {
  const whole = frontLine(provinces, owners, wars, nation);
  const onTheLine = whole.filter(open);
  if (onTheLine.length > 0) {
    return { room: "line", seeds: onTheLine };
  }
  const behind = ownWhere(provinces, owners, nation, (province) =>
    open(province.id)
  );
  if (behind.length > 0) {
    return { room: "reserve", seeds: behind };
  }
  return { room: "full", seeds: whole };
};

/**
 * Where a nation sends a division that is not needed where it stands: the
 * provinces of its front line `open` accepts, which is where the line still has
 * room; where the whole line is full, its own provinces behind it with room,
 * where the division waits in reserve; and where there is no room anywhere,
 * the line itself.
 */
export const deploymentOf = (
  provinces: readonly Province[],
  graph: ProvinceGraph,
  owners: Int32Array,
  wars: Wars,
  nation: number,
  open: (province: number) => boolean
): Deployment => {
  const { room, seeds } = roomFor(provinces, owners, wars, nation, open);
  return { field: fieldFrom(graph, owners, nation, seeds), room };
};
/** The enemy-held land provinces touching `province`. */
export const enemyNeighbours = (
  graph: ProvinceGraph,
  owners: Int32Array,
  wars: Wars,
  nation: number,
  province: number
): readonly number[] =>
  neighboursOf(graph, province).filter(
    (beside) => isLand(graph, beside) && enemyHeld(owners, wars, nation)(beside)
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
