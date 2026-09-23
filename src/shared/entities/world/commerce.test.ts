import { describe, expect, it } from "vite-plus/test";
import type { Stockpiles, Works } from "./commerce";
import { commerceOneDay, ledgersOf, needOf } from "./commerce";
import { FULL_REACH, startCompliance } from "./compliance";
import { openingDiplomacy } from "./diplomacy";
import type { NationEconomy } from "./economy";
import { NO_ECONOMY } from "./economy";
import type { World } from "./index";
import { NO_MODIFIERS } from "./modifiers";
import { NO_NAVY, withOrder } from "./navy";
import { NO_RESOURCES } from "./resources";
import { UNASSIGNED } from "./spread";
import type { Deal } from "./trade";
import { declared, noWars } from "./wars";

/**
 * A coastal mine of twenty steel a day held by nation 0, a barren coast held
 * by nation 1, and the sea zone between them.
 */
const WORLD: World = {
  cellProvince: Int32Array.from([0, 1, 2]),
  deposits: [{ ...NO_RESOURCES, steel: 20 }, NO_RESOURCES, NO_RESOURCES],
  grid: { height: 1, width: 3 },
  nations: [
    { capital: 0, colour: { blue: 0, green: 0, red: 0 }, id: 0, name: "国0" },
    { capital: 1, colour: { blue: 0, green: 0, red: 0 }, id: 1, name: "国1" },
  ],
  provinces: [
    {
      cells: 10,
      id: 0,
      kind: "land",
      neighbours: [2],
      terrain: "plains",
      x: 0,
      y: 0,
    },
    {
      cells: 10,
      id: 1,
      kind: "land",
      neighbours: [2],
      terrain: "plains",
      x: 2,
      y: 0,
    },
    { cells: 4, id: 2, kind: "sea", neighbours: [0, 1], x: 1, y: 0 },
  ],
  seed: 1,
};

const OWNERS = Int32Array.from([0, 1, UNASSIGNED]);

/**
 * Nation 0 with two dockyards on convoys and ten civilian factories, and
 * nation 1 with five military factories and ten civilian factories.
 */
const ECONOMIES: readonly NationEconomy[] = [
  { ...NO_ECONOMY, civilianFactories: 10, dockyards: 2 },
  { ...NO_ECONOMY, civilianFactories: 10, militaryFactories: 5 },
];

/** The two nations at peace on two islands, nation 1's convoys carrying half its trade. */
const WORKS: Works = {
  compliance: startCompliance(OWNERS),
  diplomacy: openingDiplomacy(OWNERS, 2, []),
  economies: ECONOMIES,
  homes: [2, 2],
  landmasses: Int32Array.from([0, 1, UNASSIGNED]),
  modifiers: [NO_MODIFIERS, NO_MODIFIERS],
  musters: [0, 1],
  navies: [NO_NAVY, { ...NO_NAVY, traded: 0.5 }],
  owners: OWNERS,
  reach: [FULL_REACH, FULL_REACH],
  world: WORLD,
};

/** The steel nation 1 buys from nation 0 overland. */
const OVERLAND_DEAL: Deal = {
  delivered: 10,
  exporter: 0,
  factories: 2,
  importer: 1,
  resource: "steel",
  units: 10,
};

/** The two nations' holdings with `deals` struck today. */
const stockpiles = (deals: readonly Deal[]): Stockpiles => ({
  compliance: WORKS.compliance,
  deals,
  economies: ECONOMIES,
  navies: WORKS.navies,
  owners: OWNERS,
  world: WORLD,
});

describe(needOf, () => {
  it("should add the military factories' share to what the ships on the slips take when the nation builds both", () => {
    expect(
      needOf(
        { ...NO_ECONOMY, dockyards: 2, militaryFactories: 5 },
        withOrder(NO_NAVY, "battleship")
      )
    ).toStrictEqual({ chromium: 2, steel: 12, tungsten: 2.5 });
  });
});

describe(commerceOneDay, () => {
  it("should deliver everything bought when the two capitals share a piece of land", () => {
    expect(
      commerceOneDay({
        ...WORKS,
        landmasses: Int32Array.from([0, 0, UNASSIGNED]),
      }).deals
    ).toStrictEqual([OVERLAND_DEAL]);
  });

  it("should deliver only what the buyer's convoys carry when the trade crosses the sea", () => {
    expect(commerceOneDay(WORKS).deals).toStrictEqual([
      { ...OVERLAND_DEAL, delivered: 5 },
    ]);
  });

  it("should strike no deal when the two nations are at war", () => {
    expect(
      commerceOneDay({
        ...WORKS,
        diplomacy: {
          ...WORKS.diplomacy,
          wars: declared(noWars(2), { one: 0, other: 1 }),
        },
      }).deals
    ).toStrictEqual([]);
  });

  it("should build with the civilian factories trade leaves each nation when the day passes", () => {
    expect(
      commerceOneDay(WORKS).economies.map((economy) => economy.construction)
    ).toStrictEqual([42.5, 22.5]);
  });

  it("should turn out less equipment when a nation goes short of what its factories take", () => {
    expect(
      commerceOneDay(WORKS).economies.map((economy) => economy.equipment)
    ).toStrictEqual([0, 6.25]);
  });

  it("should put the dockyards' day into the convoy on the slips when the nation has a port", () => {
    expect(commerceOneDay(WORKS).navies).toStrictEqual([
      { ...NO_NAVY, progress: 4 },
      { ...NO_NAVY, traded: 0.5 },
    ]);
  });
});

describe(ledgersOf, () => {
  it("should record each nation's mines, needs and trade and what it still lacks when a deal is struck", () => {
    expect(ledgersOf(stockpiles([OVERLAND_DEAL]))).toStrictEqual([
      {
        balance: {
          exported: { ...NO_RESOURCES, steel: 10 },
          factories: 2,
          imported: NO_RESOURCES,
        },
        extracted: { ...NO_RESOURCES, steel: 20 },
        need: { ...NO_RESOURCES, steel: 4 },
        shortage: 0,
      },
      {
        balance: {
          exported: NO_RESOURCES,
          factories: -2,
          imported: { ...NO_RESOURCES, steel: 10 },
        },
        extracted: NO_RESOURCES,
        need: { chromium: 0, steel: 10, tungsten: 2.5 },
        shortage: 0.25,
      },
    ]);
  });

  it("should lose every factory's output when a nation digs and buys none of what it needs", () => {
    expect(
      ledgersOf(stockpiles([])).map((ledger) => ledger.shortage)
    ).toStrictEqual([0, 1]);
  });
});
