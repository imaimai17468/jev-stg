import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { land, TWO_NATIONS, worldOf } from "../army-fixture";
import { NO_MODIFIERS } from "../modifiers";
import type { LandProvince } from "../provinces";
import { UNASSIGNED } from "../spread";
import type { NationEconomy } from "./economy";
import { NO_ECONOMY } from "./economy";
import type { Estate, Plants } from "./plants";
import {
  countedFrom,
  nextSiteOf,
  openingPlants,
  placedGains,
  plantsIn,
  siteOptionsOf,
  slotsHeldBy,
  buildingSlotsOf,
} from "./plants";

/**
 * Nation 0's inland province of ten cells, its inland province of thirty, and
 * its coast of ten off the sea zone at the end; nation 1 holds nothing.
 */
const WORLD = worldOf(TWO_NATIONS, [
  land(0, [1]),
  { ...land(1, [0, 2]), cells: 30 },
  land(2, [1, 3]),
  { cells: 10, id: 3, kind: "sea", neighbours: [2], x: 3, y: 1 },
]);

const OWNERS = Int32Array.from([0, 0, 0, UNASSIGNED]);

/** Buildings of each kind in each province, in the order the world numbers them. */
const plantsOf = (
  civilian: readonly number[],
  military: readonly number[],
  dockyards: readonly number[]
): Plants => ({
  civilian: Uint16Array.from(civilian),
  dockyards: Uint16Array.from(dockyards),
  military: Uint16Array.from(military),
});

const NONE = plantsOf([0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]);

const ESTATE: Estate = {
  grantedSlots: new Uint8Array(4),
  infrastructure: new Uint8Array(4),
  modifiers: [NO_MODIFIERS, NO_MODIFIERS],
  owners: OWNERS,
  plants: NONE,
  world: WORLD,
};

const NO_GRANTS = new Uint8Array(4);

/** Nation 0 counting `counts` of each kind, and nation 1 counting nothing. */
const counting = (
  civilianFactories: number,
  militaryFactories: number,
  dockyards: number
): readonly NationEconomy[] => [
  { ...NO_ECONOMY, civilianFactories, dockyards, militaryFactories },
  NO_ECONOMY,
];

describe(openingPlants, () => {
  it("should spread each kind over the nation's ground by its people and the dockyards over its coast when the world opens", () => {
    expect(
      openingPlants({ owners: OWNERS, world: WORLD }, counting(10, 5, 2))
    ).toStrictEqual(plantsOf([2, 6, 2, 0], [1, 3, 1, 0], [0, 0, 2, 0]));
  });
});

describe(plantsIn, () => {
  it("should add up every kind when a province holds several", () => {
    expect(plantsIn(plantsOf([0, 3], [0, 2], [0, 1]), 1)).toBe(6);
  });
});

describe(placedGains, () => {
  it("should put a new factory in the province with the fewest buildings for its people when the nation finishes one", () => {
    const estate = {
      ...ESTATE,
      plants: plantsOf([1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]),
    };

    expect(
      placedGains(estate, "built", {
        after: counting(4, 0, 0),
        before: counting(3, 0, 0),
      })
    ).toStrictEqual({
      grantedSlots: NO_GRANTS,
      plants: plantsOf([1, 2, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]),
    });
  });

  it("should put a new dockyard on the coast when the nation holds one", () => {
    expect(
      placedGains(ESTATE, "built", {
        after: counting(0, 0, 1),
        before: counting(0, 0, 0),
      })
    ).toStrictEqual({
      grantedSlots: NO_GRANTS,
      plants: plantsOf([0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 1, 0]),
    });
  });

  it("should put a new dockyard inland when the nation holds no coast", () => {
    const inland = {
      ...ESTATE,
      owners: Int32Array.from([0, 0, 1, UNASSIGNED]),
    };

    expect(
      placedGains(inland, "built", {
        after: counting(0, 0, 1),
        before: counting(0, 0, 0),
      })
    ).toStrictEqual({
      grantedSlots: NO_GRANTS,
      plants: plantsOf([0, 0, 0, 0], [0, 0, 0, 0], [0, 1, 0, 0]),
    });
  });

  it("should put a factory a focus hands over in the best province and add a slot there when every slot is taken", () => {
    const estate = {
      ...ESTATE,
      plants: plantsOf([2, 4, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0]),
    };

    expect(
      placedGains(estate, "granted", {
        after: counting(9, 0, 0),
        before: counting(8, 0, 0),
      })
    ).toStrictEqual({
      grantedSlots: Uint8Array.from([0, 1, 0, 0]),
      plants: plantsOf([2, 5, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0]),
    });
  });

  it("should place nothing when the nation that gained a factory holds no ground", () => {
    expect(
      placedGains(ESTATE, "built", {
        after: [NO_ECONOMY, { ...NO_ECONOMY, militaryFactories: 1 }],
        before: [NO_ECONOMY, NO_ECONOMY],
      })
    ).toStrictEqual({ grantedSlots: NO_GRANTS, plants: NONE });
  });

  it("should take nothing down when the nation counts fewer factories than before", () => {
    const estate = {
      ...ESTATE,
      plants: plantsOf([1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]),
    };

    expect(
      placedGains(estate, "built", {
        after: counting(1, 0, 0),
        before: counting(3, 0, 0),
      })
    ).toStrictEqual({ grantedSlots: NO_GRANTS, plants: estate.plants });
  });
});

