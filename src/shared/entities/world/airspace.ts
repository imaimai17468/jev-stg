import { valueAt } from "./grid";
import { itemAt } from "./lookup";
import type { Province } from "./provinces";
import { adjacencyOf, landFlags, overTheProvinces } from "./provinces";
import { randomFromSeed, shuffled, streamSeed } from "./random";
import { spreadFrom, UNASSIGNED, unassignedBuffer } from "./spread";

/**
 * One of Hearts of Iron IV's strategic regions: a stretch of land or of sea
 * that an air wing is sent over, and over which air superiority is fought for.
 */
export interface AirRegion {
  readonly id: number;
  readonly sea: boolean;
  /** The province the region grew from, where the opening air base stands on land. */
  readonly hub: number;
  readonly provinces: readonly number[];
  /** The regions on land or at sea that touch it, in id order. */
  readonly neighbours: readonly number[];
  /** Where its cells lie on average. */
  readonly x: number;
  readonly y: number;
}

/** A world's strategic regions, the ones on land first. */
export interface Airspace {
  /** The region each province lies in, by province id. */
  readonly regionOf: Int32Array;
  readonly regions: readonly AirRegion[];
}

/** The stream of draws the regions come from, apart from the world's own. */
const AIRSPACE_STREAM = 11;

/**
 * The least distance, in cells, between the provinces two regions grow from.
 * Hearts of Iron IV's regions hold a few dozen provinces on land and a
 * handful of sea zones at sea, and a world of this size comes out with about
 * forty regions on land and twenty-five at sea at these spacings, which are
 * this game's own.
 */
const LAND_SPACING = 55;
const SEA_SPACING = 95;

/**
 * The provinces regions grow from, out of `order`: every one that stands at
 * least `spacing` from each one taken before it.
 */
const seedsOf = (
  order: readonly Province[],
  spacing: number
): readonly number[] => {
  const taken: Province[] = [];
  for (const province of order) {
    if (
      taken.every(
        (seed) =>
          Math.hypot(seed.x - province.x, seed.y - province.y) >= spacing
      )
    ) {
      taken.push(province);
    }
  }
  return taken.map((seed) => seed.id);
};

/** How the provinces of one kind are cut into regions. */
interface Cut {
  /** 1 for land and 0 for sea, as `landFlags` marks them. */
  readonly land: number;
  readonly seeds: readonly number[];
  /** The id the first of these regions takes. */
  readonly firstId: number;
}

/**
 * Every province of one kind claimed by the region it is reached from first,
 * walking over its own kind alone, and the province each region grew from. A
 * stretch no seed reaches, such as an island far from every seed, grows a
 * region of its own from its lowest province.
 *
 * `regionOf` is written in place, because land and then sea are cut into the
 * same buffer.
 */
const claimedBy = (
  provinces: readonly Province[],
  regionOf: Int32Array,
  cut: Cut
): readonly number[] => {
  const walk = overTheProvinces(adjacencyOf(provinces));
  const land = landFlags(provinces);
  const ofKind = (province: number) => valueAt(land, province) === cut.land;
  const strandedOf = () =>
    provinces.findIndex(
      (province) =>
        ofKind(province.id) && valueAt(regionOf, province.id) === UNASSIGNED
    );
  const hubs = [...cut.seeds];
  for (const [offset, hub] of hubs.entries()) {
    regionOf[hub] = cut.firstId + offset;
  }
  spreadFrom(regionOf, walk, ofKind, hubs);
  for (
    let stranded = strandedOf();
    stranded !== UNASSIGNED;
    stranded = strandedOf()
  ) {
    regionOf[stranded] = cut.firstId + hubs.length;
    hubs.push(stranded);
    spreadFrom(regionOf, walk, ofKind, [stranded]);
  }
  return hubs;
};

/** One region as its provinces make it up. */
const regionFrom = (
  provinces: readonly Province[],
  regionOf: Int32Array,
  id: number,
  hub: number
): AirRegion => {
  const members = provinces.filter(
    (province) => valueAt(regionOf, province.id) === id
  );
  const cells = members.reduce((total, province) => total + province.cells, 0);
  const touching = new Set(
    members.flatMap((province) =>
      province.neighbours.map((beside) => valueAt(regionOf, beside))
    )
  );
  touching.delete(id);
  return {
    hub,
    id,
    neighbours: [...touching].toSorted((one, other) => one - other),
    provinces: members.map((province) => province.id),
    sea: members.some((province) => province.kind === "sea"),
    x:
      members.reduce(
        (total, province) => total + province.x * province.cells,
        0
      ) / cells,
    y:
      members.reduce(
        (total, province) => total + province.y * province.cells,
        0
      ) / cells,
  };
};

/**
 * The strategic regions of a world of `provinces`, drawn from a stream of
 * their own so the ground, the borders and the deposits the world's seed drew
 * stay where they were.
 */
export const airspaceOf = (
  provinces: readonly Province[],
  seed: number
): Airspace => {
  const order = shuffled(
    provinces,
    randomFromSeed(streamSeed(seed, AIRSPACE_STREAM))
  );
  const regionOf = unassignedBuffer(provinces.length);
  const landHubs = claimedBy(provinces, regionOf, {
    firstId: 0,
    land: 1,
    seeds: seedsOf(
      order.filter((province) => province.kind === "land"),
      LAND_SPACING
    ),
  });
  const seaHubs = claimedBy(provinces, regionOf, {
    firstId: landHubs.length,
    land: 0,
    seeds: seedsOf(
      order.filter((province) => province.kind === "sea"),
      SEA_SPACING
    ),
  });
  return {
    regionOf,
    regions: [...landHubs, ...seaHubs].map((hub, id) =>
      regionFrom(provinces, regionOf, id, hub)
    ),
  };
};

/** The region `province` lies in, or `UNASSIGNED` where the airspace has none for it. */
export const regionOfProvince = (
  airspace: Airspace,
  province: number
): number => valueAt(airspace.regionOf, province);

/** Stands in for a region `itemAt` cannot reach. Nothing reads it but the caller. */
const NO_REGION: AirRegion = {
  hub: UNASSIGNED,
  id: UNASSIGNED,
  neighbours: [],
  provinces: [],
  sea: false,
  x: 0,
  y: 0,
};

/** The region `region` and every region that touches it: where a wing based in it can fly. */
export const withinRange = (
  airspace: Airspace,
  region: number
): readonly number[] => [
  region,
  ...itemAt(airspace.regions, region, NO_REGION).neighbours,
];

/**
 * The provinces of `region` and of every region that touches it, lowest
 * first: where a wing flying over `region` can be based. A region the
 * airspace does not hold has none.
 */
export const provincesInRangeOf = (
  airspace: Airspace,
  region: number
): readonly number[] =>
  withinRange(airspace, region)
    .flatMap((near) => itemAt(airspace.regions, near, NO_REGION).provinces)
    .toSorted((one, other) => one - other);
