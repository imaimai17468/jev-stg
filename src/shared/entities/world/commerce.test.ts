import { describe, expect, it } from "vite-plus/test";
import { airForceUnder, NO_AIR_FORCE } from "./air-force";
import { airspaceOf } from "./airspace";
import { OPENING_ARMOURY } from "./armoury";
import type { Stockpiles, Works } from "./commerce";
import { commerceOneDay, ledgersOf, needOf, NO_LEDGER } from "./commerce";
import { FULL_REACH, startCompliance } from "./compliance";
import { openingDiplomacy } from "./diplomacy";
import type { NationEconomy } from "./economy";
import { NO_ECONOMY } from "./economy";
import type { World } from "./index";
import { itemAt } from "./lookup";
import { NO_MODIFIERS } from "./modifiers";
import { fleetOf, NO_NAVY, withOrder } from "./navy";
import { NO_RESOURCES } from "./resources";
import { launched } from "./ships";
import { UNASSIGNED } from "./spread";
import type { Deal } from "./trade";
import { declared, noWars } from "./wars";

/**
 * A coastal mine of twenty steel a day held by nation 0, a barren coast held
 * by nation 1, and the sea zone between them.
 */
const PROVINCES: World["provinces"] = [
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
];

const WORLD: World = {
  airspace: airspaceOf(PROVINCES, 1),
  cellProvince: Int32Array.from([0, 1, 2]),
  deposits: [{ ...NO_RESOURCES, steel: 20 }, NO_RESOURCES, NO_RESOURCES],
  grid: { height: 1, width: 3 },
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
  airBases: new Uint8Array(3),
  airForces: [NO_AIR_FORCE, NO_AIR_FORCE],
  armouries: [],
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
  tiedUp: [0, 0],
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
  airForces: WORKS.airForces,
  armouries: WORKS.armouries,
  compliance: WORKS.compliance,
  deals,
  economies: ECONOMIES,
  modifiers: WORKS.modifiers,
  navies: WORKS.navies,
  owners: OWNERS,
  world: WORLD,
});

