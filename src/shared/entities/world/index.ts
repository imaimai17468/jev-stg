import type { Grid } from "./grid";
import { cellCount, valueAt } from "./grid";
import type { Nation } from "./nations";
import { buildNations, growOwners, pickCapitals } from "./nations";
import type { Province } from "./provinces";
import { buildProvinces } from "./provinces";
import type { Random } from "./random";
import { randomFromSeed } from "./random";
import {
  emptyRegions,
  fillUnassigned,
  growRegions,
  latticeSeeds,
  sinkUnreached,
} from "./regions";
import type { Terrain } from "./terrain";
import {
  heightField,
  latitudeAt,
  moistureAt,
  seaLevelFor,
  terrainAt,
} from "./terrain";

/** The cell lattice every world is drawn on. */
const WORLD_GRID: Grid = { height: 400, width: 800 };

/** How much of the lattice ends up above sea level. */
const LAND_FRACTION = 0.3;

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

/** A generated world: the ground, how it is divided, and who holds it. */
export interface World {
  readonly seed: number;
  readonly grid: Grid;
  /** The province each cell belongs to, by cell index. */
  readonly cellProvince: Int32Array;
  readonly provinces: readonly Province[];
  /** The nation holding each province, by province id, `UNASSIGNED` at sea. */
  readonly owners: Int32Array;
  readonly nations: readonly Nation[];
}

const landMask = (heights: Float32Array, seaLevel: number): Uint8Array =>
  Uint8Array.from(heights, (height) => Number(height > seaLevel));

const terrainReader =
  (grid: Grid, heights: Float32Array, seed: number) =>
  (cell: number): Terrain =>
    terrainAt(
      valueAt(heights, cell),
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
  const seaLevel = seaLevelFor(heights, LAND_FRACTION);
  const isLand = landMask(heights, seaLevel);

  const regions = emptyRegions(cellCount(grid));
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
    terrainReader(grid, heights, seed)
  );
  const capitals = pickCapitals(provinces, NATION_COUNT, random);
  return {
    cellProvince: regions,
    grid,
    nations: buildNations(capitals, random),
    owners: growOwners(provinces, capitals),
    provinces,
    seed,
  };
};
