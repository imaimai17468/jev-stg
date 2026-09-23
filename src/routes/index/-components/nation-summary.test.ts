import { describe, expect, it } from "vite-plus/test";
import type { World } from "@/shared/entities/world";
import type { Province } from "@/shared/entities/world/provinces";
import { UNASSIGNED } from "@/shared/entities/world/spread";
import { summaryOf } from "./nation-summary";

const land = (
  id: number,
  terrain: "plains" | "hills",
  cells: number,
  neighbours: readonly number[]
): Province => ({ cells, id, kind: "land", neighbours, terrain, x: id, y: 0 });

/**
 * Two nations and a sea zone. Nation 0 holds two plains and a hill, one of its
 * provinces touches nation 1, another touches only its own, and a third touches
 * the water, which is every case the pass branches on.
 */
const WORLD: World = {
  cellProvince: Int32Array.from([0, 1, 2, 3, 4]),
  grid: { height: 1, width: 5 },
  nations: [
    { capital: 0, colour: { blue: 0, green: 0, red: 0 }, id: 0, name: "国0" },
    { capital: 2, colour: { blue: 0, green: 0, red: 0 }, id: 1, name: "国1" },
  ],
  owners: Int32Array.from([0, 0, 1, UNASSIGNED, 0]),
  provinces: [
    land(0, "plains", 4, [1, 2, 3]),
    land(1, "plains", 2, [0]),
    land(2, "hills", 3, [0]),
    { cells: 9, id: 3, kind: "sea", neighbours: [0], x: 3, y: 0 },
    land(4, "hills", 1, []),
  ],
  seed: 1,
};

describe(summaryOf, () => {
  it("should gather a nation's ground, terrain and borders when it holds some", () => {
    expect(summaryOf(WORLD, 0)).toStrictEqual({
      cells: 7,
      id: 0,
      name: "国0",
      neighbours: ["国1"],
      provinces: 3,
      terrain: [
        { provinces: 2, terrain: "plains" },
        { provinces: 1, terrain: "hills" },
      ],
    });
  });

  it("should read nothing when the world holds no nation with that id", () => {
    expect(summaryOf(WORLD, 9)).toStrictEqual({
      cells: 0,
      id: -1,
      name: "",
      neighbours: [],
      provinces: 0,
      terrain: [],
    });
  });
});
