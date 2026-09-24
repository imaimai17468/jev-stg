import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { START_ADVANCEMENT } from "./advancement";
import type { Agency } from "./agency";
import { NO_AGENCY } from "./agency";
import { openingAirBases } from "./air-bases";
import { NO_AIR_FORCE } from "./air-force";
import { airForceOf, flying, wing } from "./air-war-fixture";
import { noQuiet } from "./armistice";
import { OPENING_ARMOURY } from "./armoury";
import {
  AT_WAR,
  division,
  LINE_OWNERS,
  LINE_WORLD,
  nation,
  worldOf,
} from "./army-fixture";
import { START_CLOCK } from "./clock";
import { startCompliance } from "./compliance";
import { INDEPENDENT, openingDiplomacy } from "./diplomacy";
import { NO_ECONOMY } from "./economy";
import type { Service } from "./espionage";
import { openingServices, serviceFor } from "./espionage";
import { FOCUS_DAYS, focusStarted, START_FOCUSES } from "./focus";
import { FUEL_CAPACITY } from "./fuel";
import { noGleaned } from "./intel";
import { replacedAt } from "./lookup";
import { NO_NAVY, openingNavy } from "./navy";
import { noNetworks } from "./networks";
import { openingResearchOf, START_RESEARCH, studyStarted } from "./research";
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
  gleaned: noGleaned(2),
  invasions: [],
  navies: [NO_NAVY, NO_NAVY],
  negotiations: [],
  networks: noNetworks(2, LINE_WORLD.provinces.length),
  owners: LINE_OWNERS,
  quiet: noQuiet(2),
  services: openingServices(2),
  stances: ["balanced", "balanced"],
  unrest: [],
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

  it("should open each nation with its leaning's research when a world opens", () => {
    const leaning = worldOf(
      [nation(0, 0), { ...nation(1, 3), leaning: "navy" }],
      LINE_WORLD.provinces
    );

    expect(startSimulation(leaning).advancements).toStrictEqual([
      { focuses: START_FOCUSES, research: openingResearchOf("army") },
      { focuses: START_FOCUSES, research: openingResearchOf("navy") },
    ]);
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

  it("should put a day into every nation's research and focus, and a saved day into every idle slot, when a day passes", () => {
    const studying: Simulation = {
      ...OPENING,
      advancements: [
        {
          focuses: focusStarted(START_FOCUSES, "army-effort"),
          research: studyStarted(START_RESEARCH, "fuel-storage"),
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
          ...START_RESEARCH,
          saved: [1, 1],
          studies: [
            {
              ahead: 0,
              bonus: 0,
              progress: 1.05,
              saved: 0,
              tech: "fuel-storage",
            },
          ],
        },
      },
      {
        ...START_ADVANCEMENT,
        research: { ...START_RESEARCH, saved: [1, 1, 1] },
      },
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
      navies: [NO_NAVY, openingNavy(4, 4, OPENING_ARMOURY.ships)],
    };

    expect(ranOneDay(LINE_WORLD, annexed).navies[1]).toBe(NO_NAVY);
  });

  it("should clear the annexed nation's network, its resistance work and the operatives it held when a day passes", () => {
    const annexed: Simulation = {
      ...OPENING,
      diplomacy: {
        ...OPENING.diplomacy,
        standings: [INDEPENDENT, { by: 0, kind: "annexed" }],
      },
      networks: [new Float32Array(5), Float32Array.from([30, 30, 0, 0, 0])],
      services: [{ ...serviceFor(2), captured: [1, 1] }, serviceFor(2)],
      unrest: [
        { daysLeft: 30, kind: "contacts", occupier: 0, share: 0.1, spy: 1 },
      ],
    };

    const after = ranOneDay(LINE_WORLD, annexed);

    expect({
      captured: after.services[0]?.captured,
      network: [...(after.networks[1] ?? [])],
      unrest: after.unrest,
    }).toStrictEqual({ captured: [], network: [0, 0, 0, 0, 0], unrest: [] });
  });

  it("should ground an annexed nation's air force when a day passes", () => {
    const annexed: Simulation = {
      ...OPENING,
      airForces: [
        NO_AIR_FORCE,
        airForceOf([wing({ base: 3, model: "fighter-1", planes: 50 })]),
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
        airForceOf([
          wing({ base: 0, model: "close-air-support-1", planes: 50 }),
        ]),
        NO_AIR_FORCE,
      ],
    };

    expect(ranOneDay(LINE_WORLD, airborne).airForces[0]?.wings).toStrictEqual([
      flying(wing({ base: 0, model: "close-air-support-1", planes: 50 }), {
        mission: "close-support",
        region: 0,
      }),
    ]);
  });
});

