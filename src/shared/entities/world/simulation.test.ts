import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { START_ADVANCEMENT } from "./advancement";
import { openingAirBases } from "./air-bases";
import { NO_AIR_FORCE } from "./air-force";
import { airForceOf, flying, wing } from "./air-war-fixture";
import { noQuiet } from "./armistice";
import { AT_WAR, division, LINE_OWNERS, LINE_WORLD } from "./army-fixture";
import { START_CLOCK } from "./clock";
import { startCompliance } from "./compliance";
import { INDEPENDENT, openingDiplomacy } from "./diplomacy";
import { NO_ECONOMY } from "./economy";
import { FOCUS_DAYS, focusStarted, START_FOCUSES } from "./focus";
import { FUEL_CAPACITY } from "./fuel";
import { NO_NAVY, openingNavy } from "./navy";
import { START_RESEARCH, studyStarted } from "./research";
import type { Simulation } from "./simulation";
import { ranOneDay, skiesOf, startSimulation, withClock } from "./simulation";
import { UNASSIGNED } from "./spread";

/** Two nations of six hundred thousand people each, and nothing in the field. */
const OPENING: Simulation = {
  advancements: [START_ADVANCEMENT, START_ADVANCEMENT],
  airBases: openingAirBases(LINE_WORLD),
  airForces: [NO_AIR_FORCE, NO_AIR_FORCE],
  airPower: [new Float32Array(2), new Float32Array(2)],
  chronicle: [],
  clock: START_CLOCK,
  compliance: startCompliance(LINE_OWNERS),
  deals: [],
  diplomacy: openingDiplomacy(LINE_OWNERS, 2, []),
  divisions: [],
  economies: [
    {
      ...NO_ECONOMY,
      civilianFactories: 1,
      fuel: FUEL_CAPACITY,
      manpower: 9000,
      population: 600_000,
    },
    {
      ...NO_ECONOMY,
      civilianFactories: 1,
      fuel: FUEL_CAPACITY,
      manpower: 9000,
      population: 600_000,
    },
  ],
  invasions: [],
  navies: [NO_NAVY, NO_NAVY],
  negotiations: [],
  owners: LINE_OWNERS,
  quiet: noQuiet(2),
  stances: ["balanced", "balanced"],
};

/** The two nations of the line at war. */
const FIGHTING: Simulation = {
  ...OPENING,
  diplomacy: { ...OPENING.diplomacy, wars: AT_WAR },
};

/** What went into the chronicle, without who decided it or when. */
const decisionsOf = (simulation: Simulation) =>
  simulation.chronicle.map((entry) => entry.ruling.decision);

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

  it("should open a base at every capital and hub, an air force for each nation's military factories, and a clear sky over every region when a world opens", () => {
    const opened = startSimulation(LINE_WORLD);

    expect({
      airBases: opened.airBases,
      airForces: opened.airForces,
      airPower: opened.airPower,
    }).toStrictEqual({
      airBases: Uint8Array.from([5, 0, 0, 5, 0]),
      airForces: [
        { ...NO_AIR_FORCE, wings: [] },
        { ...NO_AIR_FORCE, wings: [] },
      ],
      airPower: [new Float32Array(2), new Float32Array(2)],
    });
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
          studies: [{ progress: 1.05, tech: "tools-1" }],
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

  it("should chronicle the landing when a division goes ashore on an enemy coast across an empty sea", () => {
    const landing: Simulation = {
      ...FIGHTING,
      invasions: [
        {
          convoys: 5,
          crossing: "landing",
          divisions: [division({ nation: 0, province: 0 })],
          lane: [4],
          nation: 0,
          readyOn: 0,
          target: 3,
        },
      ],
    };

    expect(decisionsOf(ranOneDay(LINE_WORLD, landing))).toStrictEqual([
      { defender: 1, kind: "landing", nation: 0, target: 3 },
    ]);
  });

  it("should sign a white peace when two nations at war have gone half a year without touching", () => {
    const apart: Simulation = {
      ...FIGHTING,
      owners: Int32Array.from([0, UNASSIGNED, UNASSIGNED, 1, UNASSIGNED]),
      quiet: Int32Array.from([0, 179, 179, 0]),
    };

    expect(decisionsOf(ranOneDay(LINE_WORLD, apart))).toStrictEqual([
      { kind: "white-peace", one: 0, other: 1 },
    ]);
  });

  it("should sink an annexed nation's navy when a day passes", () => {
    const annexed: Simulation = {
      ...OPENING,
      diplomacy: {
        ...OPENING.diplomacy,
        standings: [INDEPENDENT, { by: 0, kind: "annexed" }],
      },
      navies: [NO_NAVY, openingNavy(4, 4)],
    };

    expect(ranOneDay(LINE_WORLD, annexed).navies[1]).toBe(NO_NAVY);
  });

  it("should ground an annexed nation's air force when a day passes", () => {
    const annexed: Simulation = {
      ...OPENING,
      airForces: [
        NO_AIR_FORCE,
        airForceOf([wing({ aircraft: "fighter", base: 3, planes: 50 })]),
      ],
      diplomacy: {
        ...OPENING.diplomacy,
        standings: [INDEPENDENT, { by: 0, kind: "annexed" }],
      },
    };

    expect(ranOneDay(LINE_WORLD, annexed).airForces[1]).toBe(NO_AIR_FORCE);
  });

  it("should send the wings over the front when a nation at war has planes", () => {
    const airborne: Simulation = {
      ...FIGHTING,
      airForces: [
        airForceOf([wing({ aircraft: "close-support", base: 0, planes: 50 })]),
        NO_AIR_FORCE,
      ],
    };

    expect(ranOneDay(LINE_WORLD, airborne).airForces[0]?.wings).toStrictEqual([
      flying(wing({ aircraft: "close-support", base: 0, planes: 50 }), {
        mission: "close-support",
        region: 0,
      }),
    ]);
  });
});

describe(skiesOf, () => {
  it("should read the air power flown today under the diplomacy of the day when the skies are asked for", () => {
    expect(skiesOf(FIGHTING)).toStrictEqual({
      diplomacy: FIGHTING.diplomacy,
      power: FIGHTING.airPower,
    });
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
