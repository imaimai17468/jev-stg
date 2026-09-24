import { describe, expect, it } from "vite-plus/test";
import {
  AT_WAR,
  division,
  LINE_GRAPH,
  LINE_OWNERS,
  LINE_WORLD,
} from "./army-fixture";
import type { Diplomacy } from "./diplomacy";
import { joined, openingDiplomacy } from "./diplomacy";
import { FULL_SUPPLY_LEVEL } from "./geography/infrastructure";
import type { World } from "./geography/world";
import { NO_MODIFIERS } from "./modifiers";
import { graphOf } from "./provinces";
import { UNASSIGNED } from "./spread";
import type { Lines } from "./supply";
import {
  postOf,
  reachOf,
  supplyNetwork,
  supplyStateOf,
  undersuppliedShare,
} from "./supply";

/** Nation 0 holds the capital's two provinces and the far coast, with nation 1 between them. */
const CUT_OFF_OWNERS = Int32Array.from([0, 0, 1, 0, UNASSIGNED]);

const PEACE: Diplomacy = openingDiplomacy(LINE_OWNERS, 2, []);

/** The line at peace, nobody in the field, nothing researched, every upkeep met. */
const LINES: Lines = {
  diplomacy: PEACE,
  divisions: [],
  graph: LINE_GRAPH,
  infrastructure: new Uint8Array(LINE_WORLD.provinces.length).fill(
    FULL_SUPPLY_LEVEL
  ),
  modifiers: [NO_MODIFIERS, NO_MODIFIERS],
  owners: LINE_OWNERS,
  shipped: [1, 1],
  upkeepMet: [1, 1],
  world: LINE_WORLD,
};

/** Nation 0's capacity in every province, to two places. */
const capacities = (lines: Lines): readonly number[] => {
  const network = supplyNetwork(lines);
  return lines.world.provinces.map(
    (province) =>
      Math.round(postOf(network, 0, province.id).capacity * 100) / 100
  );
};

describe(supplyNetwork, () => {
  it("should supply the nation's own ground, less the further it lies from the capital, when it is at peace", () => {
    expect(capacities(LINES)).toStrictEqual([40, 38, 0, 0, 0]);
  });

  it("should reach one province onto the enemy's ground when the nation is at war", () => {
    expect(
      capacities({ ...LINES, diplomacy: { ...PEACE, wars: AT_WAR } })
    ).toStrictEqual([40, 38, 36.1, 0, 0]);
  });

  it("should carry the supply across an ally's ground when the two share a faction", () => {
    const allies = joined(openingDiplomacy(LINE_OWNERS, 2, [0]), 1, 0);

    expect(capacities({ ...LINES, diplomacy: allies })).toStrictEqual([
      40, 38, 36.1, 34.29, 0,
    ]);
  });

  it("should let less through when the ground is mountains", () => {
    const mountainous: World = {
      ...LINE_WORLD,
      provinces: LINE_WORLD.provinces.map((province) => {
        if (province.kind === "land" && province.id === 1) {
          return { ...province, terrain: "mountains" };
        }
        return province;
      }),
    };

    expect(
      capacities({
        ...LINES,
        graph: graphOf(mountainous.provinces),
        world: mountainous,
      })
    ).toStrictEqual([40, 19, 0, 0, 0]);
  });

  it("should supply more when the province's infrastructure is built above the full-supply level", () => {
    expect(
      capacities({ ...LINES, infrastructure: Uint8Array.from([3, 5, 3, 3, 3]) })
    ).toStrictEqual([40, 45.6, 0, 0, 0]);
  });

  it("should supply more when the nation's modifiers raise its supply", () => {
    expect(
      capacities({
        ...LINES,
        modifiers: [{ ...NO_MODIFIERS, supply: 0.5 }, NO_MODIFIERS],
      })
    ).toStrictEqual([60, 57, 0, 0, 0]);
  });

  it("should supply a coast at a port's share of the capacity when it is cut off from the capital and the convoys bring everything", () => {
    expect(
      capacities({
        ...LINES,
        owners: CUT_OFF_OWNERS,
      })
    ).toStrictEqual([40, 38, 0, 21.33, 0]);
  });

  it("should supply a cut-off coast less when the convoys bring only half of what it needs", () => {
    expect(
      capacities({
        ...LINES,
        owners: CUT_OFF_OWNERS,
        shipped: [0.5, 1],
      })
    ).toStrictEqual([40, 38, 0, 10.67, 0]);
  });

  it("should supply nothing when the nation holds no ground to muster on", () => {
    expect(
      capacities({
        ...LINES,
        owners: Int32Array.from([1, 1, 1, 1, UNASSIGNED]),
      })
    ).toStrictEqual([0, 0, 0, 0, 0]);
  });
});

describe(reachOf, () => {
  it("should walk over land from the capital and over the sea from the coast the land never reached when the nation's ground is cut in two", () => {
    expect(reachOf({ ...LINES, owners: CUT_OFF_OWNERS }, 0)).toStrictEqual({
      cutOff: [3],
      overland: Int32Array.from([0, 1, UNASSIGNED, UNASSIGNED, UNASSIGNED]),
      overseas: Int32Array.from([
        UNASSIGNED,
        UNASSIGNED,
        UNASSIGNED,
        0,
        UNASSIGNED,
      ]),
      ports: [],
    });
  });

  it("should sail from the coast the land walk reached when the nation holds it", () => {
    expect(reachOf(LINES, 1).ports).toStrictEqual([3]);
  });
});

describe(postOf, () => {
  it("should give a division everything it needs when the province supplies more than stand in it", () => {
    expect(
      postOf(supplyNetwork({ ...LINES, divisions: [division({})] }), 0, 0).fill
    ).toBe(1);
  });

  it("should share the capacity among every division when more stand in the province than it supplies", () => {
    const crowded = Array.from({ length: 80 }, () => division({}));

    expect(
      postOf(supplyNetwork({ ...LINES, divisions: crowded }), 0, 0).fill
    ).toBe(0.5);
  });

  it("should cut every division's share when the depots met only part of the upkeep", () => {
    expect(
      postOf(supplyNetwork({ ...LINES, upkeepMet: [0.25, 1] }), 0, 0).fill
    ).toBe(0.25);
  });

  it("should give nothing when the nation's supply does not reach the province", () => {
    expect(postOf(supplyNetwork(LINES), 0, 3).fill).toBe(0);
  });
});

describe(supplyStateOf, () => {
  it("should read supplied when the division gets all it needs", () => {
    expect(supplyStateOf(1)).toBe("supplied");
  });

  it("should read short when the division gets at least half of it", () => {
    expect(supplyStateOf(0.5)).toBe("short");
  });

  it("should read starved when the division gets less than half of it", () => {
    expect(supplyStateOf(0.49)).toBe("starved");
  });
});

describe(undersuppliedShare, () => {
  it("should count the nation's divisions its supply falls short for when some stand beyond its reach", () => {
    const divisions = [
      division({ nation: 0, province: 0 }),
      division({ nation: 0, province: 3 }),
      division({ nation: 1, province: 3 }),
    ];

    expect(
      undersuppliedShare(supplyNetwork({ ...LINES, divisions }), divisions, 0)
    ).toBe(0.5);
  });

  it("should read none when the nation has no division in the field", () => {
    expect(undersuppliedShare(supplyNetwork(LINES), [], 0)).toBe(0);
  });
});
