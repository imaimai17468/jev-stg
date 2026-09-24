import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { airspaceOf } from "../airspace";
import { FUEL_CAPACITY } from "../fuel";
import type { World } from "../geography/world";
import { NO_MODIFIERS } from "../modifiers";
import { UNASSIGNED } from "../spread";
import type { Reach } from "./compliance";
import { FULL_REACH } from "./compliance";
import type { Footing, NationEconomy } from "./economy";
import {
  burnt,
  constructionProgress,
  NO_ECONOMY,
  producedOneDay,
  shareTransferred,
  outputOf,
  startEconomies,
  upkept,
  wantedKindOf,
  withConscription,
  withPlan,
  withTradeLaw,
} from "./economy";
import { NO_RESOURCES } from "./resources";

/** Thirty factories' worth of inland plains with nothing to dig, held by one nation. */
const PROVINCES: World["provinces"] = [
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
];

const WORLD: World = {
  airspace: airspaceOf(PROVINCES, 1),
  cellProvince: Int32Array.from([0, 1]),
  deposits: [NO_RESOURCES, NO_RESOURCES],
  grid: { height: 1, width: 2 },
  nations: [
    {
      capital: 0,
      colour: { blue: 0, green: 0, red: 0 },
      id: 0,
      leaning: "army",
      name: "国0",
    },
  ],
  provinces: PROVINCES,
  seed: 1,
};

/** Twenty civilian and ten military factories, no dockyard, and nobody living there. */
const INDUSTRY: NationEconomy = {
  buildSite: UNASSIGNED,
  burned: 0,
  civilianFactories: 20,
  conscription: "volunteer",
  construction: 0,
  dockyards: 0,
  equipment: 0,
  fuel: 0,
  manpower: 0,
  militaryFactories: 10,
  plan: "civilian",
  population: 0,
  raising: "mix",
  recruited: 0,
  roadSite: UNASSIGNED,
  roadworks: 0,
  tradeLaw: "export-focus",
  upkeepMet: 1,
};

/** A million people and no industry at all. */
const PEOPLE: NationEconomy = {
  buildSite: UNASSIGNED,
  burned: 0,
  civilianFactories: 0,
  conscription: "volunteer",
  construction: 0,
  dockyards: 0,
  equipment: 0,
  fuel: 0,
  manpower: 0,
  militaryFactories: 0,
  plan: "civilian",
  population: 1_000_000,
  raising: "mix",
  recruited: 0,
  roadSite: UNASSIGNED,
  roadworks: 0,
  tradeLaw: "export-focus",
  upkeepMet: 1,
};

const OWNERS = Int32Array.from([0, UNASSIGNED]);

/**
 * A nation with nothing researched, drawing on all it holds, short of no
 * resource, trading no factories away, and building a civilian factory on
 * ground with no infrastructure.
 */
const INLAND: Footing = {
  airSupplied: 1,
  aviation: 0,
  modifiers: NO_MODIFIERS,
  reach: FULL_REACH,
  site: Option.some({ infrastructure: 0, kind: "civilian", province: 0 }),
  supplied: 1,
  tiedUp: 0,
  traded: 0,
};

describe(startEconomies, () => {
  it("should split a nation's factories by its plan when the world opens", () => {
    expect(startEconomies(WORLD, OWNERS)).toStrictEqual([
      {
        buildSite: UNASSIGNED,
        burned: 0,
        civilianFactories: 25,
        conscription: "volunteer",
        construction: 0,
        dockyards: 0,
        equipment: 0,
        fuel: FUEL_CAPACITY,
        manpower: 450_000,
        militaryFactories: 5,
        plan: "civilian",
        population: 30_000_000,
        raising: "mix",
        recruited: 0,
        roadSite: UNASSIGNED,
        roadworks: 0,
        tradeLaw: "export-focus",
        upkeepMet: 1,
      },
    ]);
  });

  it("should open dockyards in proportion to the factories on the coast when the nation's land touches the sea", () => {
    const coast: World = {
      ...WORLD,
      provinces: [
        {
          cells: 1000,
          id: 0,
          kind: "land",
          neighbours: [1],
          terrain: "plains",
          x: 0,
          y: 0,
        },
        { cells: 4, id: 1, kind: "sea", neighbours: [0], x: 1, y: 0 },
      ],
    };

    expect(startEconomies(coast, OWNERS).at(0)?.dockyards).toBe(3);
  });
});

describe(withConscription, () => {
  it("should put the economy under the new law when the nation changes its conscription", () => {
    expect(withConscription(INDUSTRY, "extensive")).toStrictEqual({
      ...INDUSTRY,
      conscription: "extensive",
    });
  });
});