describe(countedFrom, () => {
  it("should count each nation's buildings over the ground it holds when some of them stand on another's", () => {
    const plants = plantsOf([1, 2, 3, 0], [4, 0, 1, 0], [0, 0, 2, 0]);
    const owners = Int32Array.from([0, 0, 1, UNASSIGNED]);

    expect(
      countedFrom(plants, { owners, world: WORLD }, counting(9, 9, 9))
    ).toStrictEqual([
      {
        ...NO_ECONOMY,
        civilianFactories: 3,
        dockyards: 0,
        militaryFactories: 4,
      },
      {
        ...NO_ECONOMY,
        civilianFactories: 3,
        dockyards: 2,
        militaryFactories: 1,
      },
    ]);
  });
});

describe(buildingSlotsOf, () => {
  it.each([
    { cells: 3, slots: 0 },
    { cells: 5, slots: 1 },
    { cells: 10, slots: 2 },
    { cells: 300, slots: 12 },
  ])(
    "should give $slots slots when a plains province is $cells cells across",
    ({ cells, slots }) => {
      expect(
        buildingSlotsOf(ESTATE, {
          ...land(0, []),
          cells,
          kind: "land",
          terrain: "plains",
        })
      ).toBe(slots);
    }
  );

  /** Province 1 of the world, whose nine hundred thousand people give it four slots. */
  const PROVINCE: LandProvince = {
    cells: 30,
    id: 1,
    kind: "land",
    neighbours: [0, 2],
    terrain: "plains",
    x: 1,
    y: 0,
  };

  it.each([
    { granted: 0, growth: 0.2, slots: 4 },
    { granted: 0, growth: 1, slots: 8 },
    { granted: 2, growth: 0, slots: 6 },
  ])(
    "should give $slots slots when its holder's research grows them by $growth and focuses added $granted",
    ({ granted, growth, slots }) => {
      expect(
        buildingSlotsOf(
          {
            ...ESTATE,
            grantedSlots: Uint8Array.from([0, granted, 0, 0]),
            modifiers: [
              { ...NO_MODIFIERS, buildingSlots: growth },
              NO_MODIFIERS,
            ],
          },
          PROVINCE
        )
      ).toBe(slots);
    }
  );
});

describe(slotsHeldBy, () => {
  it("should add up the slots and the buildings over the ground the nation holds when it holds several provinces", () => {
    const estate = {
      ...ESTATE,
      plants: plantsOf([1, 2, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]),
    };

    expect(slotsHeldBy(estate, 0)).toStrictEqual({ total: 8, used: 5 });
  });
});

describe(nextSiteOf, () => {
  it("should build in the province with the highest infrastructure when several have room", () => {
    const estate = { ...ESTATE, infrastructure: Uint8Array.from([1, 0, 4, 0]) };

    expect(
      nextSiteOf(estate, 0, { chosen: UNASSIGNED, wanted: "civilian" })
    ).toStrictEqual(
      Option.some({ infrastructure: 4, kind: "civilian", province: 2 })
    );
  });

  it("should build a military factory when it wants a dockyard and its coast has no room", () => {
    const estate = {
      ...ESTATE,
      plants: plantsOf([0, 0, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0]),
    };

    expect(
      nextSiteOf(estate, 0, { chosen: UNASSIGNED, wanted: "dockyards" })
    ).toStrictEqual(
      Option.some({ infrastructure: 0, kind: "military", province: 1 })
    );
  });

  it("should build in the province its government chose when that one has room", () => {
    const estate = { ...ESTATE, infrastructure: Uint8Array.from([1, 0, 4, 0]) };

    expect(
      nextSiteOf(estate, 0, { chosen: 0, wanted: "civilian" })
    ).toStrictEqual(
      Option.some({ infrastructure: 1, kind: "civilian", province: 0 })
    );
  });

  it("should build in the best province when the one its government chose has no room", () => {
    const estate = {
      ...ESTATE,
      plants: plantsOf([2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]),
    };

    expect(
      nextSiteOf(estate, 0, { chosen: 0, wanted: "civilian" })
    ).toStrictEqual(
      Option.some({ infrastructure: 0, kind: "civilian", province: 1 })
    );
  });

  it("should build nothing when every slot it holds is taken", () => {
    const estate = {
      ...ESTATE,
      plants: plantsOf([2, 4, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0]),
    };

    expect(
      nextSiteOf(estate, 0, { chosen: UNASSIGNED, wanted: "civilian" })
    ).toStrictEqual(Option.none());
  });
});

describe(siteOptionsOf, () => {
  it("should offer the provinces with room, the fastest to build in first, when the nation holds several", () => {
    const estate = {
      ...ESTATE,
      infrastructure: Uint8Array.from([1, 0, 4, 0]),
      plants: plantsOf([2, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]),
    };

    expect(siteOptionsOf(estate, 0, 5)).toStrictEqual([
      { coastal: true, free: 2, infrastructure: 4, province: 2 },
      { coastal: false, free: 3, infrastructure: 0, province: 1 },
    ]);
  });
});
