import type { Wing } from "./air-force";
import { valueAt } from "./grid";
import type { World } from "./index";
import { UNASSIGNED } from "./spread";

/** The planes one level of an air base hosts, after Hearts of Iron IV. */
const PLANES_PER_LEVEL = 200;

/** The most levels an air base is built to, after Hearts of Iron IV. */
export const MOST_BASE_LEVELS = 10;

/** What one level of an air base costs, in construction, after Hearts of Iron IV. */
export const AIR_BASE_COST = 1250;

/**
 * The levels of the air base the hub of every region on land opens with, and
 * the ones every capital opens with. Hearts of Iron IV's states open with
 * their historical air bases, so these are this game's own.
 */
const HUB_LEVELS = 2;
const CAPITAL_LEVELS = 5;

/** The level of the air base in each province, by province id, as the world opens. */
export const openingAirBases = (world: World): Uint8Array => {
  const bases = new Uint8Array(world.provinces.length);
  for (const region of world.airspace.regions) {
    if (!region.sea) {
      bases[region.hub] = HUB_LEVELS;
    }
  }
  for (const nation of world.nations) {
    bases[nation.capital] = CAPITAL_LEVELS;
  }
  return bases;
};

/** The planes the air base in `province` hosts. */
export const capacityAt = (bases: Uint8Array, province: number): number =>
  valueAt(bases, province) * PLANES_PER_LEVEL;

/** The air bases one nation holds. */
export interface HeldBases {
  /** Their levels added together. */
  readonly levels: number;
  /** The planes they host between them. */
  readonly capacity: number;
}

/** The air bases `nation` holds, in `bases` over the ground `owners` gives it. */
export const basesHeldBy = (
  bases: Uint8Array,
  owners: Int32Array,
  nation: number
): HeldBases => {
  let levels = 0;
  for (const [province, level] of bases.entries()) {
    levels += level * Number(valueAt(owners, province) === nation);
  }
  return { capacity: levels * PLANES_PER_LEVEL, levels };
};

/** The share of their full worth planes lose for each share of planes over what their base hosts. */
const CROWDING_PENALTY = 2;

/**
 * The share of their full worth the planes at a base keep when `planes` of
 * them crowd one that hosts `capacity`: all of it while they fit, 2% less for
 * every 1% over after Hearts of Iron IV, and none at half over or on ground
 * with no base at all.
 */
export const crowdingEfficiency = (planes: number, capacity: number): number =>
  Math.max(
    0,
    1 - CROWDING_PENALTY * Math.max(0, planes / Math.max(capacity, 1e-9) - 1)
  );

/** The planes based in each province, by province id. */
export const stationedOf = (
  wings: readonly Wing[],
  provinces: number
): Float64Array => {
  const stationed = new Float64Array(provinces);
  for (const wing of wings) {
    stationed[wing.base] = valueAt(stationed, wing.base) + wing.planes;
  }
  return stationed;
};

/** Where one nation's planes can be based. */
export interface Basing {
  readonly bases: Uint8Array;
  readonly owners: Int32Array;
  readonly nation: number;
  /** The planes the nation already has at each province, by province id. */
  readonly stationed: Float64Array;
}

/**
 * The air base among `candidates`, in ascending order, that the nation has the
 * most room left at, the lowest province first where two tie, or
 * `UNASSIGNED` where it holds none of them.
 */
export const roomiestAmong = (
  basing: Basing,
  candidates: Iterable<number>
): number => {
  let best = UNASSIGNED;
  let bestRoom = Number.NEGATIVE_INFINITY;
  for (const province of candidates) {
    if (
      valueAt(basing.bases, province) === 0 ||
      valueAt(basing.owners, province) !== basing.nation
    ) {
      continue;
    }
    const room =
      capacityAt(basing.bases, province) - valueAt(basing.stationed, province);
    if (room > bestRoom) {
      best = province;
      bestRoom = room;
    }
  }
  return best;
};

/** The air base anywhere that the nation has the most room left at, as `roomiestAmong` picks it. */
export const roomiestBase = (basing: Basing): number =>
  roomiestAmong(basing, basing.bases.keys());

/** The share of what its bases host a nation's planes fill before it builds another level. */
const BUILD_ABOVE = 0.9;

/**
 * Where the nation wants its next level of air base: while its planes fill
 * nine tenths of what its bases host, the base it holds with the most levels
 * that still has room for one, the lowest province first where two tie, and
 * `fallback` where it holds none; and nowhere while they fit.
 */
export const baseWanted = (basing: Basing, fallback: number): number => {
  let planes = 0;
  let capacity = 0;
  let best = UNASSIGNED;
  let bestLevel = 0;
  for (const [province, level] of basing.bases.entries()) {
    planes += valueAt(basing.stationed, province);
    if (valueAt(basing.owners, province) !== basing.nation) {
      continue;
    }
    capacity += capacityAt(basing.bases, province);
    if (level > bestLevel && level < MOST_BASE_LEVELS) {
      best = province;
      bestLevel = level;
    }
  }
  if (planes < BUILD_ABOVE * capacity) {
    return UNASSIGNED;
  }
  if (best === UNASSIGNED) {
    return fallback;
  }
  return best;
};