describe(withPlan, () => {
  it("should put the economy under the new plan when the nation changes it", () => {
    expect(withPlan(INDUSTRY, "military")).toStrictEqual({
      ...INDUSTRY,
      plan: "military",
    });
  });
});

describe(withTradeLaw, () => {
  it("should put the economy under the new law when the nation changes it", () => {
    expect(withTradeLaw(INDUSTRY, "closed-economy")).toStrictEqual({
      ...INDUSTRY,
      tradeLaw: "closed-economy",
    });
  });
});

describe(outputOf, () => {
  it("should put two a day into ships for every dockyard less the share lost when it lacks resources", () => {
    expect(
      outputOf(
        { ...INDUSTRY, dockyards: 5 },
        { ...INLAND, airSupplied: 0.1, supplied: 0.5 },
        "ships"
      )
    ).toBe(5);
  });

  it("should raise the ships' day by the dockyards modifier and not by production when the nation's modifiers raise both", () => {
    expect(
      outputOf(
        { ...INDUSTRY, dockyards: 5 },
        {
          ...INLAND,
          modifiers: { ...NO_MODIFIERS, dockyards: 0.5, production: 1 },
          supplied: 0.5,
        },
        "ships"
      )
    ).toBe(7.5);
  });

  it("should put three and a half a day into planes for every factory on them less the share their own resources lose when a fifth of the factories are on planes", () => {
    expect(
      outputOf(
        INDUSTRY,
        { ...INLAND, airSupplied: 0.5, aviation: 0.2, supplied: 0.1 },
        "aircraft"
      )
    ).toBeCloseTo(3.5, 10);
  });
});

