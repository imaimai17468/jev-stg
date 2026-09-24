import { describe, expect, it } from "vite-plus/test";
import { LINE_WORLD, nation } from "../army-fixture";
import { UNASSIGNED } from "../spread";
import type { Basing } from "./air-bases";
import {
  baseWanted,
  basesHeldBy,
  capacityAt,
  crowdingEfficiency,
  openingAirBases,
  roomiestAmong,
  roomiestBase,
  stationedOf,
} from "./air-bases";
import type { Wing } from "./air-force";

/** Nation 0's planes over bases of `levels` it holds where `owners` gives it the ground. */
const basing = (
  levels: readonly number[],
  owners: readonly number[],
  stationed: readonly number[]
): Basing => ({
  bases: Uint8Array.from(levels),
  nation: 0,
  owners: Int32Array.from(owners),
  stationed: Float64Array.from(stationed),
});

/** A wing of fighters waiting at `base` with `planes` in it. */
const fighters = (planes: number, base: number): Wing => ({
  base,
  mission: "standby",
  model: "fighter-1",
  planes,
  region: UNASSIGNED,
});

describe(openingAirBases, () => {
  it("should open a base of two levels at the land region's hub and five at the capital when the sea region's hub gets none", () => {
    expect(
      openingAirBases({ ...LINE_WORLD, nations: [nation(0, 0)] })
    ).toStrictEqual(Uint8Array.from([5, 0, 0, 2, 0]));
  });
});

describe(capacityAt, () => {
  it("should host 200 planes a level when the province has a base", () => {
    expect(capacityAt(Uint8Array.from([0, 3]), 1)).toBe(600);
  });
});

describe(basesHeldBy, () => {
  it("should add up the levels on the nation's own ground alone when another nation holds a base too", () => {
    expect(
      basesHeldBy(Uint8Array.from([2, 3, 1]), Int32Array.from([0, 1, 0]), 0)
    ).toStrictEqual({ capacity: 600, levels: 3 });
  });
});

describe(crowdingEfficiency, () => {
  it.each<{
    condition: string;
    planes: number;
    capacity: number;
    kept: number;
  }>([
    { capacity: 200, condition: "the planes fit", kept: 1, planes: 100 },
    {
      capacity: 200,
      condition: "they are a tenth over",
      kept: 0.8,
      planes: 220,
    },
    { capacity: 200, condition: "they are half over", kept: 0, planes: 300 },
    { capacity: 0, condition: "there is no base", kept: 0, planes: 50 },
  ])("should keep $kept when $condition", ({ capacity, kept, planes }) => {
    expect(crowdingEfficiency(planes, capacity)).toBeCloseTo(kept);
  });
});

describe(stationedOf, () => {
  it("should add up the planes of the wings sharing a base when several wings fly from it", () => {
    expect(
      stationedOf([fighters(30, 0), fighters(20, 2), fighters(10, 0)], 3)
    ).toStrictEqual(Float64Array.from([40, 0, 20]));
  });
});

describe(roomiestBase, () => {
  it("should find none when the nation holds only ground with no base", () => {
    expect(roomiestBase(basing([0], [0], [0]))).toBe(UNASSIGNED);
  });

  it("should pass over a roomier base when another nation holds it", () => {
    expect(roomiestBase(basing([1, 5], [0, 1], [0, 0]))).toBe(0);
  });

  it("should keep the lowest province when two bases have the same room", () => {
    expect(roomiestBase(basing([2, 3], [0, 0], [0, 200]))).toBe(0);
  });

  it("should pick the base with the most room left when a later one has more", () => {
    expect(roomiestBase(basing([2, 3], [0, 0], [100, 100]))).toBe(1);
  });
});

describe(roomiestAmong, () => {
  it("should pass over a roomier base when it is not among the candidates", () => {
    expect(roomiestAmong(basing([5, 1, 2], [0, 0, 0], [0, 0, 0]), [1, 2])).toBe(
      2
    );
  });
});

describe(baseWanted, () => {
  it("should want no base when the planes fit under nine tenths of what the bases host", () => {
    expect(baseWanted(basing([2], [0], [100]), 7)).toBe(UNASSIGNED);
  });

  it("should fall back when every base the nation holds is built to the top", () => {
    expect(baseWanted(basing([10], [0], [2000]), 7)).toBe(7);
  });

  it("should want the base with the most levels below the top when the planes fill them", () => {
    expect(
      baseWanted(basing([4, 2, 10, 5], [0, 0, 0, 1], [800, 400, 2000, 0]), 7)
    ).toBe(0);
  });
});
