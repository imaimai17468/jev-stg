import { describe, expect, it } from "vite-plus/test";
import { LINE_GRAPH, LINE_WORLD } from "./army-fixture";
import type { Grid } from "./grid";
import {
  buildProvinces,
  graphOf,
  isLand,
  neighboursOf,
  provinceTerrain,
} from "./provinces";
import type { Terrain } from "./terrain";

const GRID: Grid = { height: 4, width: 4 };

// Two land provinces side by side across the top half, one sea zone below them.
const REGIONS = Int32Array.from([
  0, 0, 1, 1, 0, 0, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2,
]);

const asPlains = (): Terrain => "plains";

const hilly = (cell: number): Terrain => {
  if (cell === 2) {
    return "hills";
  }
  return "plains";
};

describe(buildProvinces, () => {
  it("should read every province off the buffer when the seeds name them", () => {
    expect(buildProvinces(GRID, REGIONS, [0, 2], [8], asPlains)).toStrictEqual([
      {
        cells: 4,
        id: 0,
        kind: "land",
        neighbours: [1, 2],
        terrain: "plains",
        x: 0.5,
        y: 0.5,
      },
      {
        cells: 4,
        id: 1,
        kind: "land",
        neighbours: [0, 2],
        terrain: "plains",
        x: 2.5,
        y: 0.5,
      },
      {
        cells: 8,
        id: 2,
        kind: "sea",
        neighbours: [0, 1],
        x: 1.5,
        y: 2.5,
      },
    ]);
  });

  it("should read the terrain from the seed cell when the province is land", () => {
    const provinces = buildProvinces(GRID, REGIONS, [0, 2], [8], hilly);

    expect(
      provinces.map((province) => province.kind === "land" && province.terrain)
    ).toStrictEqual(["plains", "hills", false]);
  });

  it("should place a province at the origin when no cell was left to it", () => {
    // A fourth seed with nothing in the buffer answering to it, which is what a
    // seed another region overran leaves behind.
    const provinces = buildProvinces(GRID, REGIONS, [0, 2], [8, 12], asPlains);

    expect(provinces.at(3)).toStrictEqual({
      cells: 0,
      id: 3,
      kind: "sea",
      neighbours: [],
      x: 0,
      y: 0,
    });
  });
});

describe(provinceTerrain, () => {
  it("should read a land province's terrain when the id names one", () => {
    expect(provinceTerrain(LINE_WORLD.provinces, 1)).toBe("plains");
  });

  it("should stand plains in for a sea zone when the id names one", () => {
    expect(provinceTerrain(LINE_WORLD.provinces, 4)).toBe("plains");
  });

  it("should stand plains in when the id is beyond the list", () => {
    expect(provinceTerrain(LINE_WORLD.provinces, 99)).toBe("plains");
  });
});

describe(graphOf, () => {
  it("should flag the land and list each province's neighbours when the graph is built", () => {
    expect(graphOf(LINE_WORLD.provinces)).toStrictEqual({
      adjacency: [[1], [0, 2], [1, 3], [2, 4], [3]],
      land: Uint8Array.from([1, 1, 1, 1, 0]),
    });
  });
});

describe(neighboursOf, () => {
  it("should read nothing when the id is beyond the graph", () => {
    expect(neighboursOf(LINE_GRAPH, 99)).toStrictEqual([]);
  });
});

describe(isLand, () => {
  it("should read a sea zone as water when the graph is asked", () => {
    expect(isLand(LINE_GRAPH, 4)).toBeFalsy();
  });
});
