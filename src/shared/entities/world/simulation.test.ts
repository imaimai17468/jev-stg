import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { START_ADVANCEMENT } from "./advancement";
import { LINE_OWNERS, LINE_WORLD } from "./army-fixture";
import { START_CLOCK } from "./clock";
import { startCompliance } from "./compliance";
import { INDEPENDENT, openingDiplomacy } from "./diplomacy";
import { NO_ECONOMY } from "./economy";
import { FOCUS_DAYS, focusStarted, START_FOCUSES } from "./focus";
import { START_RESEARCH, studyStarted } from "./research";
import type { Simulation } from "./simulation";
import { ranOneDay, startSimulation, withClock } from "./simulation";

/** Two nations of six hundred thousand people each, and nothing in the field. */
const OPENING: Simulation = {
  advancements: [START_ADVANCEMENT, START_ADVANCEMENT],
  chronicle: [],
  clock: START_CLOCK,
  compliance: startCompliance(LINE_OWNERS),
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

  it("should put a day into every nation's research and focus when a day passes", () => {
    const studying: Simulation = {
      ...OPENING,
      advancements: [
        {
          focuses: focusStarted(START_FOCUSES, "army-effort"),
          research: studyStarted(START_RESEARCH, "tools-1"),
        },
        START_ADVANCEMENT,
      ],
    };

    expect(ranOneDay(LINE_WORLD, studying).advancements).toStrictEqual([
      {
        focuses: {
          current: Option.some({ focus: "army-effort", progress: 1 }),
          done: [],
        },
        research: {
          researched: [],
          studies: [{ progress: 1, tech: "tools-1" }],
        },
      },
      START_ADVANCEMENT,
    ]);
  });

  it("should grant nothing when an annexed nation's focus reaches its last day", () => {
    const annexed: Simulation = {
      ...OPENING,
      advancements: [
        START_ADVANCEMENT,
        {
          ...START_ADVANCEMENT,
          focuses: {
            current: Option.some({
              focus: "industrialisation",
              progress: FOCUS_DAYS - 1,
            }),
            done: [],
          },
        },
      ],
      diplomacy: {
        ...OPENING.diplomacy,
        standings: [INDEPENDENT, { by: 0, kind: "annexed" }],
      },
    };

    expect(ranOneDay(LINE_WORLD, annexed).economies[1]?.civilianFactories).toBe(
      1
    );
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
