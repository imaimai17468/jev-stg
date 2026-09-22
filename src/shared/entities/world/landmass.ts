import type { Grid } from "./grid";
import { cellCount, valueAt } from "./grid";
import { itemAt } from "./lookup";
import {
  overTheGrid,
  spreadFrom,
  UNASSIGNED,
  unassignedBuffer,
} from "./spread";

/** Which landmass each cell belongs to, and how large each of them is. */
interface Landmasses {
  readonly ofCell: Int32Array;
  readonly sizes: readonly number[];
}

/**
 * Every run of land that can be walked without crossing water, labelled.
 *
 * Each unlabelled land cell starts a new landmass and the spread claims the
 * rest of it, so the pass visits every cell once however the coastline runs.
 */
const landmassesOf = (grid: Grid, isLand: Uint8Array): Landmasses => {
  const ofCell = unassignedBuffer(cellCount(grid));
  const onLand = (cell: number) => valueAt(isLand, cell) === 1;
  let next = 0;
  for (const [cell, land] of isLand.entries()) {
    if (land !== 1) {
      continue;
    }
    if (valueAt(ofCell, cell) !== UNASSIGNED) {
      continue;
    }
    ofCell[cell] = next;
    spreadFrom(ofCell, overTheGrid(grid), onLand, [cell]);
    next += 1;
  }
  const sizes = new Int32Array(next);
  for (const landmass of ofCell) {
    if (landmass === UNASSIGNED) {
      continue;
    }
    sizes[landmass] = valueAt(sizes, landmass) + 1;
  }
  return { ofCell, sizes: [...sizes] };
};

/**
 * Sinks every landmass smaller than `minimumCells`.
 *
 * The coastline term breaks its own outline into fragments, which reads as an
 * archipelago rather than as a coast, and an island too small to hold a province
 * is scenery the simulation cannot use either. Sinking them leaves the coast
 * ragged without leaving the map speckled.
 */
export const sinkSmallIslands = (
  grid: Grid,
  isLand: Uint8Array,
  minimumCells: number
): void => {
  const landmasses = landmassesOf(grid, isLand);
  for (const [cell, landmass] of landmasses.ofCell.entries()) {
    if (landmass === UNASSIGNED) {
      continue;
    }
    if (itemAt(landmasses.sizes, landmass, 0) >= minimumCells) {
      continue;
    }
    isLand[cell] = 0;
  }
};
