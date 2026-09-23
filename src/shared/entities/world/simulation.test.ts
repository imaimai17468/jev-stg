import { describe, expect, it } from "vite-plus/test";
import { LINE_OWNERS, LINE_WORLD } from "./army-fixture";
import { START_CLOCK } from "./clock";
import { openingDiplomacy } from "./diplomacy";
import { NO_ECONOMY } from "./economy";
import type { Simulation } from "./simulation";
import { ranOneDay, startSimulation, withClock } from "./simulation";

/** Two nations of six hundred thousand people each, and nothing in the field. */
const OPENING: Simulation = {
  chronicle: [],
  clock: START_CLOCK,
  diplomacy: openingDiplomacy(LINE_OWNERS, 2, []),
  divisions: [],
  economies: [
    {
      ...NO_ECONOMY,
      civilianFactories: 1,
      manpower: 9000,
      population: 600_000,
    },
    {
      ...NO_ECONOMY,
      civilianFactories: 1,
      manpower: 9000,
      population: 600_000,
    },
  ],
  negotiations: [],
  owners: LINE_OWNERS,
  stances: ["balanced", "balanced"],
};

describe(startSimulation, () => {
  it("should spread the nations over the ground when a world opens", () => {
    expect(startSimulation(LINE_WORLD).owners).toStrictEqual(LINE_OWNERS);
  });

  it("should read each nation's people off the land it holds when a world opens", () => {
    expect(startSimulation(LINE_WORLD).economies).toStrictEqual(
      OPENING.economies
    );
  });

  it("should open at peace with a faction led by each nation when there are fewer than three", () => {
    expect(startSimulation(LINE_WORLD).diplomacy).toStrictEqual(
      openingDiplomacy(LINE_OWNERS, 2, [0, 1])
    );
  });

  it("should open with nothing in the field when a world opens", () => {
    expect(startSimulation(LINE_WORLD).divisions).toStrictEqual([]);
  });
});

describe(ranOneDay, () => {
  it("should move the calendar when a day passes", () => {
    expect(ranOneDay(LINE_WORLD, OPENING).clock).toStrictEqual({
      days: 1,
      paused: false,
      speed: 2,
    });
  });

  it("should leave the map alone when no nation can put a division in the field", () => {
    expect(ranOneDay(LINE_WORLD, OPENING).owners).toBe(LINE_OWNERS);
  });
});

describe(withClock, () => {
  it("should leave everything but the calendar alone when the clock is set", () => {
    expect(
      withClock(OPENING, { days: 4, paused: true, speed: 5 })
    ).toStrictEqual({
      ...OPENING,
      clock: { days: 4, paused: true, speed: 5 },
    });
  });
});
