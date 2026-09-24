import { describe, expect, it } from "vite-plus/test";
import {
  AT_WAR,
  land,
  LINE_GRAPH,
  LINE_OWNERS,
  LINE_WORLD,
  nation,
  TWO_NATIONS,
  worldOf,
} from "../army-fixture";
import { graphOf } from "../provinces";
import { noWars } from "../wars";
import { battlePlanOf } from "./battle-plan";

/**
 * Four provinces in a square, nation 0 holding the top two and nation 1 the
 * bottom two with its capital under nation 0's right-hand one.
 */
const SQUARE_WORLD = worldOf(
  [nation(0, 0), nation(1, 3)],
  [land(0, [1, 2]), land(1, [0, 3]), land(2, [0, 3]), land(3, [1, 2])]
);

const SQUARE_OWNERS = Int32Array.from([0, 0, 1, 1]);

/** Six provinces in a row, nation 0 holding the first four and nation 1 the last two. */
const DEEP_WORLD = worldOf(
  [nation(0, 0), nation(1, 5)],
  [
    land(0, [1]),
    land(1, [0, 2]),
    land(2, [1, 3]),
    land(3, [2, 4]),
    land(4, [3, 5]),
    land(5, [4]),
  ]
);

describe(battlePlanOf, () => {
  it("should run a front along the border, an offensive to the enemy capital and a fallback line behind when two nations are at war", () => {
    expect(
      battlePlanOf(
        LINE_WORLD.provinces,
        TWO_NATIONS,
        LINE_GRAPH,
        LINE_OWNERS,
        AT_WAR,
        0
      )
    ).toStrictEqual({
      approach: Int32Array.from([-1, -1, 1, 0, -1]),
      depth: Int32Array.from([1, 0, -1, -1, -1]),
      fallback: [0],
      fronts: [{ line: [1], offensive: [1, 2, 3] }],
      retreat: Int32Array.from([0, 1, -1, -1, -1]),
    });
  });

  it("should draw nothing when the nation is at peace", () => {
    expect(
      battlePlanOf(
        LINE_WORLD.provinces,
        TWO_NATIONS,
        LINE_GRAPH,
        LINE_OWNERS,
        noWars(2),
        0
      )
    ).toStrictEqual({
      approach: Int32Array.from([-1, -1, -1, -1, -1]),
      depth: Int32Array.from([-1, -1, -1, -1, -1]),
      fallback: [],
      fronts: [],
      retreat: Int32Array.from([-1, -1, -1, -1, -1]),
    });
  });

  it("should split the front when the stretches touching the enemy do not touch each other", () => {
    const split = Int32Array.from([0, 0, 1, 0, -1]);

    expect(
      battlePlanOf(
        LINE_WORLD.provinces,
        TWO_NATIONS,
        LINE_GRAPH,
        split,
        AT_WAR,
        0
      ).fronts
    ).toStrictEqual([
      { line: [1], offensive: [] },
      { line: [3], offensive: [] },
    ]);
  });

  it("should set out from the province of the front nearest the objective when the front runs along several", () => {
    expect(
      battlePlanOf(
        SQUARE_WORLD.provinces,
        SQUARE_WORLD.nations,
        graphOf(SQUARE_WORLD.provinces),
        SQUARE_OWNERS,
        AT_WAR,
        0
      ).fronts
    ).toStrictEqual([{ line: [0, 1], offensive: [1, 3] }]);
  });

  it("should leave no fallback line when every province the nation holds is on the front", () => {
    expect(
      battlePlanOf(
        SQUARE_WORLD.provinces,
        SQUARE_WORLD.nations,
        graphOf(SQUARE_WORLD.provinces),
        SQUARE_OWNERS,
        AT_WAR,
        0
      ).fallback
    ).toStrictEqual([]);
  });

  it("should run the fallback line two provinces behind the front when the nation's ground runs deeper", () => {
    expect(
      battlePlanOf(
        DEEP_WORLD.provinces,
        DEEP_WORLD.nations,
        graphOf(DEEP_WORLD.provinces),
        Int32Array.from([0, 0, 0, 0, 1, 1]),
        AT_WAR,
        0
      ).fallback
    ).toStrictEqual([1]);
  });

  it("should run an exclave's fallback line as deep as its own ground when the rest of the nation runs deeper", () => {
    expect(
      battlePlanOf(
        DEEP_WORLD.provinces,
        DEEP_WORLD.nations,
        graphOf(DEEP_WORLD.provinces),
        Int32Array.from([0, 0, 0, 1, 0, 0]),
        AT_WAR,
        0
      ).fallback
    ).toStrictEqual([0, 5]);
  });
});