/** A pair of nations with nothing gathered of any of the four kinds. */
const NOTHING_OF_ANY_KIND = [false, false, false, false];

/** A founded agency with `upgrades` bought and nothing under way. */
const foundedWith = (upgrades: Agency["upgrades"]): Agency => ({
  ...NO_AGENCY,
  standing: "founded",
  upgrades,
});

/** `simulation` with nation 0's service patched by `patch`. */
const servedBy = (
  simulation: Simulation,
  patch: Partial<Service>
): Simulation => ({
  ...simulation,
  services: replacedAt(simulation.services, 0, {
    ...serviceFor(2),
    ...patch,
  }),
});

describe("ranOneDay for the intelligence services", () => {
  it("should put a day into every agency's project when a day passes", () => {
    const founding = servedBy(OPENING, {
      agency: {
        ...NO_AGENCY,
        work: { daysLeft: 5, kind: "working", project: "found" },
      },
    });

    expect(ranOneDay(LINE_WORLD, founding).services[0]?.agency).toStrictEqual({
      ...NO_AGENCY,
      work: { daysLeft: 4, kind: "working", project: "found" },
    });
  });

  it("should build the network where the operatives work when a nation has them in another", () => {
    const spying = servedBy(OPENING, {
      agency: foundedWith([]),
      operatives: 1,
      target: 1,
    });

    expect(ranOneDay(LINE_WORLD, spying).networks[0]).toStrictEqual(
      Float32Array.from([0, 0, 0.2, 0.4, 0])
    );
  });

  it("should draw intelligence from a captive when a nation holds another's operative", () => {
    const holding: Simulation = {
      ...OPENING,
      services: replacedAt(OPENING.services, 1, {
        ...serviceFor(2),
        captured: [0],
      }),
    };

    expect(
      Array.from(
        ranOneDay(LINE_WORLD, holding).gleaned.extracted,
        (level) => level > 0
      )
    ).toStrictEqual([
      ...NOTHING_OF_ANY_KIND,
      true,
      true,
      true,
      true,
      ...NOTHING_OF_ANY_KIND,
      ...NOTHING_OF_ANY_KIND,
    ]);
  });

  it("should run the resistance work a day nearer its end when a day passes", () => {
    const stirring: Simulation = {
      ...OPENING,
      unrest: [
        { daysLeft: 5, kind: "contacts", occupier: 1, share: 0.1, spy: 0 },
      ],
    };

    expect(ranOneDay(LINE_WORLD, stirring).unrest).toStrictEqual([
      { daysLeft: 4, kind: "contacts", occupier: 1, share: 0.1, spy: 0 },
    ]);
  });

  it("should chronicle the operation when a mission ends", () => {
    const ending = servedBy(OPENING, {
      agency: foundedWith([]),
      missions: [
        {
          daysLeft: 1,
          location: 3,
          operation: "infiltrate-army",
          operatives: 2,
          target: 1,
        },
      ],
      operatives: 2,
    });

    expect(decisionsOf(ranOneDay(LINE_WORLD, ending))).toStrictEqual([
      {
        captured: 0,
        kind: "operation",
        nation: 0,
        operation: "infiltrate-army",
        target: 1,
      },
    ]);
  });

  it("should chronicle the broken cipher when the codebreakers finish it", () => {
    const breaking = servedBy(OPENING, {
      agency: foundedWith(["cryptology-department"]),
      ciphers: {
        progress: Float64Array.from([0, 11_999]),
        revealed: new Uint8Array(2),
      },
      target: 1,
    });

    expect(decisionsOf(ranOneDay(LINE_WORLD, breaking))).toStrictEqual([
      { kind: "cipher", nation: 0, target: 1 },
    ]);
  });

  it("should chronicle the operatives caught when a host's counter-intelligence finds them", () => {
    const spied = servedBy(OPENING, {
      agency: foundedWith([]),
      operatives: 5000,
      target: 1,
    });
    const crowded: Simulation = {
      ...spied,
      services: replacedAt(spied.services, 1, {
        ...serviceFor(2),
        agency: foundedWith([
          "passive-defense",
          "passive-defense",
          "passive-defense",
          "passive-defense",
          "interrogation-techniques",
        ]),
        operatives: 10,
      }),
    };

    expect(decisionsOf(ranOneDay(LINE_WORLD, crowded))).toStrictEqual(
      Array.from({ length: 4 }, () => ({ kind: "captured", nation: 1, spy: 0 }))
    );
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
