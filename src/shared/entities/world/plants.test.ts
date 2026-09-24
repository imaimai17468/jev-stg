import { describe, expect, it } from "vite-plus/test";
import { land, TWO_NATIONS, worldOf } from "./army-fixture";
import type { NationEconomy } from "./economy";
import { NO_ECONOMY } from "./economy";
import type { Estate, Plants } from "./plants";
import { countedFrom, openingPlants, placedGains, plantsIn } from "./plants";
import { UNASSIGNED } from "./spread";

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

const ESTATE: Estate = { owners: OWNERS, plants: NONE, world: WORLD };

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
      placedGains(estate, counting(3, 0, 0), counting(4, 0, 0))
    ).toStrictEqual(plantsOf([1, 2, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]));
  });

  it("should put a new dockyard on the coast when the nation holds one", () => {
    expect(
      placedGains(ESTATE, counting(0, 0, 0), counting(0, 0, 1))
    ).toStrictEqual(plantsOf([0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 1, 0]));
  });

  it("should put a new dockyard inland when the nation holds no coast", () => {
    const inland = {
      ...ESTATE,
      owners: Int32Array.from([0, 0, 1, UNASSIGNED]),
    };

    expect(
      placedGains(inland, counting(0, 0, 0), counting(0, 0, 1))
    ).toStrictEqual(plantsOf([0, 0, 0, 0], [0, 0, 0, 0], [0, 1, 0, 0]));
  });

  it("should place nothing when the nation that gained a factory holds no ground", () => {
    expect(
      placedGains(
        ESTATE,
        [NO_ECONOMY, NO_ECONOMY],
        [NO_ECONOMY, { ...NO_ECONOMY, militaryFactories: 1 }]
      )
    ).toStrictEqual(NONE);
  });

  it("should take nothing down when the nation counts fewer factories than before", () => {
    const estate = {
      ...ESTATE,
      plants: plantsOf([1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]),
    };

    expect(
      placedGains(estate, counting(3, 0, 0), counting(1, 0, 0))
    ).toStrictEqual(estate.plants);
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
