import { describe, expect, it } from "vite-plus/test";
import type { NationEconomy } from "./economy";
import { NO_ECONOMY } from "./economy";
import { INFRASTRUCTURE_COST } from "./infrastructure";
import type { Worksite } from "./roadworks";
import { roadsBuiltOneDay, roadsWanted } from "./roadworks";
import { UNASSIGNED } from "./spread";
import type { SupplyNetwork } from "./supply";
import { stackKey } from "./supply";

/**
 * Two nations over four provinces: nation 0 holds the first three and nation
 * 1 the last. Nation 0's supply carries 4 divisions in each of its own and 2
 * into nation 1's, and nation 1's carries 4 in its own.
 */
const NETWORK: SupplyNetwork = {
  capacity: [Float32Array.from([4, 4, 4, 2]), Float32Array.from([0, 0, 0, 4])],
  demand: new Map(),
  nations: 2,
  upkeepMet: [1, 1],
};

const SITE: Worksite = {
  infrastructure: Uint8Array.from([3, 3, 3, 3]),
  network: NETWORK,
  owners: Int32Array.from([0, 0, 0, 1]),
};

/** The site with `stacks` of `[nation, province, divisions]` standing on it. */
const standing = (
  site: Worksite,
  stacks: readonly (readonly [number, number, number])[]
): Worksite => ({
  ...site,
  network: {
    ...site.network,
    demand: new Map(
      stacks.map(([nation, province, divisions]) => [
        stackKey(site.network.nations, nation, province),
        divisions,
      ])
    ),
  },
});

const WITH_ROADWORKS: NationEconomy = {
  ...NO_ECONOMY,
  roadworks: INFRASTRUCTURE_COST + 100,
};

describe(roadsWanted, () => {
  it("should pick the province where its divisions go shortest of supply when several of its own fall short", () => {
    const site = standing(SITE, [
      [0, 0, 6],
      [0, 1, 9],
    ]);

    expect(roadsWanted(site, 0)).toBe(1);
  });

  it("should want none when its supply carries every division it has", () => {
    const site = standing(SITE, [[0, 0, 4]]);

    expect(roadsWanted(site, 0)).toBe(UNASSIGNED);
  });

  it("should want none when only another nation's divisions go short of supply", () => {
    const site = standing(SITE, [[1, 3, 9]]);

    expect(roadsWanted(site, 0)).toBe(UNASSIGNED);
  });

  it("should want none when its divisions go short only on ground it does not hold", () => {
    const site = standing(SITE, [[0, 3, 9]]);

    expect(roadsWanted(site, 0)).toBe(UNASSIGNED);
  });

  it("should want none when the province they go short in is built all the way", () => {
    const site = standing(
      { ...SITE, infrastructure: Uint8Array.from([3, 5, 3, 3]) },
      [[0, 1, 9]]
    );

    expect(roadsWanted(site, 0)).toBe(UNASSIGNED);
  });

  it("should want none when its supply does not reach the province at all", () => {
    const site = standing(
      {
        ...SITE,
        network: {
          ...NETWORK,
          capacity: [Float32Array.from([4, 0, 4, 2]), Float32Array.from([])],
        },
      },
      [[0, 1, 9]]
    );

    expect(roadsWanted(site, 0)).toBe(UNASSIGNED);
  });
});

describe(roadsBuiltOneDay, () => {
  it("should raise the infrastructure, take its cost off the roadworks and keep building there when a level is wanted and paid for", () => {
    const site = standing(SITE, [[0, 1, 9]]);

    expect(roadsBuiltOneDay(site, [WITH_ROADWORKS, NO_ECONOMY])).toStrictEqual({
      economies: [
        { ...WITH_ROADWORKS, roadSite: 1, roadworks: 100 },
        NO_ECONOMY,
      ],
      infrastructure: Uint8Array.from([3, 4, 3, 3]),
    });
  });

  it("should name the road site and build nothing yet when the roadworks have not gone far enough to pay for a level", () => {
    const site = standing(SITE, [[0, 1, 9]]);

    expect(roadsBuiltOneDay(site, [NO_ECONOMY, NO_ECONOMY])).toStrictEqual({
      economies: [{ ...NO_ECONOMY, roadSite: 1 }, NO_ECONOMY],
      infrastructure: SITE.infrastructure,
    });
  });

  it("should clear the road site and keep the roadworks when no division goes short of supply", () => {
    expect(
      roadsBuiltOneDay(SITE, [{ ...WITH_ROADWORKS, roadSite: 1 }, NO_ECONOMY])
    ).toStrictEqual({
      economies: [WITH_ROADWORKS, NO_ECONOMY],
      infrastructure: SITE.infrastructure,
    });
  });
});
