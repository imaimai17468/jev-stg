import { describe, expect, it } from "vite-plus/test";
import { AIR_WORLD } from "./air/air-war-fixture";
import type { Airspace } from "./airspace";
import {
  airspaceOf,
  provincesInRangeOf,
  regionOfProvince,
  withinRange,
} from "./airspace";
import { land, LINE_WORLD, sea } from "./army-fixture";
import { UNASSIGNED } from "./spread";

/**
 * Two islands of one province each, too close for both to seed a region, in
 * a sea of two zones, each zone washing one island.
 */
const STRANDED_AIRSPACE: Airspace = airspaceOf(
  [land(0, [2]), land(1, [3]), sea(2, [0, 3]), sea(3, [1, 2])],
  1
);

describe(airspaceOf, () => {
  it("should cut the land and the sea into a region each when every province of a kind reaches the others", () => {
    expect(airspaceOf(LINE_WORLD.provinces, 1)).toStrictEqual({
      regionOf: Int32Array.from([0, 0, 0, 0, 1]),
      regions: [
        {
          hub: 3,
          id: 0,
          neighbours: [1],
          provinces: [0, 1, 2, 3],
          sea: false,
          x: 1.5,
          y: 0,
        },
        {
          hub: 4,
          id: 1,
          neighbours: [0],
          provinces: [4],
          sea: true,
          x: 4,
          y: 0,
        },
      ],
    });
  });

  it("should grow a region of its own from a province and list the regions around each when no seed reaches it", () => {
    expect(STRANDED_AIRSPACE).toStrictEqual({
      regionOf: Int32Array.from([0, 1, 2, 2]),
      regions: [
        {
          hub: 0,
          id: 0,
          neighbours: [2],
          provinces: [0],
          sea: false,
          x: 0,
          y: 0,
        },
        {
          hub: 1,
          id: 1,
          neighbours: [2],
          provinces: [1],
          sea: false,
          x: 1,
          y: 0,
        },
        {
          hub: 3,
          id: 2,
          neighbours: [0, 1],
          provinces: [2, 3],
          sea: true,
          x: 2.5,
          y: 1,
        },
      ],
    });
  });
});

describe(regionOfProvince, () => {
  it("should read the region the province lies in when the airspace covers it", () => {
    expect(regionOfProvince(LINE_WORLD.airspace, 4)).toBe(1);
  });
});

describe(withinRange, () => {
  it("should list the region and every region touching it when the region exists", () => {
    expect(withinRange(LINE_WORLD.airspace, 0)).toStrictEqual([0, 1]);
  });

  it("should list the region alone when the airspace has no such region", () => {
    expect(withinRange(LINE_WORLD.airspace, UNASSIGNED)).toStrictEqual([
      UNASSIGNED,
    ]);
  });
});

describe(provincesInRangeOf, () => {
  it("should list the provinces of the region and every region touching it, lowest first, when the region exists", () => {
    expect(provincesInRangeOf(AIR_WORLD.airspace, 3)).toStrictEqual([
      2, 3, 4, 5,
    ]);
  });

  it("should list none when the airspace has no such region", () => {
    expect(provincesInRangeOf(AIR_WORLD.airspace, UNASSIGNED)).toStrictEqual(
      []
    );
  });
});
