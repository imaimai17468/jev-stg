import type { Grid } from "./grid";
import { visitNeighbours } from "./grid";
import type { Random } from "./random";
import { spreadFrom, UNASSIGNED } from "./spread";

const overTheGrid =
  (grid: Grid) =>
  (from: number, visit: (neighbour: number) => void): void => {
    visitNeighbours(grid, from, visit);
  };

/**
 * Grows one region per seed outwards at equal speed, so each cell joins the
 * seed it can be reached from first and the regions come out close to equal in
 * area without their borders being straight.
 *
 * `regions` is written in place, because the caller grows land and then sea into
 * the same buffer.
 */
export const growRegions = (
  grid: Grid,
  regions: Int32Array,
  mayEnter: (cell: number) => boolean,
  seeds: readonly number[],
  firstRegionId: number
): void => {
  for (const [offset, cell] of seeds.entries()) {
    regions[cell] = firstRegionId + offset;
  }
  spreadFrom(regions, overTheGrid(grid), mayEnter, seeds);
};

/**
 * One cell per lattice cell, taken from a random point inside it.
 *
 * Jittering rather than taking each lattice cell's middle is what keeps the
 * regions from coming out as a visible checkerboard, and the lattice itself is
 * what keeps two seeds from landing on top of each other the way an
 * unconstrained draw does.
 */
export const latticeSeeds = (
  grid: Grid,
  columns: number,
  rows: number,
  random: Random
): readonly number[] => {
  const stepX = grid.width / columns;
  const stepY = grid.height / rows;
  return Array.from({ length: columns * rows }, (_, slot) => {
    const column = slot % columns;
    const row = Math.floor(slot / columns);
    const x = Math.min(
      grid.width - 1,
      Math.floor((column + random.unit()) * stepX)
    );
    const y = Math.min(
      grid.height - 1,
      Math.floor((row + random.unit()) * stepY)
    );
    return y * grid.width + x;
  });
};

/**
 * A buffer of `count` cells, every one unassigned, which is what the growth
 * above fills.
 */
export const emptyRegions = (count: number): Int32Array =>
  new Int32Array(count).fill(UNASSIGNED);

/**
 * Sinks the land no seed reached.
 *
 * An island smaller than the seed lattice's spacing can come out with no seed
 * on it at all, and leaving it unclaimed would put a hole in the map. It is
 * shallower than the province around it either way, so it becomes water.
 */
export const sinkUnreached = (
  regions: Int32Array,
  isLand: Uint8Array
): void => {
  for (const [cell, region] of regions.entries()) {
    if (region !== UNASSIGNED) {
      continue;
    }
    isLand[cell] = 0;
  }
};

const anywhere = () => true;

/**
 * Hands every cell no region reached to whichever region borders it.
 *
 * An enclosed lake can come out with no sea seed inside it, and the map has no
 * colour for a cell belonging to nothing. Growing from every assigned cell at
 * once means such water joins the region around it rather than a distant one.
 */
export const fillUnassigned = (grid: Grid, regions: Int32Array): void => {
  const assigned: number[] = [];
  for (const [cell, region] of regions.entries()) {
    if (region === UNASSIGNED) {
      continue;
    }
    assigned.push(cell);
  }
  spreadFrom(regions, overTheGrid(grid), anywhere, assigned);
};