describe(needOf, () => {
  it("should add the military factories' share to what the ships on the slips take when the nation builds both", () => {
    expect(
      needOf({
        airForce: NO_AIR_FORCE,
        armoury: OPENING_ARMOURY,
        economy: { ...NO_ECONOMY, dockyards: 2, militaryFactories: 5 },
        navy: withOrder(NO_NAVY, "battleship"),
        refining: 0,
      })
    ).toStrictEqual({ ...NO_RESOURCES, chromium: 2, steel: 18, tungsten: 2.5 });
  });

  it("should take what the planes on the lines take from the factories on them and the oil to refine yesterday's fuel when the nation builds planes and burned fuel", () => {
    expect(
      needOf({
        airForce: airForceUnder(NO_AIR_FORCE, { aviation: "light" }),
        armoury: OPENING_ARMOURY,
        economy: { ...NO_ECONOMY, burned: 96, militaryFactories: 10 },
        navy: NO_NAVY,
        refining: 0,
      })
    ).toStrictEqual({
      aluminium: 6,
      chromium: 0,
      oil: 2,
      rubber: 2,
      steel: 16,
      tungsten: 4,
    });
  });

  it("should ask for less oil by the share its refining adds when the nation has refining technology", () => {
    expect(
      needOf({
        airForce: NO_AIR_FORCE,
        armoury: OPENING_ARMOURY,
        economy: { ...NO_ECONOMY, burned: 96 },
        navy: NO_NAVY,
        refining: 1,
      })
    ).toStrictEqual({ ...NO_RESOURCES, oil: 1 });
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

  it("should build with fewer civilian factories when a nation's intelligence agency ties some up", () => {
    expect(
      commerceOneDay({ ...WORKS, tiedUp: [5, 0] }).economies.map(
        (economy) => economy.construction
      )
    ).toStrictEqual([17.5, 22.5]);
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

  it("should launch the design the nation's armoury lays down when its dockyards finish a warship", () => {
    const building: Works = {
      ...WORKS,
      armouries: [
        {
          ...OPENING_ARMOURY,
          ships: { ...OPENING_ARMOURY.ships, destroyer: "destroyer-1" },
        },
      ],
      navies: [
        { ...withOrder(NO_NAVY, "destroyer"), progress: 910 },
        { ...NO_NAVY, traded: 0.5 },
      ],
    };

    expect(
      fleetOf(itemAt(commerceOneDay(building).navies, 0, NO_NAVY), "escort")
        .ships
    ).toStrictEqual([launched("destroyer-1")]);
  });
});

/**
 * Nation 1 with bauxite and rubber on its coast, an air base there, and
 * two fifths of its military factories a day short of finishing a fighter.
 */
const FLYING: Works = {
  ...WORKS,
  airBases: Uint8Array.from([0, 1, 0]),
  airForces: [
    NO_AIR_FORCE,
    { ...airForceUnder(NO_AIR_FORCE, { aviation: "heavy" }), progress: 20 },
  ],
  world: {
    ...WORLD,
    deposits: [
      { ...NO_RESOURCES, steel: 20 },
      { ...NO_RESOURCES, aluminium: 10, rubber: 10 },
      NO_RESOURCES,
    ],
  },
};

describe("commerceOneDay in the air", () => {
  it("should finish a fighter at the roomiest air base and carry the rest when the factories on planes pay for one", () => {
    expect(
      itemAt(commerceOneDay(FLYING).airForces, 1, NO_AIR_FORCE)
    ).toStrictEqual({
      aviation: "heavy",
      order: "fighter",
      progress: 3,
      wings: [
        {
          base: 1,
          mission: "standby",
          model: "fighter-1",
          planes: 1,
          region: UNASSIGNED,
        },
      ],
    });
  });

  it("should build no plane when the nation holds no air base", () => {
    expect(
      itemAt(
        commerceOneDay({ ...FLYING, airBases: new Uint8Array(3) }).airForces,
        1,
        NO_AIR_FORCE
      )
    ).toStrictEqual({
      ...airForceUnder(NO_AIR_FORCE, { aviation: "heavy" }),
      progress: 20,
    });
  });

  it("should turn out equipment only from the factories not on planes when two fifths are on planes", () => {
    expect(
      itemAt(commerceOneDay(FLYING).economies, 1, NO_ECONOMY).equipment
    ).toBeCloseTo(3.75, 10);
  });
});

describe("commerceOneDay refining fuel", () => {
  it("should refine the oil the nation digs into its fuel and start the day's burning afresh when it burned fuel yesterday", () => {
    const oily: Works = {
      ...WORKS,
      economies: [
        { ...NO_ECONOMY, burned: 96, civilianFactories: 10, dockyards: 2 },
        itemAt(ECONOMIES, 1, NO_ECONOMY),
      ],
      world: {
        ...WORLD,
        deposits: [
          { ...NO_RESOURCES, oil: 3, steel: 20 },
          NO_RESOURCES,
          NO_RESOURCES,
        ],
      },
    };
    const refinery = itemAt(commerceOneDay(oily).economies, 0, NO_ECONOMY);

    expect({ burned: refinery.burned, fuel: refinery.fuel }).toStrictEqual({
      burned: 0,
      fuel: 144,
    });
  });

  it("should refine each unit of oil into the share more fuel its refining adds when the nation has refining technology", () => {
    const refining: Works = {
      ...WORKS,
      modifiers: [{ ...NO_MODIFIERS, refining: 0.5 }, NO_MODIFIERS],
      world: {
        ...WORLD,
        deposits: [
          { ...NO_RESOURCES, oil: 3, steel: 20 },
          NO_RESOURCES,
          NO_RESOURCES,
        ],
      },
    };

    expect(itemAt(commerceOneDay(refining).economies, 0, NO_ECONOMY).fuel).toBe(
      216
    );
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
        need: { ...NO_RESOURCES, steel: 10, tungsten: 2.5 },
        shortage: 0.25,
      },
    ]);
  });

  it("should lose every factory's output when a nation digs and buys none of what it needs", () => {
    expect(
      ledgersOf(stockpiles([])).map((ledger) => ledger.shortage)
    ).toStrictEqual([0, 1]);
  });

  it("should record what the nation digs raised by its extraction when it has extraction technology", () => {
    expect(
      itemAt(
        ledgersOf({
          ...stockpiles([]),
          modifiers: [{ ...NO_MODIFIERS, extraction: 0.5 }, NO_MODIFIERS],
        }),
        0,
        NO_LEDGER
      ).extracted
    ).toStrictEqual({ ...NO_RESOURCES, steel: 30 });
  });

  it("should weigh each side's loss by its lines when the factories on planes hold their materials and the rest go short", () => {
    expect(
      itemAt(
        ledgersOf({
          ...stockpiles([]),
          airForces: FLYING.airForces,
          world: FLYING.world,
        }),
        1,
        NO_LEDGER
      ).shortage
    ).toBeCloseTo(0.6, 10);
  });
});
