import { describe, expect, it } from "vite-plus/test";
import type { Reach } from "./compliance";
import { FULL_REACH } from "./compliance";
import type { NationEconomy } from "./economy";
import {
  constructionProgress,
  NO_ECONOMY,
  producedOneDay,
  shareTransferred,
  startEconomies,
  upkept,
} from "./economy";
import type { World } from "./index";
import { NO_MODIFIERS } from "./modifiers";
import { UNASSIGNED } from "./spread";

/** Thirty factories' worth of plains, held by one nation. */
const WORLD: World = {
  cellProvince: Int32Array.from([0, 1]),
  grid: { height: 1, width: 2 },
  nations: [
    { capital: 0, colour: { blue: 0, green: 0, red: 0 }, id: 0, name: "国0" },
  ],
  provinces: [
    {
      cells: 1000,
      id: 0,
      kind: "land",
      neighbours: [],
      terrain: "plains",
      x: 0,
      y: 0,
    },
    { cells: 4, id: 1, kind: "sea", neighbours: [], x: 1, y: 0 },
  ],
  seed: 1,
};

/** Twenty civilian and ten military factories, and nobody living there. */
const INDUSTRY: NationEconomy = {
  civilianFactories: 20,
  conscription: "volunteer",
  construction: 0,
  equipment: 0,
  manpower: 0,
  militaryFactories: 10,
  plan: "civilian",
  population: 0,
  recruited: 0,
  upkeepMet: 1,
};

/** A million people and no industry at all. */
const PEOPLE: NationEconomy = {
  civilianFactories: 0,
  conscription: "volunteer",
  construction: 0,
  equipment: 0,
  manpower: 0,
  militaryFactories: 0,
  plan: "civilian",
  population: 1_000_000,
  recruited: 0,
  upkeepMet: 1,
};

const OWNERS = Int32Array.from([0, UNASSIGNED]);

describe(startEconomies, () => {
  it("should split a nation's factories by its plan when the world opens", () => {
    expect(startEconomies(WORLD, OWNERS)).toStrictEqual([
      {
        civilianFactories: 25,
        conscription: "volunteer",
        construction: 0,
        equipment: 0,
        manpower: 450_000,
        militaryFactories: 5,
        plan: "civilian",
        population: 30_000_000,
        recruited: 0,
        upkeepMet: 1,
      },
    ]);
  });
});

describe(upkept, () => {
  it("should take every division's upkeep and meet all of it when the depots hold enough", () => {
    expect(upkept({ ...NO_ECONOMY, equipment: 100 }, 10)).toStrictEqual({
      ...NO_ECONOMY,
      equipment: 80,
      upkeepMet: 1,
    });
  });

  it("should empty the depots and meet only what they held when they hold too little", () => {
    expect(upkept({ ...NO_ECONOMY, equipment: 5 }, 10)).toStrictEqual({
      ...NO_ECONOMY,
      equipment: 0,
      upkeepMet: 0.25,
    });
  });

  it("should count the upkeep as met when the nation has no division in the field", () => {
    expect(upkept({ ...NO_ECONOMY, upkeepMet: 0.5 }, 0).upkeepMet).toBe(1);
  });
});

describe(constructionProgress, () => {
  it("should read half when the site has taken half the cost", () => {
    expect(constructionProgress({ ...INDUSTRY, construction: 5400 })).toBe(0.5);
  });
});

