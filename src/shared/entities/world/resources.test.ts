import { describe, expect, it } from "vite-plus/test";
import type { Compliance } from "./compliance";
import type { World } from "./index";
import type { Province } from "./provinces";
import type { ResourceNeed } from "./resources";
import {
  depositsOf,
  extractedBy,
  NO_RESOURCES,
  outputShareWhenShort,
  plus,
  scaled,
  shortfall,
  totalOf,
} from "./resources";
import { UNASSIGNED } from "./spread";
import type { Terrain } from "./terrain";

const land = (id: number, terrain: Terrain): Province => ({
  cells: 10,
  id,
  kind: "land",
  neighbours: [],
  terrain,
  x: id,
  y: 0,
});

/** Ten steel, two tungsten and one chromium a day. */
const MINE: ResourceNeed = { chromium: 1, steel: 10, tungsten: 2 };

/**
 * A mine nation 0 holds at home, a mine nation 1 has taken from nation 0, a
 * mine nobody holds, and a sea zone.
 */
const WORLD: World = {
  cellProvince: Int32Array.from([0, 1, 2, 3]),
  deposits: [MINE, MINE, MINE, NO_RESOURCES],
  grid: { height: 1, width: 4 },
  nations: [
    { capital: 0, colour: { blue: 0, green: 0, red: 0 }, id: 0, name: "国0" },
    { capital: 1, colour: { blue: 0, green: 0, red: 0 }, id: 1, name: "国1" },
  ],
  provinces: [
    land(0, "plains"),
    land(1, "mountains"),
    land(2, "plains"),
    { cells: 4, id: 3, kind: "sea", neighbours: [], x: 3, y: 0 },
  ],
  seed: 1,
};

const OWNERS = Int32Array.from([0, 1, UNASSIGNED, UNASSIGNED]);

/** Nation 1 holding nation 0's province 1 at no compliance. */
const COMPLIANCE: Compliance = {
  holders: Int32Array.from([0, 1, UNASSIGNED, UNASSIGNED]),
  levels: Float32Array.from([1, 0, 1, 1]),
  natives: Int32Array.from([0, 0, UNASSIGNED, UNASSIGNED]),
};

describe(plus, () => {
  it("should add each resource to the same resource when two needs are summed", () => {
    expect(plus(MINE, { chromium: 2, steel: 3, tungsten: 4 })).toStrictEqual({
      chromium: 3,
      steel: 13,
      tungsten: 6,
    });
  });
});

describe(totalOf, () => {
  it("should add every need resource by resource when several are summed", () => {
    expect(
      totalOf([MINE, MINE, { chromium: 0, steel: 1, tungsten: 0 }])
    ).toStrictEqual({
      chromium: 2,
      steel: 21,
      tungsten: 4,
    });
  });

  it("should come to nothing when there is no need to sum", () => {
    expect(totalOf([])).toStrictEqual(NO_RESOURCES);
  });
});

describe(scaled, () => {
  it("should multiply each resource when a need is scaled", () => {
    expect(scaled(MINE, 2)).toStrictEqual({
      chromium: 2,
      steel: 20,
      tungsten: 4,
    });
  });
});

describe(depositsOf, () => {
  it("should give a sea zone nothing when the deposits are drawn", () => {
    expect(depositsOf(WORLD.provinces, 1).at(3)).toStrictEqual(NO_RESOURCES);
  });

  it("should give a plain no tungsten and no chromium when its terrain holds only iron", () => {
    const plain = depositsOf(WORLD.provinces, 1).at(0);

    expect([plain?.chromium, plain?.tungsten]).toStrictEqual([0, 0]);
  });

  it("should draw the same deposits when the seed is the same", () => {
    expect(depositsOf(WORLD.provinces, 5)).toStrictEqual(
      depositsOf(WORLD.provinces, 5)
    );
  });
});

describe(extractedBy, () => {
  it("should dig a home mine in full and an occupied one at its compliance when one nation holds its own mine and another an occupied one", () => {
    expect(extractedBy(WORLD, OWNERS, COMPLIANCE)).toStrictEqual([
      MINE,
      scaled(MINE, 0.25),
    ]);
  });
});

describe(outputShareWhenShort, () => {
  it.each<{
    condition: string;
    factories: number;
    missing: ResourceNeed;
    share: number;
  }>([
    {
      condition: "nothing is missing",
      factories: 20,
      missing: NO_RESOURCES,
      share: 1,
    },
    {
      condition: "two units a day are missing",
      factories: 20,
      missing: { chromium: 1, steel: 1, tungsten: 0 },
      share: 0.95,
    },
    {
      condition: "more is missing than every line can lose",
      factories: 5,
      missing: { chromium: 0, steel: 10, tungsten: 0 },
      share: 0,
    },
    {
      condition: "a resource is in surplus",
      factories: 20,
      missing: { chromium: 0, steel: -10, tungsten: 0 },
      share: 1,
    },
    {
      condition: "the nation holds no factories and misses nothing",
      factories: 0,
      missing: NO_RESOURCES,
      share: 1,
    },
  ])(
    "should keep $share of the output when $condition",
    ({ factories, missing, share }) => {
      expect(outputShareWhenShort(factories, missing)).toBeCloseTo(share, 10);
    }
  );
});

describe(shortfall, () => {
  it("should count only what the holdings lack when some resources are in surplus", () => {
    expect(
      shortfall(MINE, { chromium: 3, steel: 4, tungsten: 2 })
    ).toStrictEqual({ chromium: 0, steel: 6, tungsten: 0 });
  });
});
