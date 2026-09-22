import { describe, expect, it } from "vite-plus/test";
import type { Grid } from "./grid";
import { cellX } from "./grid";
import { randomFromSeed } from "./random";
import {
  emptyRegions,
  fillUnassigned,
  growRegions,
  latticeSeeds,
  sinkUnreached,
} from "./regions";
import { UNASSIGNED } from "./spread";

const GRID: Grid = { height: 4, width: 4 };

const anywhere = () => true;

const grown = (
  mayEnter: (cell: number) => boolean,
  seeds: readonly number[]
): Int32Array => {
  const regions = emptyRegions(16);
  growRegions(GRID, regions, mayEnter, seeds, 0);
  return regions;
};

describe(emptyRegions, () => {
  it("should leave every cell unassigned when the buffer is new", () => {
    expect([...emptyRegions(3)]).toStrictEqual([
      UNASSIGNED,
      UNASSIGNED,
      UNASSIGNED,
    ]);
  });
});

describe(growRegions, () => {
  it("should give every cell to the seed that reaches it first when nothing blocks", () => {
    expect([...grown(anywhere, [0, 15])]).toStrictEqual([
      0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 1,
    ]);
  });

  it("should number the regions from the id it was given when the seeds are listed", () => {
    const regions = emptyRegions(16);
    growRegions(GRID, regions, anywhere, [5, 10], 7);

    expect([regions[5], regions[10]]).toStrictEqual([7, 8]);
  });

  it("should leave a cell unassigned when the mask refuses it", () => {
    const blocked = grown((cell) => cellX(GRID, cell) !== 3, [0]);

    expect(
      [...blocked].filter((region) => region === UNASSIGNED)
    ).toStrictEqual([UNASSIGNED, UNASSIGNED, UNASSIGNED, UNASSIGNED]);
  });
});

describe(sinkUnreached, () => {
  it("should sink only the cells no region reached when some were left out", () => {
    const regions = Int32Array.from([0, UNASSIGNED, 0, UNASSIGNED]);
    const isLand = Uint8Array.from([1, 1, 1, 1]);

    sinkUnreached(regions, isLand);

    expect([...isLand]).toStrictEqual([1, 0, 1, 0]);
  });
});

describe(fillUnassigned, () => {
  it("should hand every unreached cell to a region beside it when one borders it", () => {
    const regions = grown((cell) => cellX(GRID, cell) !== 3, [0]);

    fillUnassigned(GRID, regions);

    expect([...regions].every((region) => region === 0)).toBeTruthy();
  });
});

describe(latticeSeeds, () => {
  it("should draw one seed per lattice slot when the lattice is given", () => {
    expect(latticeSeeds(GRID, 2, 2, randomFromSeed(3))).toHaveLength(4);
  });

  it("should draw every seed inside the grid when the lattice covers it", () => {
    const seeds = latticeSeeds(GRID, 2, 2, randomFromSeed(3));

    expect(seeds.every((cell) => cell >= 0 && cell < 16)).toBeTruthy();
  });

  it("should draw the same seeds when the seed of the source is the same", () => {
    expect(latticeSeeds(GRID, 2, 2, randomFromSeed(3))).toStrictEqual(
      latticeSeeds(GRID, 2, 2, randomFromSeed(3))
    );
  });
});
