import { describe, expect, it } from "vite-plus/test";
import type { AirForce, Wing } from "./air-force";
import {
  airForceUnder,
  allPlanesOf,
  flyingOf,
  planesBuiltOneDay,
  NO_AIR_FORCE,
  openingAirForce,
  planesOf,
} from "./air-force";
import { UNASSIGNED } from "./spread";

/** A wing of fighters waiting at `base` with `planes` in it. */
const fighters = (planes: number, base: number): Wing => ({
  aircraft: "fighter",
  base,
  mission: "standby",
  planes,
  region: UNASSIGNED,
});

/** Fighters at two bases and close support planes at the first, building fighters. */
const MIXED: AirForce = {
  ...NO_AIR_FORCE,
  wings: [
    fighters(90, 0),
    fighters(40, 1),
    { ...fighters(30, 0), aircraft: "close-support" },
  ],
};

describe(planesBuiltOneDay, () => {
  it("should build nothing and keep the progress when the nation has no air base", () => {
    expect(planesBuiltOneDay(MIXED, 100, UNASSIGNED)).toBe(MIXED);
  });

  it("should carry the production into progress when it pays for no plane", () => {
    expect(planesBuiltOneDay(NO_AIR_FORCE, 10, 0)).toStrictEqual({
      ...NO_AIR_FORCE,
      progress: 10,
    });
  });

  it("should fill the wing of that kind at that base and open a new one when the finished planes overflow it", () => {
    expect(planesBuiltOneDay(MIXED, 24 * 15 + 5, 0)).toStrictEqual({
      ...MIXED,
      progress: 5,
      wings: [
        fighters(100, 0),
        fighters(40, 1),
        { ...fighters(30, 0), aircraft: "close-support" },
        fighters(5, 0),
      ],
    });
  });
});

describe(openingAirForce, () => {
  it("should open with no air force when the nation has no air base", () => {
    expect(openingAirForce(10, UNASSIGNED)).toBe(NO_AIR_FORCE);
  });

  it("should open with wings of every kind at the base when the nation has one", () => {
    expect(openingAirForce(20, 3)).toStrictEqual({
      ...NO_AIR_FORCE,
      wings: [
        fighters(100, 3),
        fighters(20, 3),
        { ...fighters(60, 3), aircraft: "close-support" },
        { ...fighters(20, 3), aircraft: "naval-bomber" },
      ],
    });
  });
});

describe(airForceUnder, () => {
  it("should turn the factories to the new plane and keep the progress when the order changes", () => {
    expect(
      airForceUnder({ ...NO_AIR_FORCE, progress: 7 }, { order: "naval-bomber" })
    ).toStrictEqual({ ...NO_AIR_FORCE, order: "naval-bomber", progress: 7 });
  });

  it("should put the new weight of aviation on the air force when it changes", () => {
    expect(airForceUnder(NO_AIR_FORCE, { aviation: "heavy" })).toStrictEqual({
      ...NO_AIR_FORCE,
      aviation: "heavy",
    });
  });
});

describe(flyingOf, () => {
  it("should leave out the wings waiting at their bases when some are on a mission", () => {
    const sent: Wing = {
      aircraft: "fighter",
      base: 0,
      mission: "superiority",
      planes: 10,
      region: 2,
    };
    const waiting: Wing = { ...sent, mission: "standby", region: UNASSIGNED };

    expect(flyingOf({ ...NO_AIR_FORCE, wings: [sent, waiting] })).toStrictEqual(
      [sent]
    );
  });
});

describe(planesOf, () => {
  it("should add up the planes of that kind at every base when wings of other kinds are mixed in", () => {
    expect(planesOf(MIXED, "fighter")).toBe(130);
  });
});

describe(allPlanesOf, () => {
  it("should add up the planes of every kind when the air force holds several", () => {
    expect(allPlanesOf(MIXED)).toBe(160);
  });
});
