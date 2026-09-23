import { describe, expect, it } from "vite-plus/test";
import type { NationEconomy } from "./economy";
import {
  constructionProgress,
  producedOneDay,
  startEconomies,
} from "./economy";
import type { World } from "./index";
import { UNASSIGNED } from "./spread";

/** Thirty factories' worth of plains, held by one nation. */
const WORLD: World = {
  cellProvince: Int32Array.from([0, 1]),
  grid: { height: 1, width: 2 },
  nations: [
    { capital: 0, colour: { blue: 0, green: 0, red: 0 }, id: 0, name: "国0" },
  ],
  owners: Int32Array.from([0, UNASSIGNED]),
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
};

describe(startEconomies, () => {
  it("should split a nation's factories by its plan when the world opens", () => {
    expect(startEconomies(WORLD)).toStrictEqual([
      {
        civilianFactories: 25,
        conscription: "volunteer",
        construction: 0,
        equipment: 0,
        manpower: 450_000,
        militaryFactories: 5,
        plan: "civilian",
        population: 30_000_000,
      },
    ]);
  });
});

describe(constructionProgress, () => {
  it("should read half when the site has taken half the cost", () => {
    expect(constructionProgress({ ...INDUSTRY, construction: 5400 })).toBe(0.5);
  });
});

describe(producedOneDay, () => {
  it("should turn out equipment and advance the site when a day passes", () => {
    expect(producedOneDay(INDUSTRY)).toStrictEqual({
      ...INDUSTRY,
      construction: 65,
      equipment: 50,
    });
  });

  it("should finish a military factory when the nation holds less of them than its plan wants", () => {
    const arming: NationEconomy = {
      ...INDUSTRY,
      construction: 10_705,
      plan: "total-war",
    };

    expect(producedOneDay(arming)).toStrictEqual({
      ...arming,
      construction: 0,
      equipment: 50,
      militaryFactories: 11,
    });
  });

  it("should finish a civilian factory when the nation already holds the share its plan wants", () => {
    const building: NationEconomy = { ...INDUSTRY, construction: 10_735 };

    expect(producedOneDay(building)).toStrictEqual({
      ...building,
      civilianFactories: 21,
      construction: 0,
      equipment: 50,
    });
  });

  it("should grow the population and recover the manpower when a day passes", () => {
    expect(producedOneDay(PEOPLE)).toStrictEqual({
      ...PEOPLE,
      manpower: 8.213822211165878,
      population: 1_000_032.8542094456,
    });
  });

  it("should hold the manpower at the cap when the law reaches no further", () => {
    const full: NationEconomy = { ...PEOPLE, manpower: 15_000 };

    expect(producedOneDay(full)).toStrictEqual({
      ...full,
      manpower: 15_000.492813141684,
      population: 1_000_032.8542094456,
    });
  });
});
