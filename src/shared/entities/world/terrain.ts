import type { Grid } from "./grid";
import { cellCount, cellX, cellY, valueAt } from "./grid";
import { fractalNoise } from "./noise";

/** What a land province is made of, which decides how hard it is to cross. */
export type Terrain =
  | "plains"
  | "forest"
  | "hills"
  | "mountains"
  | "desert"
  | "tundra";

/** Cycles of the continent term across the map's short side. */
const CONTINENT_FREQUENCY = 2.8;
/** Cycles of the coastline term across the same side. */
const DETAIL_FREQUENCY = 17;
const CONTINENT_WEIGHT = 0.8;
/** How far the warp drags a point, in the same units as the frequencies above. */
const WARP_STRENGTH = 0.32;
const WARP_FREQUENCY = 1.7;
const MOISTURE_SEED_OFFSET = 7919;
const DETAIL_SEED_OFFSET = 1013;
const WARP_SEED_OFFSET_ACROSS = 4001;
const WARP_SEED_OFFSET_DOWN = 6131;
/** Pulls the warp's two fields apart, so they do not drag in step. */
const WARP_LANE = 5.2;

/** Where a cell sits in units that measure the same distance on both axes. */
interface Place {
  readonly across: number;
  readonly down: number;
}

/**
 * A cell in noise coordinates.
 *
 * Both axes are divided by the same side, so a feature a third of the map tall
 * is also a third of the map tall wide. Dividing each axis by its own side is
 * what stretched every landmass into a slab as wide as the map is wider than it
 * is tall.
 */
const placeOf = (grid: Grid, x: number, y: number): Place => ({
  across: x / grid.height,
  down: y / grid.height,
});

/**
 * How far into the world a point sits, 1 in the middle and 0 at the rim, so
 * every landmass is bounded by ocean and no continent runs off the edge.
 */
const inland = (grid: Grid, x: number, y: number): number => {
  const acrossX = (x / grid.width) * 2 - 1;
  const acrossY = (y / grid.height) * 2 - 1;
  return 1 - Math.max(Math.abs(acrossX), Math.abs(acrossY)) ** 8;
};

/**
 * The point the continent term is read at, dragged by a second noise field.
 *
 * Sampling the field straight gives contours that close into rounded blobs,
 * because that is what a smooth field's level sets are. Dragging the sample
 * point folds those contours into the inlets, peninsulas and offshore chains a
 * coastline is made of, and it is the one change that makes the landmasses read
 * as continents rather than as torn paper.
 */
const warped = (place: Place, seed: number): Place => {
  const across = place.across * WARP_FREQUENCY;
  const down = place.down * WARP_FREQUENCY;
  const dragAcross =
    fractalNoise(across, down, seed + WARP_SEED_OFFSET_ACROSS, 3) - 0.5;
  const dragDown =
    fractalNoise(
      across + WARP_LANE,
      down + WARP_LANE,
      seed + WARP_SEED_OFFSET_DOWN,
      3
    ) - 0.5;
  return {
    across: place.across + WARP_STRENGTH * dragAcross,
    down: place.down + WARP_STRENGTH * dragDown,
  };
};

/**
 * The land height at a cell, in [0, 1).
 *
 * The low-frequency term gathers land into a handful of continents and the
 * high-frequency one gives their coasts bays and islands. Both are read at the
 * warped point, so the detail follows the same folds the outline does.
 */
export const heightAt = (grid: Grid, cell: number, seed: number): number => {
  const x = cellX(grid, cell);
  const y = cellY(grid, cell);
  const place = warped(placeOf(grid, x, y), seed);
  const continents = fractalNoise(
    place.across * CONTINENT_FREQUENCY,
    place.down * CONTINENT_FREQUENCY,
    seed,
    4
  );
  const detail = fractalNoise(
    place.across * DETAIL_FREQUENCY,
    place.down * DETAIL_FREQUENCY,
    seed + DETAIL_SEED_OFFSET,
    4
  );
  const combined =
    continents * CONTINENT_WEIGHT + detail * (1 - CONTINENT_WEIGHT);
  // Squaring stretches the top of the range against the rest, so the high
  // ground gathers into a few ranges rather than spreading over every second
  // province. It moves the coastline too: the sea level is a quantile of this
  // whole product, and the per-cell `inland` factor means squaring reorders it.
  // Changing the exponent redraws the map rather than only the mountains.
  return combined ** 2 * inland(grid, x, y);
};

/**
 * How wet a cell is, in [0, 1), drawn independently of its height.
 *
 * This one keeps the per-axis units `placeOf` rejects for the coastline, so its
 * bands come out wider than they are tall. That is the shape climate has: what
 * decides whether a lowland is desert or forest runs with the latitude bands
 * rather than in circles.
 */
export const moistureAt = (grid: Grid, cell: number, seed: number): number =>
  fractalNoise(
    (cellX(grid, cell) / grid.width) * 5,
    (cellY(grid, cell) / grid.height) * 5,
    seed + MOISTURE_SEED_OFFSET,
    3
  );

/** How far a cell sits from the equator, 0 at the middle row and 1 at a pole. */
export const latitudeAt = (grid: Grid, cell: number): number =>
  Math.abs((cellY(grid, cell) / grid.height) * 2 - 1);

/** Every cell's height, in cell order. */
export const heightField = (grid: Grid, seed: number): Float32Array =>
  Float32Array.from({ length: cellCount(grid) }, (_, cell) =>
    heightAt(grid, cell, seed)
  );

/**
 * The height leaving `landFraction` of the grid above it.
 *
 * Reading the level off the field rather than fixing it keeps the share of land
 * the same from seed to seed, where a constant would give one world a single
 * pond and the next an unbroken continent.
 */
export const seaLevelFor = (
  heights: Float32Array,
  landFraction: number
): number => {
  const sorted = heights.toSorted();
  return valueAt(sorted, Math.floor(sorted.length * (1 - landFraction)));
};

/**
 * The highest point of a height field, which is what a mountain is measured
 * against.
 */
export const peakOf = (heights: Float32Array): number => {
  let peak = 0;
  for (const height of heights) {
    peak = Math.max(peak, height);
  }
  return peak;
};

/**
 * How far a cell rises from sea level towards the highest land, in [0, 1].
 *
 * Terrain is read off this rather than off the raw height, so retuning the
 * height field moves every coastline without also turning every mountain into a
 * plain.
 */
export const elevationAt = (
  height: number,
  seaLevel: number,
  peak: number
): number =>
  Math.min(
    1,
    Math.max(0, (height - seaLevel) / Math.max(1e-6, peak - seaLevel))
  );

/**
 * Which terrain a land cell carries.
 *
 * Elevation decides first, because a mountain range reads as one whatever falls
 * on it, and latitude and moisture then split the lowland.
 */
export const terrainAt = (
  elevation: number,
  moisture: number,
  latitude: number
): Terrain => {
  if (elevation > 0.55) {
    return "mountains";
  }
  if (elevation > 0.36) {
    return "hills";
  }
  if (latitude > 0.82) {
    return "tundra";
  }
  if (moisture < 0.32) {
    return "desert";
  }
  if (moisture > 0.58) {
    return "forest";
  }
  return "plains";
};
