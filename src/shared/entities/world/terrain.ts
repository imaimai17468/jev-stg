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

const CONTINENT_FREQUENCY = 4;
const DETAIL_FREQUENCY = 16;
const CONTINENT_WEIGHT = 0.62;
const MOISTURE_SEED_OFFSET = 7919;
const DETAIL_SEED_OFFSET = 1013;
const STRAIT_SEED_OFFSET = 4001;
const STRAIT_FREQUENCY = 2.2;
const STRAIT_DEPTH = 0.7;

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
 * How much a point is cut by a strait: 0 along a winding line and 1 away from
 * it.
 *
 * Without this the top third of a smooth height field comes out as one
 * connected mass on most seeds, and a world with a single continent has no use
 * for a navy.
 */
const strait = (acrossX: number, acrossY: number, seed: number): number =>
  Math.abs(
    fractalNoise(
      acrossX * STRAIT_FREQUENCY,
      acrossY * STRAIT_FREQUENCY,
      seed + STRAIT_SEED_OFFSET,
      2
    ) *
      2 -
      1
  );

/**
 * The land height at a cell, in [0, 1).
 *
 * The low-frequency term is what gathers land into a handful of continents, and
 * the high-frequency one is what gives their coasts bays and peninsulas.
 */
export const heightAt = (grid: Grid, cell: number, seed: number): number => {
  const x = cellX(grid, cell);
  const y = cellY(grid, cell);
  const acrossX = x / grid.width;
  const acrossY = y / grid.height;
  const continents = fractalNoise(
    acrossX * CONTINENT_FREQUENCY,
    acrossY * CONTINENT_FREQUENCY,
    seed,
    3
  );
  const detail = fractalNoise(
    acrossX * DETAIL_FREQUENCY,
    acrossY * DETAIL_FREQUENCY,
    seed + DETAIL_SEED_OFFSET,
    5
  );
  const combined =
    continents * CONTINENT_WEIGHT + detail * (1 - CONTINENT_WEIGHT);
  // Squaring pulls the middle of the range down harder than the top, which is
  // what separates the landmasses instead of joining them by a shallow ridge.
  const carved =
    1 - STRAIT_DEPTH + STRAIT_DEPTH * strait(acrossX, acrossY, seed);
  return combined ** 2 * inland(grid, x, y) * carved;
};

/** How wet a cell is, in [0, 1), drawn independently of its height. */
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
 * Which terrain a land cell carries.
 *
 * Height decides first, because a mountain range reads as one whatever falls on
 * it, and latitude and moisture then split the lowland.
 */
export const terrainAt = (
  height: number,
  moisture: number,
  latitude: number
): Terrain => {
  if (height > 0.78) {
    return "mountains";
  }
  if (height > 0.62) {
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
