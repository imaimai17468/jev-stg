import { describe, expect, it } from "vite-plus/test";
import type { Grid } from "./grid";
import { cellCount, cellX, cellY, valueAt, visitNeighbours } from "./grid";

const GRID: Grid = { height: 3, width: 4 };

const neighboursOf = (cell: number): readonly number[] => {
  const seen: number[] = [];
  visitNeighbours(GRID, cell, (neighbour) => {
    seen.push(neighbour);
  });
  return seen;
};

describe(valueAt, () => {
  it("should answer the stored value when the index is inside the buffer", () => {
    expect(valueAt(Int32Array.from([7, 8, 9]), 1)).toBe(8);
  });

  it("should answer zero when the index is past the end", () => {
    expect(valueAt(Int32Array.from([7, 8, 9]), 5)).toBe(0);
  });
});

describe(cellCount, () => {
  it("should multiply the two sides when the grid is rectangular", () => {
    expect(cellCount(GRID)).toBe(12);
  });
});

describe("cellX and cellY", () => {
  it("should place a cell on its row and column when the index is inside the grid", () => {
    expect({ x: cellX(GRID, 6), y: cellY(GRID, 6) }).toStrictEqual({
      x: 2,
      y: 1,
    });
  });
});

describe(visitNeighbours, () => {
  it("should give all four neighbours when the cell is surrounded", () => {
    expect(neighboursOf(5)).toStrictEqual([4, 6, 1, 9]);
  });

  it("should leave out the left neighbour when the cell is on the first column", () => {
    expect(neighboursOf(4)).toStrictEqual([5, 0, 8]);
  });

  it("should leave out the right neighbour when the cell is on the last column", () => {
    expect(neighboursOf(7)).toStrictEqual([6, 3, 11]);
  });

  it("should leave out the neighbour above when the cell is on the first row", () => {
    expect(neighboursOf(1)).toStrictEqual([0, 2, 5]);
  });

  it("should leave out the neighbour below when the cell is on the last row", () => {
    expect(neighboursOf(9)).toStrictEqual([8, 10, 5]);
  });
});
