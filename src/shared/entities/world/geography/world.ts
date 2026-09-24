import type { Airspace } from "../airspace";
import { airspaceOf } from "../airspace";
import type { Grid } from "../grid";
import { cellCount, valueAt } from "../grid";
import type { Province } from "../provinces";
import { buildProvinces } from "../provinces";
import type { Random } from "../random";
import { randomFromSeed } from "../random";
import type { ResourceNeed } from "../resources";
import { depositsOf } from "../resources";
import { unassignedBuffer } from "../spread";
import { sinkSmallIslands } from "./landmass";
import type { Nation } from "./nations";
import { buildNations, pickCapitals } from "./nations";
import {
  fillUnassigned,
  growRegions,
  latticeSeeds,
  sinkUnreached,
} from "./regions";
import type { Terrain } from "./terrain";
import {
  elevationAt,
  heightField,
  latitudeAt,
  moistureAt,
  peakOf,
  seaLevelFor,
  terrainAt,
} from "./terrain";

/** The cell lattice every world is drawn on. */
const WORLD_GRID: Grid = { height: 400, width: 800 };

/** How much of the lattice ends up above sea level. */
const LAND_FRACTION = 0.3;

/**
 * The smallest landmass a world keeps, which is about a thirty-five cell square.
 *
 * The coastline term sheds fragments of its own outline, and a map carrying them
 * reads as an archipelago rather than as a world with continents. This is the
 * floor at which six rendered seeds stopped reading that way.
 */
const MINIMUM_ISLAND_CELLS = 1200;

/**
 * The lattice the province seeds are drawn from. Its points times the land
 * share is roughly how many land provinces a world ends up with.
 */
const PROVINCE_LATTICE = { columns: 74, rows: 37 };
const SEA_LATTICE = { columns: 18, rows: 9 };

interface Lattice {
  readonly columns: number;
  readonly rows: number;
}

export const NATION_COUNT = 14;

/** A generated world: the ground, how it is divided, and who lives where. */
export interface World {
  readonly seed: number;
  readonly grid: Grid;
  /** The province each cell belongs to, by cell index. */
  readonly cellProvince: Int32Array;
  readonly provinces: readonly Province[];
  readonly nations: readonly Nation[];
  /** What each province yields of each resource a day, by province id. */
  readonly deposits: readonly ResourceNeed[];
  /** The strategic regions the air wings are sent over. */
  readonly airspace: Airspace;
}

const landMask = (heights: Float32Array, seaLevel: number): Uint8Array =>
  Uint8Array.from(heights, (height) => Number(height > seaLevel));

/** Where the sea ends and how high the land goes, read once per world. */
interface Relief {
  readonly seaLevel: number;
  readonly peak: number;
}

const terrainReader =
  (grid: Grid, heights: Float32Array, relief: Relief, seed: number) =>
  (cell: number): Terrain =>
    terrainAt(
      elevationAt(valueAt(heights, cell), relief.seaLevel, relief.peak),
      moistureAt(grid, cell, seed),
      latitudeAt(grid, cell)
    );

/**
 * Scatters seeds over the lattice, keeps the ones standing on the wanted side of
 * the coast, and grows a region from each of them.
 *
 * Land and sea are cut the same way and only differ in which side of the mask
 * they take, so both go through here.
 */
const growOver = (
  grid: Grid,
  regions: Int32Array,
  isLand: Uint8Array,
  lattice: Lattice,
  over: {
    readonly onLand: number;
    readonly firstRegionId: number;
    readonly random: Random;
  }
): readonly number[] => {
  const belongs = (cell: number) => valueAt(isLand, cell) === over.onLand;
  // Two lattice columns can floor onto the cell they share, and a seed whose
  // cell another seed already took would come out as a region with no cells at
  // all, which `pickCapitals` then reads as the point furthest from everything.
  const seeds = [
    ...new Set(
      latticeSeeds(grid, lattice.columns, lattice.rows, over.random).filter(
        belongs
      )
    ),
  ];
  growRegions(grid, regions, belongs, seeds, over.firstRegionId);
  return seeds;
};

/**
 * Draws the whole world from one seed.
 *
 * The order is the world's own: the ground comes first, the provinces are cut
 * from it, and the nations are grown over those, so nothing upstream can depend
 * on a border that a later step decided.
 */
export const generateWorld = (seed: number): World => {
  const grid = WORLD_GRID;
  const random = randomFromSeed(seed);
  const heights = heightField(grid, seed);
  const relief: Relief = {
    peak: peakOf(heights),
    seaLevel: seaLevelFor(heights, LAND_FRACTION),
  };
  const isLand = landMask(heights, relief.seaLevel);
  sinkSmallIslands(grid, isLand, MINIMUM_ISLAND_CELLS);

  const regions = unassignedBuffer(cellCount(grid));
  const landSeeds = growOver(grid, regions, isLand, PROVINCE_LATTICE, {
    firstRegionId: 0,
    onLand: 1,
    random,
  });
  sinkUnreached(regions, isLand);
  const seaSeeds = growOver(grid, regions, isLand, SEA_LATTICE, {
    firstRegionId: landSeeds.length,
    onLand: 0,
    random,
  });
  fillUnassigned(grid, regions);

  const provinces = buildProvinces(
    grid,
    regions,
    landSeeds,
    seaSeeds,
    terrainReader(grid, heights, relief, seed)
  );
  const capitals = pickCapitals(provinces, NATION_COUNT, random);
  return {
    airspace: airspaceOf(provinces, seed),
    cellProvince: regions,
    deposits: depositsOf(provinces, seed),
    grid,
    nations: buildNations(capitals, random),
    provinces,
    seed,
  };
};