describe(burnt, () => {
  it("should take the demand out of the stockpile and add it to what was burned when the stockpile covers it", () => {
    expect(burnt({ ...NO_ECONOMY, burned: 5, fuel: 100 }, 30)).toStrictEqual({
      ...NO_ECONOMY,
      burned: 35,
      fuel: 70,
    });
  });

  it("should empty the stockpile and count only what it held as burned when the demand runs past it", () => {
    expect(burnt({ ...NO_ECONOMY, fuel: 10 }, 88)).toStrictEqual({
      ...NO_ECONOMY,
      burned: 10,
      fuel: 0,
    });
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

describe(wantedKindOf, () => {
  const ARMING: NationEconomy = { ...INDUSTRY, plan: "total-war" };

  it.each([
    { coastal: 0, economy: INDUSTRY, kind: "civilian" },
    { coastal: 0, economy: ARMING, kind: "military" },
    { coastal: 1, economy: ARMING, kind: "dockyards" },
    { coastal: 1, economy: { ...ARMING, dockyards: 5 }, kind: "military" },
  ])(
    "should want a $kind building when the plan is $economy.plan and $coastal of the people live on the coast",
    ({ coastal, economy, kind }) => {
      expect(wantedKindOf(economy, coastal)).toBe(kind);
    }
  );
});

describe(producedOneDay, () => {
  it("should turn out equipment and advance the site when a day passes", () => {
    expect(producedOneDay(INDUSTRY, INLAND)).toStrictEqual({
      ...INDUSTRY,
      construction: 65,
      equipment: 50,
    });
  });

  it("should put a quarter of the day's construction into the roadworks when the nation has a road site", () => {
    expect(producedOneDay({ ...INDUSTRY, roadSite: 0 }, INLAND)).toStrictEqual({
      ...INDUSTRY,
      construction: 48.75,
      equipment: 50,
      roadSite: 0,
      roadworks: 16.25,
    });
  });

  it("should turn out more equipment and put more into the site when the nation's modifiers raise production and construction", () => {
    expect(
      producedOneDay(INDUSTRY, {
        ...INLAND,
        modifiers: {
          ...NO_MODIFIERS,
          construction: 0.2,
          production: 0.5,
        },
      })
    ).toStrictEqual({ ...INDUSTRY, construction: 78, equipment: 75 });
  });

  it("should turn out less and build slower when the nation's law calls up its workers", () => {
    expect(
      producedOneDay({ ...INDUSTRY, conscription: "all-adults" }, INLAND)
    ).toStrictEqual({
      ...INDUSTRY,
      conscription: "all-adults",
      construction: 45.5,
      equipment: 35,
    });
  });

  it("should finish the kind its site builds when the construction runs past the cost", () => {
    const arming: NationEconomy = { ...INDUSTRY, construction: 10_735 };

    expect(
      producedOneDay(arming, {
        ...INLAND,
        site: Option.some({ infrastructure: 0, kind: "military", province: 0 }),
      })
    ).toStrictEqual({
      ...arming,
      construction: 0,
      equipment: 50,
      militaryFactories: 11,
    });
  });

  it("should build as much faster as the infrastructure at its site lets it when that stands at level 5", () => {
    expect(
      producedOneDay(INDUSTRY, {
        ...INLAND,
        site: Option.some({ infrastructure: 5, kind: "civilian", province: 0 }),
      }).construction
    ).toBe(130);
  });

  it("should leave the construction where it stood when the nation has no free slot to build in", () => {
    expect(
      producedOneDay(
        { ...INDUSTRY, construction: 500 },
        { ...INLAND, site: Option.none() }
      ).construction
    ).toBe(500);
  });

  it("should put the whole day's construction into the roadworks when the nation has a road site and no free slot", () => {
    expect(
      producedOneDay(
        { ...INDUSTRY, roadSite: 0 },
        { ...INLAND, site: Option.none() }
      ).roadworks
    ).toBe(65);
  });

  it("should finish one factory and keep the rest for tomorrow when the construction runs past two", () => {
    const flush: NationEconomy = { ...INDUSTRY, construction: 2 * 10_800 };

    expect(producedOneDay(flush, INLAND)).toStrictEqual({
      ...flush,
      civilianFactories: 21,
      construction: 10_865,
      equipment: 50,
    });
  });

  it("should turn out less equipment when the military factories go short of resources", () => {
    expect(
      producedOneDay(INDUSTRY, { ...INLAND, supplied: 0.5 }).equipment
    ).toBe(25);
  });

  it("should turn out equipment only from the factories not on planes when a fifth of them are", () => {
    expect(
      producedOneDay(INDUSTRY, { ...INLAND, airSupplied: 0, aviation: 0.2 })
        .equipment
    ).toBeCloseTo(40, 10);
  });

  it("should put more into the site when the nation's trade hands it civilian factories", () => {
    expect(
      producedOneDay(INDUSTRY, { ...INLAND, traded: 4 }).construction
    ).toBe(85);
  });

  it("should put nothing into the site when the nation pays out more civilian factories than it has free", () => {
    expect(
      producedOneDay(INDUSTRY, { ...INLAND, traded: -20 }).construction
    ).toBe(0);
  });

  it("should finish a civilian factory when its site builds one", () => {
    const building: NationEconomy = { ...INDUSTRY, construction: 10_735 };

    expect(producedOneDay(building, INLAND)).toStrictEqual({
      ...building,
      civilianFactories: 21,
      construction: 0,
      equipment: 50,
    });
  });

  it("should grow the population and open the whole reach of the law when nobody has been called up yet", () => {
    expect(producedOneDay(PEOPLE, INLAND)).toStrictEqual({
      ...PEOPLE,
      manpower: 15_000.492813141684,
      population: 1_000_032.8542094456,
    });
  });

  it("should leave out everyone already called up when the nation has recruited some", () => {
    expect(
      producedOneDay({ ...PEOPLE, recruited: 10_000 }, INLAND).manpower
    ).toBe(5000.492813141684);
  });

  it("should leave nobody to call when the nation has called up more than its law reaches", () => {
    expect(
      producedOneDay({ ...PEOPLE, recruited: 20_000 }, INLAND).manpower
    ).toBe(0);
  });
});

describe("producedOneDay on occupied ground", () => {
  /** A nation drawing on half of what it holds. */
  const HALF: Reach = { factories: 0.5, manpower: 0.5 };

  it("should turn out and build half as much when it can work only half its factories", () => {
    expect(producedOneDay(INDUSTRY, { ...INLAND, reach: HALF })).toStrictEqual({
      ...INDUSTRY,
      construction: 32.5,
      equipment: 25,
    });
  });

  it("should reach half as many people when it can call up only half its people", () => {
    expect(
      producedOneDay(PEOPLE, { ...INLAND, reach: HALF }).manpower
    ).toBeCloseTo(7500.2464, 4);
  });
});

describe("producedOneDay under a wider reach", () => {
  it("should open a wider pool when the nation's modifiers widen the law's reach", () => {
    expect(
      producedOneDay(PEOPLE, {
        ...INLAND,
        modifiers: { ...NO_MODIFIERS, manpower: 1 },
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
      dockyards: 4,
      militaryFactories: 10,
      population: 1_000_000,
    },
    NO_ECONOMY,
    { ...NO_ECONOMY, population: 5 },
  ];

  it("should move the share's people to the winner and leave the factories where they are counted when ground changes hands", () => {
    expect(shareTransferred(HOLDERS, 0, 1, 0.25)).toStrictEqual([
      {
        ...NO_ECONOMY,
        civilianFactories: 20,
        dockyards: 4,
        militaryFactories: 10,
        population: 750_000,
      },
      { ...NO_ECONOMY, population: 250_000 },
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
      civilianFactories: 20,
      dockyards: 4,
      militaryFactories: 10,
      population: 0,
    });
  });
});