describe(producedOneDay, () => {
  it("should turn out equipment and advance the site when a day passes", () => {
    expect(
      producedOneDay(INDUSTRY, { modifiers: NO_MODIFIERS, reach: FULL_REACH })
    ).toStrictEqual({
      ...INDUSTRY,
      construction: 65,
      equipment: 50,
    });
  });

  it("should turn out more equipment and put more into the site when the nation's modifiers raise production and construction", () => {
    expect(
      producedOneDay(INDUSTRY, {
        modifiers: {
          ...NO_MODIFIERS,
          construction: 0.2,
          production: 0.5,
        },
        reach: FULL_REACH,
      })
    ).toStrictEqual({ ...INDUSTRY, construction: 78, equipment: 75 });
  });

  it("should turn out less and build slower when the nation's law calls up its workers", () => {
    expect(
      producedOneDay(
        { ...INDUSTRY, conscription: "all-adults" },
        { modifiers: NO_MODIFIERS, reach: FULL_REACH }
      )
    ).toStrictEqual({
      ...INDUSTRY,
      conscription: "all-adults",
      construction: 45.5,
      equipment: 35,
    });
  });

  it("should finish a military factory when the nation holds less of them than its plan wants", () => {
    const arming: NationEconomy = {
      ...INDUSTRY,
      construction: 10_705,
      plan: "total-war",
    };

    expect(
      producedOneDay(arming, { modifiers: NO_MODIFIERS, reach: FULL_REACH })
    ).toStrictEqual({
      ...arming,
      construction: 0,
      equipment: 50,
      militaryFactories: 11,
    });
  });

  it("should finish a civilian factory when the nation already holds the share its plan wants", () => {
    const building: NationEconomy = { ...INDUSTRY, construction: 10_735 };

    expect(
      producedOneDay(building, { modifiers: NO_MODIFIERS, reach: FULL_REACH })
    ).toStrictEqual({
      ...building,
      civilianFactories: 21,
      construction: 0,
      equipment: 50,
    });
  });

  it("should grow the population and open the whole reach of the law when nobody has been called up yet", () => {
    expect(
      producedOneDay(PEOPLE, { modifiers: NO_MODIFIERS, reach: FULL_REACH })
    ).toStrictEqual({
      ...PEOPLE,
      manpower: 15_000.492813141684,
      population: 1_000_032.8542094456,
    });
  });

  it("should leave out everyone already called up when the nation has recruited some", () => {
    expect(
      producedOneDay(
        { ...PEOPLE, recruited: 10_000 },
        { modifiers: NO_MODIFIERS, reach: FULL_REACH }
      ).manpower
    ).toBe(5000.492813141684);
  });

  it("should leave nobody to call when the nation has called up more than its law reaches", () => {
    expect(
      producedOneDay(
        { ...PEOPLE, recruited: 20_000 },
        { modifiers: NO_MODIFIERS, reach: FULL_REACH }
      ).manpower
    ).toBe(0);
  });
});

describe("producedOneDay on occupied ground", () => {
  /** A nation drawing on half of what it holds. */
  const HALF: Reach = { factories: 0.5, manpower: 0.5 };

  it("should turn out and build half as much when it can work only half its factories", () => {
    expect(
      producedOneDay(INDUSTRY, { modifiers: NO_MODIFIERS, reach: HALF })
    ).toStrictEqual({ ...INDUSTRY, construction: 32.5, equipment: 25 });
  });

  it("should reach half as many people when it can call up only half its people", () => {
    expect(
      producedOneDay(PEOPLE, { modifiers: NO_MODIFIERS, reach: HALF }).manpower
    ).toBeCloseTo(7500.2464, 4);
  });
});

describe("producedOneDay under a wider reach", () => {
  it("should open a wider pool when the nation's modifiers widen the law's reach", () => {
    expect(
      producedOneDay(PEOPLE, {
        modifiers: { ...NO_MODIFIERS, manpower: 1 },
        reach: FULL_REACH,
      }).manpower
    ).toBeCloseTo(30_000.9856, 4);
  });
});

describe(shareTransferred, () => {
  /** A loser worth taking a share of, a winner with nothing, and a bystander. */
  const HOLDERS: readonly NationEconomy[] = [
    {
      ...NO_ECONOMY,
      civilianFactories: 20,
      militaryFactories: 10,
      population: 1_000_000,
    },
    NO_ECONOMY,
    { ...NO_ECONOMY, population: 5 },
  ];

  it("should move the share's people and factories to the winner when ground changes hands", () => {
    expect(shareTransferred(HOLDERS, 0, 1, 0.25)).toStrictEqual([
      {
        ...NO_ECONOMY,
        civilianFactories: 15,
        militaryFactories: 7,
        population: 750_000,
      },
      {
        ...NO_ECONOMY,
        civilianFactories: 5,
        militaryFactories: 3,
        population: 250_000,
      },
      { ...NO_ECONOMY, population: 5 },
    ]);
  });

  it("should leave everyone the loser has called up with the loser when ground changes hands", () => {
    const drafted = [
      { ...NO_ECONOMY, population: 100, recruited: 20_000 },
      NO_ECONOMY,
    ];

    expect(
      shareTransferred(drafted, 0, 1, 0.5).map((economy) => economy.recruited)
    ).toStrictEqual([20_000, 0]);
  });

  it("should move no more than the loser holds when the share runs over one", () => {
    expect(shareTransferred(HOLDERS, 0, 1, 3).at(0)).toStrictEqual({
      ...NO_ECONOMY,
      civilianFactories: 0,
      militaryFactories: 0,
      population: 0,
    });
  });
});
