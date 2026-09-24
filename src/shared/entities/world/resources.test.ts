import { describe, expect, it } from "vite-plus/test";
import { airspaceOf } from "./airspace";
import type { Compliance } from "./compliance";
import type { World } from "./index";
import { NO_MODIFIERS } from "./modifiers";
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
  splitByLine,
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

/**
 * Ten steel, two tungsten, one chromium, three aluminium, four rubber and five
 * oil a day.
 */
const MINE: ResourceNeed = {
  aluminium: 3,
  chromium: 1,
  oil: 5,
  rubber: 4,
  steel: 10,
  tungsten: 2,
};

const PROVINCES: readonly Province[] = [
  land(0, "plains"),
  land(1, "mountains"),
  land(2, "plains"),
  { cells: 4, id: 3, kind: "sea", neighbours: [], x: 3, y: 0 },
];

/**
 * A mine nation 0 holds at home, a mine nation 1 has taken from nation 0, a
 * mine nobody holds, and a sea zone.
 */
const WORLD: World = {
  airspace: airspaceOf(PROVINCES, 1),
  cellProvince: Int32Array.from([0, 1, 2, 3]),
  deposits: [MINE, MINE, MINE, NO_RESOURCES],
  grid: { height: 1, width: 4 },
  nations: [
    {
      capital: 0,
      colour: { blue: 0, green: 0, red: 0 },
      id: 0,
      leaning: "army",
      name: "国0",
    },
    {
      capital: 1,
      colour: { blue: 0, green: 0, red: 0 },
      id: 1,
      leaning: "army",
      name: "国1",
    },
  ],
  provinces: PROVINCES,
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
    expect(
      plus(MINE, {
        aluminium: 1,
        chromium: 2,
        oil: 6,
        rubber: 5,
        steel: 3,
        tungsten: 4,
      })
    ).toStrictEqual({
      aluminium: 4,
      chromium: 3,
      oil: 11,
      rubber: 9,
      steel: 13,
      tungsten: 6,
    });
  });
});

describe(totalOf, () => {
  it("should add every need resource by resource when several are summed", () => {
    expect(
      totalOf([MINE, MINE, { ...NO_RESOURCES, oil: 1, steel: 1 }])
    ).toStrictEqual({
      aluminium: 6,
      chromium: 2,
      oil: 11,
      rubber: 8,
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
      aluminium: 6,
      chromium: 2,
      oil: 10,
      rubber: 8,
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

  it("should lay the ore where it lay before the oil, the bauxite and the rubber came in when two mountains are drawn", () => {
    expect(
      depositsOf([land(0, "mountains"), land(1, "mountains")], 1)
    ).toStrictEqual([
      { aluminium: 0, chromium: 1, oil: 0, rubber: 0, steel: 9, tungsten: 14 },
      { aluminium: 3, chromium: 2, oil: 0, rubber: 0, steel: 7, tungsten: 6 },
    ]);
  });

  it("should draw the same deposits when the seed is the same", () => {
    expect(depositsOf(WORLD.provinces, 5)).toStrictEqual(
      depositsOf(WORLD.provinces, 5)
    );
  });
});

describe(extractedBy, () => {
  it("should dig a home mine in full and an occupied one at its compliance when one nation holds its own mine and another an occupied one", () => {
    expect(extractedBy(WORLD, OWNERS, COMPLIANCE, [])).toStrictEqual([
      MINE,
      scaled(MINE, 0.25),
    ]);
  });

  it("should raise what a nation digs by the extraction its modifiers add when it has extraction technology", () => {
    expect(
      extractedBy(WORLD, OWNERS, COMPLIANCE, [
        { ...NO_MODIFIERS, extraction: 0.5 },
      ])
    ).toStrictEqual([scaled(MINE, 1.5), scaled(MINE, 0.25)]);
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
      missing: { ...NO_RESOURCES, chromium: 1, steel: 1 },
      share: 0.95,
    },
    {
      condition: "more is missing than every line can lose",
      factories: 5,
      missing: { ...NO_RESOURCES, steel: 10 },
      share: 0,
    },
    {
      condition: "a resource is in surplus",
      factories: 20,
      missing: { ...NO_RESOURCES, steel: -10 },
      share: 1,
    },
    {
      condition: "only oil is missing",
      factories: 20,
      missing: { ...NO_RESOURCES, oil: 10 },
      share: 1,
    },
    {
      condition: "aluminium and rubber are missing",
      factories: 20,
      missing: { ...NO_RESOURCES, aluminium: 1, rubber: 1 },
      share: 0.95,
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
      shortfall(MINE, {
        aluminium: 1,
        chromium: 3,
        oil: 5,
        rubber: 6,
        steel: 4,
        tungsten: 2,
      })
    ).toStrictEqual({
      aluminium: 2,
      chromium: 0,
      oil: 0,
      rubber: 0,
      steel: 6,
      tungsten: 0,
    });
  });
});

describe(splitByLine, () => {
  it("should hand the aluminium and the rubber to the planes and the rest to the arms when a need is split", () => {
    expect(splitByLine(MINE)).toStrictEqual({
      aircraft: { ...NO_RESOURCES, aluminium: 3, rubber: 4 },
      arms: { ...MINE, aluminium: 0, rubber: 0 },
    });
  });
});
