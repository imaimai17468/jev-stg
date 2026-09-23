import { describe, expect, it } from "vite-plus/test";
import { industryByNation } from "./industry";
import type { Province } from "./provinces";
import { UNASSIGNED } from "./spread";
import type { Terrain } from "./terrain";

const land = (id: number, terrain: Terrain, cells: number): Province => ({
  cells,
  id,
  kind: "land",
  neighbours: [],
  terrain,
  x: id,
  y: 0,
});

const sea = (id: number): Province => ({
  cells: 9,
  id,
  kind: "sea",
  neighbours: [],
  x: id,
  y: 0,
});

/**
 * A plain and a mountain held by nation 0, a plain nobody holds, and a sea
 * zone, which is every case the pass branches on.
 */
const PROVINCES: readonly Province[] = [
  land(0, "plains", 100),
  land(1, "mountains", 50),
  land(2, "plains", 20),
  sea(3),
];

const OWNERS = Int32Array.from([0, 0, UNASSIGNED, UNASSIGNED]);

describe(industryByNation, () => {
  it("should add up the people and the factories when a nation holds the land", () => {
    expect(industryByNation(PROVINCES, OWNERS, 2)).toStrictEqual([
      { factories: 3, population: 3_200_000 },
      { factories: 0, population: 0 },
    ]);
  });

  it("should round the factories once over the nation when its provinces are small", () => {
    const small = [land(0, "plains", 20), land(1, "plains", 20)];

    expect(industryByNation(small, Int32Array.from([0, 0]), 1)).toStrictEqual([
      { factories: 1, population: 1_200_000 },
    ]);
  });
});
