import { describe, expect, it } from "vite-plus/test";
import type { Grid } from "./grid";
import { sinkSmallIslands } from "./landmass";

const GRID: Grid = { height: 4, width: 8 };

/**
 * Two landmasses across the top two rows: a block of eight cells on the left and
 * a block of four on the right, with water everywhere else.
 */
const coast = (): Uint8Array =>
  Uint8Array.from([
    1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
  ]);

const DROWNED = Array.from({ length: 32 }, () => 0);

describe(sinkSmallIslands, () => {
  it("should sink the smaller landmass when it alone falls below the minimum", () => {
    const isLand = coast();

    sinkSmallIslands(GRID, isLand, 5);

    expect([...isLand]).toStrictEqual([
      1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0,
    ]);
  });

  it("should keep both landmasses when each clears the minimum", () => {
    const isLand = coast();

    sinkSmallIslands(GRID, isLand, 4);

    expect([...isLand]).toStrictEqual([...coast()]);
  });

  it("should sink every landmass when none clears the minimum", () => {
    const isLand = coast();

    sinkSmallIslands(GRID, isLand, 99);

    expect([...isLand]).toStrictEqual(DROWNED);
  });
});
