import type { Grid } from "./grid";
import { cellX, cellY, valueAt, visitNeighbours } from "./grid";
import { itemAt } from "./lookup";
import type { Terrain } from "./terrain";

/** One land province: the smallest piece of ground an army can hold. */
export interface LandProvince {
  readonly kind: "land";
  readonly id: number;
  readonly terrain: Terrain;
  /** Where the province's name and its counters sit, in cell coordinates. */
  readonly x: number;
  readonly y: number;
  readonly cells: number;
  readonly neighbours: readonly number[];
}

/** One sea zone: the water a fleet occupies and a convoy crosses. */
export interface SeaProvince {
  readonly kind: "sea";
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly cells: number;
  readonly neighbours: readonly number[];
}

export type Province = LandProvince | SeaProvince;

/** Stands in for a list `itemAt` cannot reach. Nothing reads it but the caller. */
const NO_LIST: readonly number[] = [];

interface Aggregate {
  readonly sumX: Float64Array;
  readonly sumY: Float64Array;
  readonly counts: Int32Array;
  /**
   * Each touching pair as `province * count + neighbour`, so the pass below
   * records adjacency into one set instead of indexing a list per cell.
   */
  readonly pairs: ReadonlySet<number>;
}

/**
 * Sums each province's cells and collects the provinces it touches, in one pass
 * over the grid.
 */
const collect = (grid: Grid, regions: Int32Array, count: number): Aggregate => {
  const counts = new Int32Array(count);
  const sumX = new Float64Array(count);
  const sumY = new Float64Array(count);
  const pairs = new Set<number>();
  for (const [cell, province] of regions.entries()) {
    sumX[province] = valueAt(sumX, province) + cellX(grid, cell);
    sumY[province] = valueAt(sumY, province) + cellY(grid, cell);
    counts[province] = valueAt(counts, province) + 1;
    visitNeighbours(grid, cell, (neighbour) => {
      const other = valueAt(regions, neighbour);
      if (other !== province) {
        pairs.add(province * count + other);
      }
    });
  }
  return { counts, pairs, sumX, sumY };
};

/** The pairs regrouped into one sorted list of neighbours per province. */
const neighbourLists = (
  pairs: ReadonlySet<number>,
  count: number
): readonly (readonly number[])[] => {
  const lists = Array.from({ length: count }, (): number[] => []);
  for (const packed of pairs) {
    // A throwaway rather than the shared fallback, so a pair outside the range
    // discards its entry instead of appending to a list the next world reads.
    itemAt(lists, Math.floor(packed / count), []).push(packed % count);
  }
  return lists.map((list) => list.toSorted((left, right) => left - right));
};

const middleOf = (aggregate: Aggregate, province: number) => {
  // A seed another region overran leaves no cells behind, and the middle of
  // nothing would divide by zero.
  const cells = Math.max(1, valueAt(aggregate.counts, province));
  return {
    x: valueAt(aggregate.sumX, province) / cells,
    y: valueAt(aggregate.sumY, province) / cells,
  };
};

/**
 * Turns the region buffer into the provinces it holds.
 *
 * The land seeds take the low ids and the sea seeds the ones after them, so a
 * province's id alone says which kind it is and the painter can index a colour
 * table by it.
 */
export const buildProvinces = (
  grid: Grid,
  regions: Int32Array,
  landSeeds: readonly number[],
  seaSeeds: readonly number[],
  terrainOfCell: (cell: number) => Terrain
): readonly Province[] => {
  const count = landSeeds.length + seaSeeds.length;
  const aggregate = collect(grid, regions, count);
  const neighbours = neighbourLists(aggregate.pairs, count);
  const seedCells = Int32Array.from(landSeeds);
  return Array.from({ length: count }, (_, id): Province => {
    const shared = {
      ...middleOf(aggregate, id),
      cells: valueAt(aggregate.counts, id),
      id,
      neighbours: itemAt(neighbours, id, NO_LIST),
    };
    if (id >= landSeeds.length) {
      return { ...shared, kind: "sea" };
    }
    return {
      ...shared,
      kind: "land",
      terrain: terrainOfCell(valueAt(seedCells, id)),
    };
  });
};
