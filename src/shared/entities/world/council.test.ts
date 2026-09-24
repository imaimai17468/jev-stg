import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { Advancement } from "./advancement";
import { START_ADVANCEMENT } from "./advancement";
import type { Agency } from "./agency";
import { AGENCY_DAYS, NO_AGENCY } from "./agency";
import { airForceOf, wing } from "./air-war-fixture";
import { OPENING_ARMOURY } from "./armoury";
import { division } from "./army-fixture";
import type { Negotiation } from "./chronicle";
import type { Council, NationBrief, Verdict } from "./consultation";
import {
  afterCouncil,
  afterTalks,
  councilDayOf,
  councilOf,
  peaceTalksOf,
  ruledByJev,
  ruledByRules,
  rulingsFrom,
  termsFrom,
} from "./council";
import type { Diplomacy } from "./diplomacy";
import {
  INDEPENDENT,
  openingDiplomacy,
  standingOf,
  warDeclared,
} from "./diplomacy";
import { ROW_OWNERS, ROW_SIMULATION, ROW_WORLD } from "./diplomacy-fixture";
import { NO_ECONOMY } from "./economy";
import type { Service } from "./espionage";
import { HOME, serviceFor } from "./espionage";
import type { FocusId } from "./focus";
import { START_FOCUSES } from "./focus";
import { FUEL_CAPACITY } from "./fuel";
import type { World } from "./index";
import type { Leaning } from "./leaning";
import { replacedAt } from "./lookup";
import type { Navy } from "./navy";
import { fleetStrength, NO_NAVY, openingNavy } from "./navy";
import type { Random } from "./random";
import { START_RESEARCH } from "./research";
import type { Sighting } from "./sightings";
import type { Simulation } from "./simulation";
import { UNASSIGNED } from "./spread";
import { enemiesOf } from "./wars";

const withDiplomacy = (diplomacy: Diplomacy): Simulation => ({
  ...ROW_SIMULATION,
  diplomacy,
});

/** Every focus outside the army's branch that the tree lists before the political stands. */
const UP_TO_THE_STAND: readonly FocusId[] = [
  "industrialisation",
  "construction-effort",
  "production-effort",
  "total-mobilisation",
  "research-bureau",
  "technical-schools",
  "secret-projects",
  "political-effort",
  "national-unity",
];

/** The row with nation 3 having finished militarism, which may justify at any tension. */
const MILITARIST_THREE: Simulation = {
  ...ROW_SIMULATION,
  advancements: replacedAt(ROW_SIMULATION.advancements, 3, {
    ...START_ADVANCEMENT,
    focuses: { ...START_FOCUSES, done: ["political-effort", "militarism"] },
  }),
};

/** Nation 3 armed and holding a war goal on 2 justified a month before 1936-03-01, on that day. */
const JUSTIFIED_THREE: Simulation = {
  ...withDiplomacy({
    ...ROW_SIMULATION.diplomacy,
    warGoals: [{ nation: 3, readyOn: 30, target: 2 }],
  }),
  clock: { ...ROW_SIMULATION.clock, days: 60 },
  divisions: [division({ nation: 3, province: 3 })],
};

/** Every nation knowing everything of every other, from captives that told all. */
const KNOWING: Simulation["gleaned"] = {
  ...ROW_SIMULATION.gleaned,
  extracted: ROW_SIMULATION.gleaned.extracted.map(() => 1),
};

/** `simulation` with every nation knowing everything of every other. */
const allKnown = (simulation: Simulation): Simulation => ({
  ...simulation,
  gleaned: KNOWING,
});

/** A figure seen exactly, with every nation behind it in view. */
const exactly = (estimate: number): Sighting => ({
  estimate,
  margin: 0,
  unseen: 0,
});

/** Nation 0 leading a faction, nation 3 answering to nation 2. */
const ORDERED: Simulation = withDiplomacy({
  ...openingDiplomacy(ROW_OWNERS, 4, [0]),
  standings: [
    INDEPENDENT,
    INDEPENDENT,
    INDEPENDENT,
    { kind: "puppet", overlord: 2 },
  ],
});

/** A sighting of one nation the government has no figure for. */
const UNSEEN_ONE: Sighting = { estimate: 0, margin: 0, unseen: 1 };

/** A brief with nothing in it, for the verdicts to be read against. */
const BRIEF: NationBrief = {
  agencyProjects: [],
  atWar: false,
  buildSites: [],
  civilianFactories: 0,
  convoys: 0,
  divisionKinds: ["infantry", "cavalry"],
  dockyards: 0,
  enemyFleet: exactly(0),
  enemyPlanes: exactly(0),
  enemyStrength: exactly(0),
  equipment: 0,
  factions: [{ faction: 0, strength: 0 }],
  fleet: 0,
  focuses: [],
  freeSlots: 0,
  fuel: 0,
  justifiable: [{ nation: 0, strength: exactly(0) }],
  manpower: 0,
  militaryFactories: 0,
  nation: 1,
  operatives: 0,
  planeModels: OPENING_ARMOURY.planes,
  planes: 0,
  population: 0,
  posted: false,
  rivals: [{ nation: 2, strength: exactly(0) }],
  shipDesigns: OPENING_ARMOURY.ships,
  shortage: 0,
  skyLost: 0,
  spyTargets: [],
  strength: 0,
  techs: [],
  tension: 0,
  undersupplied: 0,
};

const COUNCIL: Council = {
  _tag: "council",
  date: "1936-01-01",
  nations: [BRIEF],
};

const verdict = (patch: Partial<Verdict>): Verdict => ({
  choice: "none",
  nation: 1,
  probability: 0.7,
  question: "war",
  weights: [],
  ...patch,
});

/** The first of the month the tests' councils meet on. */
const COUNCIL_DAY = 0;

/** A draw that always lands on `unit`. */
const landingOn = (unit: number): Random => ({
  below: () => 0,
  unit: () => unit,
});

/** A draw the council's tests do not depend on. */
const ANY_DRAW = landingOn(0.5);

/** Nation 1 beaten by nation 0 and waiting for its terms. */
const NEGOTIATION: Negotiation = {
  fallback: { terms: "annex", victor: 0 },
  loser: 1,
  openedOn: 0,
};

const TALKING: Simulation = {
  ...withDiplomacy(warDeclared(ROW_SIMULATION.diplomacy, 0, 1)),
  negotiations: [NEGOTIATION],
  owners: Int32Array.from([0, 0, 2, 3, UNASSIGNED]),
};

/** `simulation` with nation 0's advancement replaced by `advancement`. */
const advancedTo = (
  simulation: Simulation,
  advancement: Advancement
): Simulation => ({
  ...simulation,
  advancements: simulation.advancements.map((held, nation) => {
    if (nation === 0) {
      return advancement;
    }
    return held;
  }),
});

/** Nation 0 with the technologies of `researched` finished on top of those it opens with. */
const researchedAll = (
  simulation: Simulation,
  researched: Advancement["research"]["researched"]
): Simulation =>
  advancedTo(simulation, {
    ...START_ADVANCEMENT,
    research: {
      ...START_RESEARCH,
      researched: [...START_RESEARCH.researched, ...researched],
    },
  });

/** What the rules put on nation 0's slots, in the order they started. */
const startedTechs = (simulation: Simulation) =>
  simulation.advancements[0]?.research.studies.map((study) => study.tech);

/** The brief `council` gives nation 0. */
const briefOfFirst = (council: Council) =>
  council.nations.find((brief) => brief.nation === 0);

describe(councilOf, () => {
  it("should brief every government that decides for itself when the month turns", () => {
    expect(
      councilOf(ROW_WORLD, ORDERED).nations.map((brief) => brief.nation)
    ).toStrictEqual([0, 1, 2]);
  });

  it("should offer the neighbours it outmatches to justify on and the factions across its borders when world tension has reached half", () => {
    const armed: Simulation = {
      ...ORDERED,
      diplomacy: { ...ORDERED.diplomacy, tension: 0.5 },
      divisions: [division({ nation: 1, province: 1 })],
    };
    const brief = councilOf(ROW_WORLD, armed).nations.find(
      (entry) => entry.nation === 1
    );

    expect({
      factions: brief?.factions,
      justifiable: brief?.justifiable,
      rivals: brief?.rivals,
    }).toStrictEqual({
      factions: [{ faction: 0, strength: 0 }],
      justifiable: [
        { nation: 2, strength: { ...UNSEEN_ONE, unseen: 2 } },
        { nation: 0, strength: UNSEEN_ONE },
      ],
      rivals: [],
    });
  });

  it("should offer nobody to justify on when world tension is under what the nation's focuses require", () => {
    const armed: Simulation = {
      ...ORDERED,
      divisions: [division({ nation: 1, province: 1 })],
    };
    const brief = councilOf(ROW_WORLD, armed).nations.find(
      (entry) => entry.nation === 1
    );

    expect(brief?.justifiable).toStrictEqual([]);
  });

  it("should offer the target of its justified war goal to declare on, and nobody to justify on, when it holds one", () => {
    const armed: Simulation = {
      ...ORDERED,
      diplomacy: {
        ...ORDERED.diplomacy,
        tension: 0.5,
        warGoals: [{ nation: 1, readyOn: 0, target: 2 }],
      },
      divisions: [division({ nation: 1, province: 1 })],
    };
    const brief = councilOf(ROW_WORLD, armed).nations.find(
      (entry) => entry.nation === 1
    );

    expect({
      justifiable: brief?.justifiable,
      rivals: brief?.rivals,
    }).toStrictEqual({
      justifiable: [],
      rivals: [{ nation: 2, strength: { ...UNSEEN_ONE, unseen: 2 } }],
    });
  });

  it("should offer no neighbour to declare on when the nation no longer outmatches the target of its justified war goal", () => {
    const justified = withDiplomacy({
      ...ORDERED.diplomacy,
      warGoals: [{ nation: 1, readyOn: 0, target: 2 }],
    });
    const brief = councilOf(ROW_WORLD, justified).nations.find(
      (entry) => entry.nation === 1
    );

    expect(brief?.rivals).toStrictEqual([]);
  });

  it("should offer no war and no faction when a faction leader is already fighting", () => {
    const fighting = withDiplomacy(warDeclared(ORDERED.diplomacy, 0, 1));
    const brief = councilOf(ROW_WORLD, fighting).nations.find(
      (entry) => entry.nation === 0
    );

    expect({
      factions: brief?.factions,
      rivals: brief?.rivals,
    }).toStrictEqual({ factions: [], rivals: [] });
  });

  it("should offer no faction when every faction in reach holds a nation it is at war with", () => {
    const hostile = withDiplomacy(warDeclared(ORDERED.diplomacy, 0, 1));
    const brief = councilOf(ROW_WORLD, hostile).nations.find(
      (entry) => entry.nation === 1
    );

    expect(brief?.factions).toStrictEqual([]);
  });

  it("should count what its enemies have in the field when the nation at war knows them fully", () => {
    const fighting: Simulation = {
      ...allKnown(withDiplomacy(warDeclared(ROW_SIMULATION.diplomacy, 0, 1))),
      divisions: [division({ nation: 1, province: 1 })],
    };

    expect(
      briefOfFirst(councilOf(ROW_WORLD, fighting))?.enemyStrength
    ).toStrictEqual(exactly(20_000));
  });

  it("should leave its enemy's men unseen when the nation at war knows nothing of its army", () => {
    const fighting: Simulation = {
      ...withDiplomacy(warDeclared(ROW_SIMULATION.diplomacy, 0, 1)),
      divisions: [division({ nation: 1, province: 1 })],
    };

    expect(
      briefOfFirst(councilOf(ROW_WORLD, fighting))?.enemyStrength
    ).toStrictEqual(UNSEEN_ONE);
  });

  it("should blur its enemy's fleet by half when the nation at war sees only what its enemy's trade shows", () => {
    const fighting = withDiplomacy(warDeclared(ROW_SIMULATION.diplomacy, 0, 1));
    const fleet = briefOfFirst(councilOf(ROW_WORLD, fighting))?.enemyFleet;

    expect({ margin: fleet?.margin, unseen: fleet?.unseen }).toStrictEqual({
      margin: 0.5,
      unseen: 0,
    });
  });

  it("should offer founding the agency and every other nation still standing to spy on when a nation has no agency yet", () => {
    const brief = briefOfFirst(councilOf(ROW_WORLD, allKnown(ORDERED)));

    expect({
      agencyProjects: brief?.agencyProjects,
      operatives: brief?.operatives,
      spyTargets: brief?.spyTargets,
    }).toStrictEqual({
      agencyProjects: ["found"],
      operatives: 0,
      spyTargets: [
        { known: 1, nation: 1 },
        { known: 1, nation: 2 },
        { known: 1, nation: 3 },
      ],
    });
  });

  it("should leave an annexed nation out of the ones to spy on when the council meets", () => {
    const annexing = withDiplomacy({
      ...ROW_SIMULATION.diplomacy,
      standings: [
        INDEPENDENT,
        { by: 0, kind: "annexed" },
        INDEPENDENT,
        INDEPENDENT,
      ],
    });

    expect(
      briefOfFirst(councilOf(ROW_WORLD, annexing))?.spyTargets.map(
        (target) => target.nation
      )
    ).toStrictEqual([2, 3]);
  });

  it("should offer the free slots each line's leading technology and every focus without a prerequisite when the world opens", () => {
    const brief = briefOfFirst(councilOf(ROW_WORLD, ROW_SIMULATION));

    expect({
      focuses: brief?.focuses,
      freeSlots: brief?.freeSlots,
      techs: brief?.techs,
    }).toStrictEqual({
      focuses: [
        "industrialisation",
        "research-bureau",
        "army-effort",
        "political-effort",
      ],
      freeSlots: 3,
      techs: [
        "improved-infantry-equipment-1",
        "great-war-tank",
        "early-truck",
        "mountain-infantry-1",
        "destroyer-3",
        "light-cruiser-3",
        "battleship-3",
        "carrier-3",
        "submarine-3",
        "basic-light-battery",
        "fighter-2",
        "close-air-support-2",
        "naval-bomber-2",
        "basic-machine-tools",
        "construction-1",
        "fuel-storage",
        "electronic-mechanical-engineering",
      ],
    });
  });

  it("should count its own convoys and fleet against only its enemies' fleets when the nation is at war", () => {
    const fleets: Simulation = {
      ...allKnown(withDiplomacy(warDeclared(ROW_SIMULATION.diplomacy, 0, 1))),
      economies: ROW_SIMULATION.economies.map((economy, nation) => ({
        ...economy,
        dockyards: 4 - nation,
      })),
      navies: [
        openingNavy(4, 4, OPENING_ARMOURY.ships),
        openingNavy(2, 4, OPENING_ARMOURY.ships),
        openingNavy(8, 4, OPENING_ARMOURY.ships),
      ],
    };
    const brief = briefOfFirst(councilOf(ROW_WORLD, fleets));

    expect({
      convoys: brief?.convoys,
      dockyards: brief?.dockyards,
      enemyFleet: brief?.enemyFleet,
      fleet: brief?.fleet,
    }).toStrictEqual({
      convoys: 40,
      dockyards: 4,
      enemyFleet: exactly(
        fleetStrength(openingNavy(2, 4, OPENING_ARMOURY.ships))
      ),
      fleet: fleetStrength(openingNavy(4, 4, OPENING_ARMOURY.ships)),
    });
  });

  it("should count its planes, its enemies' planes, its fuel and the skies it has lost when the nation is at war", () => {
    const aloft: Simulation = {
      ...allKnown(withDiplomacy(warDeclared(ROW_SIMULATION.diplomacy, 0, 1))),
      airForces: replacedAt(
        replacedAt(
          ROW_SIMULATION.airForces,
          0,
          airForceOf([wing({ base: 0, model: "fighter-1", planes: 30 })])
        ),
        1,
        airForceOf([
          wing({ base: 1, model: "fighter-1", planes: 20 }),
          wing({ base: 1, model: "close-air-support-1", planes: 5 }),
        ])
      ),
      airPower: replacedAt(
        replacedAt(ROW_SIMULATION.airPower, 0, Float32Array.from([2, 0])),
        1,
        Float32Array.from([10, 0])
      ),
      economies: replacedAt(ROW_SIMULATION.economies, 0, {
        ...NO_ECONOMY,
        fuel: FUEL_CAPACITY / 2,
      }),
    };
    const brief = briefOfFirst(councilOf(ROW_WORLD, aloft));

    expect({
      enemyPlanes: brief?.enemyPlanes,
      fuel: brief?.fuel,
      planes: brief?.planes,
      skyLost: brief?.skyLost,
    }).toStrictEqual({
      enemyPlanes: exactly(25),
      fuel: 0.5,
      planes: 30,
      skyLost: 1,
    });
  });

  it("should offer no technology when every research slot is busy", () => {
    const busy = advancedTo(ROW_SIMULATION, {
      ...START_ADVANCEMENT,
      research: {
        ...START_RESEARCH,
        studies: [
          { ahead: 0, bonus: 0, progress: 0, saved: 0, tech: "fuel-storage" },
          {
            ahead: 0,
            bonus: 0,
            progress: 0,
            saved: 0,
            tech: "construction-1",
          },
          {
            ahead: 0,
            bonus: 0,
            progress: 0,
            saved: 0,
            tech: "basic-machine-tools",
          },
        ],
      },
    });

    expect(briefOfFirst(councilOf(ROW_WORLD, busy))?.techs).toStrictEqual([]);
  });
});

describe(peaceTalksOf, () => {
  it("should report how much of the loser's homeland each side holds when talks open", () => {
    expect(peaceTalksOf(ROW_WORLD, TALKING, NEGOTIATION)).toStrictEqual({
      _tag: "peace",
      date: "1936-01-01",
      loser: 1,
      loserHeld: 0,
      victor: 0,
      victorHeld: 1,
    });
  });
});

describe(councilDayOf, () => {
  it("should name the first of the month when the clock is partway through it", () => {
    expect(councilDayOf({ days: 45, paused: false, speed: 2 })).toBe(31);
  });
});

/** Nation 0 with five dockyards and `navy`, the others as the row opens. */
const shipbuilder = (navy: Navy): Simulation => ({
  ...ROW_SIMULATION,
  economies: replacedAt(ROW_SIMULATION.economies, 0, {
    ...NO_ECONOMY,
    dockyards: 5,
  }),
  navies: replacedAt(ROW_SIMULATION.navies, 0, navy),
});

describe(ruledByRules, () => {
  /** Nations 0 and 1 at war, each with the strength `divisions` gives it. */
  const atWar = (divisions: Simulation["divisions"]): Simulation => ({
    ...withDiplomacy(warDeclared(ROW_SIMULATION.diplomacy, 0, 1)),
    divisions,
  });

  it("should call up one law more and turn the plan one step toward war when a nation is at war", () => {
    const after = ruledByRules(ROW_WORLD, atWar([]), COUNCIL_DAY);

    expect({
      conscription: after.economies[0]?.conscription,
      plan: after.economies[0]?.plan,
    }).toStrictEqual({ conscription: "limited", plan: "balanced" });
  });

  it("should keep the law when a nation at war still has men to call up", () => {
    const manned: Simulation = {
      ...atWar([]),
      economies: ROW_SIMULATION.economies.map((economy) => ({
        ...economy,
        manpower: 1_000_000,
      })),
    };

    expect(
      ruledByRules(ROW_WORLD, manned, COUNCIL_DAY).economies[0]?.conscription
    ).toBe("volunteer");
  });

  it("should keep the heaviest law when a nation at war already has it", () => {
    const drafted: Simulation = {
      ...atWar([]),
      economies: ROW_SIMULATION.economies.map((economy) => ({
        ...economy,
        conscription: "all-adults",
      })),
    };

    expect(
      ruledByRules(ROW_WORLD, drafted, COUNCIL_DAY).economies[0]?.conscription
    ).toBe("all-adults");
  });

  it("should turn to the offensive when a nation outmatches every enemy", () => {
    expect(
      ruledByRules(
        ROW_WORLD,
        atWar([division({ nation: 0, province: 0 })]),
        COUNCIL_DAY
      ).stances
    ).toStrictEqual(["offensive", "defensive", "balanced", "balanced"]);
  });

  it("should keep the stance balanced when a nation is evenly matched with its enemy", () => {
    expect(
      ruledByRules(
        ROW_WORLD,
        atWar([
          division({ nation: 0, province: 0 }),
          division({ nation: 1, province: 1 }),
        ]),
        COUNCIL_DAY
      ).stances
    ).toStrictEqual(["balanced", "balanced", "balanced", "balanced"]);
  });

  it("should draw apart when two months are decided on the same day", () => {
    const armed: Simulation = {
      ...MILITARIST_THREE,
      divisions: [division({ nation: 3, province: 3 })],
    };

    expect([
      ruledByRules(ROW_WORLD, armed, 31).diplomacy.warGoals.length,
      ruledByRules(ROW_WORLD, armed, 60).diplomacy.warGoals.length,
    ]).toStrictEqual([0, 1]);
  });

  it("should start justifying the war goal the month's draw allows when a militarist nation's council meets on 1936-03-01", () => {
    const armed: Simulation = {
      ...MILITARIST_THREE,
      clock: { ...ROW_SIMULATION.clock, days: 60 },
      divisions: [division({ nation: 3, province: 3 })],
    };

    expect(ruledByRules(ROW_WORLD, armed, 60).diplomacy.warGoals).toStrictEqual(
      [{ nation: 3, readyOn: 240, target: 2 }]
    );
  });

  it("should justify nothing when a nation that took no stand meets under half world tension", () => {
    const armed: Simulation = {
      ...ROW_SIMULATION,
      clock: { ...ROW_SIMULATION.clock, days: 60 },
      divisions: [division({ nation: 3, province: 3 })],
    };

    expect(ruledByRules(ROW_WORLD, armed, 60).diplomacy.warGoals).toStrictEqual(
      []
    );
  });

  it("should declare on the target of its justified war goal when its side outmatches the target's", () => {
    expect(
      enemiesOf(ruledByRules(ROW_WORLD, JUSTIFIED_THREE, 60).diplomacy.wars, 3)
    ).toStrictEqual([2]);
  });

  it("should start the forces' technologies first when the rules declare war in the same council", () => {
    expect(
      ruledByRules(
        ROW_WORLD,
        JUSTIFIED_THREE,
        60
      ).advancements[3]?.research.studies.map((study) => study.tech)
    ).toStrictEqual(["great-war-tank", "early-truck", "mountain-infantry-1"]);
  });

  it("should join the faction across its border when a nation is threatened", () => {
    const threatened: Simulation = {
      ...withDiplomacy(openingDiplomacy(ROW_OWNERS, 4, [0])),
      divisions: [division({ nation: 2, province: 2 })],
    };

    expect([
      ...ruledByRules(ROW_WORLD, threatened, COUNCIL_DAY).diplomacy.factions,
    ]).toStrictEqual([0, 0, -1, -1]);
  });

  it("should start the oldest technology first and then the economy's for this year when a nation is at peace", () => {
    expect(
      startedTechs(ruledByRules(ROW_WORLD, ROW_SIMULATION, COUNCIL_DAY))
    ).toStrictEqual([
      "great-war-tank",
      "basic-machine-tools",
      "construction-1",
    ]);
  });

  it("should start the forces' technologies first on every free slot when a nation is at war", () => {
    expect(
      startedTechs(ruledByRules(ROW_WORLD, atWar([]), COUNCIL_DAY))
    ).toStrictEqual(["great-war-tank", "early-truck", "mountain-infantry-1"]);
  });

  it("should start the economy's technologies meant for this year before the forces' later ones when a nation at war has none of its own left for this year", () => {
    expect(
      startedTechs(
        ruledByRules(
          ROW_WORLD,
          researchedAll(atWar([]), [
            "great-war-tank",
            "light-tank-1",
            "light-tank-2",
            "heavy-tank-1",
            "early-truck",
            "truck",
            "mountain-infantry-1",
            "marines-1",
            "paratroopers-1",
            "basic-light-battery",
            "basic-medium-battery",
            "basic-heavy-battery",
            "small-caliber-semi-armor-piercing-shell",
            "armor-piercing-capped-medium-shell",
            "armor-piercing-capped-shell",
            "magnetic-detonator",
          ]),
          COUNCIL_DAY
        )
      )
    ).toStrictEqual(["basic-machine-tools", "construction-1", "fuel-storage"]);
  });

  it("should pass over a technology an earlier pick ruled out when the rules fill the slots", () => {
    expect(
      startedTechs(
        ruledByRules(
          ROW_WORLD,
          researchedAll(ROW_SIMULATION, ["basic-machine-tools"]),
          COUNCIL_DAY
        )
      )
    ).toStrictEqual([
      "great-war-tank",
      "concentrated-industry-1",
      "construction-1",
    ]);
  });

  it("should limit exports when a nation is at war", () => {
    expect(
      ruledByRules(ROW_WORLD, atWar([]), COUNCIL_DAY).economies[0]?.tradeLaw
    ).toBe("limited-exports");
  });

  it("should keep exports its focus when a nation is at peace", () => {
    expect(
      ruledByRules(ROW_WORLD, ROW_SIMULATION, COUNCIL_DAY).economies[0]
        ?.tradeLaw
    ).toBe("export-focus");
  });

  it("should lay down battleships when a nation with dockyards has convoys to spare and no capital ship to screen", () => {
    expect(
      ruledByRules(
        ROW_WORLD,
        shipbuilder({ ...NO_NAVY, convoys: 1000 }),
        COUNCIL_DAY
      ).navies[0]?.order
    ).toBe("battleship");
  });

  it("should lay down convoys when a nation's lanes want more than it has afloat", () => {
    expect(
      ruledByRules(
        ROW_WORLD,
        shipbuilder({
          ...NO_NAVY,
          convoys: 100,
          lanes: [{ cargo: "trade", convoys: 100, zones: [4] }],
          order: "battleship",
        }),
        COUNCIL_DAY
      ).navies[0]?.order
    ).toBe("convoy");
  });

  it("should leave the dockyards alone when a nation has none", () => {
    expect(
      ruledByRules(
        ROW_WORLD,
        { ...shipbuilder(NO_NAVY), economies: ROW_SIMULATION.economies },
        COUNCIL_DAY
      ).navies[0]
    ).toBe(NO_NAVY);
  });

  it.each<{
    condition: string;
    simulation: Simulation;
    air: { readonly aviation: string; readonly order: string };
  }>([
    {
      air: { aviation: "light", order: "fighter" },
      condition: "a nation at peace has no planes",
      simulation: ROW_SIMULATION,
    },
    {
      air: { aviation: "light", order: "close-support" },
      condition:
        "a nation at peace has more than two thirds of its planes in fighters",
      simulation: {
        ...ROW_SIMULATION,
        airForces: replacedAt(
          ROW_SIMULATION.airForces,
          0,
          airForceOf([
            wing({ base: 0, model: "fighter-1", planes: 30 }),
            wing({ base: 0, model: "close-air-support-1", planes: 10 }),
          ])
        ),
      },
    },
    {
      air: { aviation: "heavy", order: "fighter" },
      condition: "a nation at war has lost a sky it flies over to its enemy",
      simulation: {
        ...atWar([]),
        airPower: replacedAt(
          replacedAt(ROW_SIMULATION.airPower, 0, Float32Array.from([2, 0])),
          1,
          Float32Array.from([10, 0])
        ),
      },
    },
    {
      air: { aviation: "light", order: "fighter" },
      condition: "a nation at war has fewer fighters than its enemy",
      simulation: {
        ...atWar([]),
        airForces: replacedAt(
          replacedAt(
            ROW_SIMULATION.airForces,
            0,
            airForceOf([wing({ base: 0, model: "fighter-1", planes: 10 })])
          ),
          1,
          airForceOf([wing({ base: 1, model: "fighter-1", planes: 20 })])
        ),
      },
    },
    {
      air: { aviation: "light", order: "naval-bomber" },
      condition: "a nation at war is outgunned at sea",
      simulation: {
        ...atWar([]),
        navies: replacedAt(
          ROW_SIMULATION.navies,
          1,
          openingNavy(4, 4, OPENING_ARMOURY.ships)
        ),
      },
    },
    {
      air: { aviation: "light", order: "close-support" },
      condition: "a nation at war holds the sky and the sea",
      simulation: atWar([]),
    },
  ])(
    "should put the air factories on $air.order at $air.aviation when $condition",
    ({ air, simulation }) => {
      const after = ruledByRules(ROW_WORLD, simulation, COUNCIL_DAY);

      expect({
        aviation: after.airForces[0]?.aviation,
        order: after.airForces[0]?.order,
      }).toStrictEqual(air);
    }
  );

  it("should pursue the first focus outside the army's branch when a nation is at peace", () => {
    expect(
      ruledByRules(ROW_WORLD, ROW_SIMULATION, COUNCIL_DAY).advancements[0]
        ?.focuses.current
    ).toStrictEqual(Option.some({ focus: "industrialisation", progress: 0 }));
  });

  it.each([
    { leaning: "army", stand: "militarism" },
    { leaning: "navy", stand: "neutrality" },
    { leaning: "industry", stand: "neutrality" },
  ] satisfies readonly {
    readonly leaning: Leaning;
    readonly stand: FocusId;
  }[])(
    "should take $stand when a $leaning nation at peace reaches its political stand",
    ({ leaning, stand }) => {
      const world: World = {
        ...ROW_WORLD,
        nations: ROW_WORLD.nations.map((nation) => ({ ...nation, leaning })),
      };
      const reached = replacedAt(ROW_SIMULATION.advancements, 0, {
        ...START_ADVANCEMENT,
        focuses: { ...START_FOCUSES, done: UP_TO_THE_STAND },
      });

      expect(
        ruledByRules(
          world,
          { ...ROW_SIMULATION, advancements: reached },
          COUNCIL_DAY
        ).advancements[0]?.focuses.current
      ).toStrictEqual(Option.some({ focus: stand, progress: 0 }));
    }
  );

  it("should pursue the first focus in the army's branch when a nation is at war", () => {
    expect(
      ruledByRules(ROW_WORLD, atWar([]), COUNCIL_DAY).advancements[0]?.focuses
        .current
    ).toStrictEqual(Option.some({ focus: "army-effort", progress: 0 }));
  });
});

/** Every upgrade the rules' order at peace names, with every level bought. */
const PEACE_BOUGHT: Agency["upgrades"] = [
  "civilian-department",
  "passive-defense",
  "passive-defense",
  "passive-defense",
  "passive-defense",
  "cryptology-department",
  "cypher-school",
  "cypher-school",
  "cypher-school",
];

/** A founded agency with `upgrades` bought and nothing under way. */
const foundedWith = (upgrades: Agency["upgrades"]): Agency => ({
  ...NO_AGENCY,
  standing: "founded",
  upgrades,
});

/** `simulation` with `nation`'s service patched by `patch`. */
const servedBy = (
  simulation: Simulation,
  nation: number,
  patch: Partial<Service>
): Simulation => ({
  ...simulation,
  services: replacedAt(simulation.services, nation, {
    ...serviceFor(ROW_WORLD.nations.length),
    ...patch,
  }),
});

/** The row with nation 0 at war with nation 1. */
const ROW_AT_WAR = withDiplomacy(warDeclared(ROW_SIMULATION.diplomacy, 0, 1));

describe("ruledByRules for the intelligence services", () => {
  it.each<{ condition: string; simulation: Simulation; agency: Agency }>([
    {
      agency: {
        ...NO_AGENCY,
        work: { daysLeft: AGENCY_DAYS, kind: "working", project: "found" },
      },
      condition: "a nation has no agency yet",
      simulation: ROW_SIMULATION,
    },
    {
      agency: {
        ...foundedWith([]),
        work: {
          daysLeft: AGENCY_DAYS,
          kind: "working",
          project: "civilian-department",
        },
      },
      condition: "a nation at peace has a new agency",
      simulation: servedBy(ROW_SIMULATION, 0, { agency: foundedWith([]) }),
    },
    {
      agency: {
        ...foundedWith([]),
        work: {
          daysLeft: AGENCY_DAYS,
          kind: "working",
          project: "army-department",
        },
      },
      condition: "a nation at war has a new agency",
      simulation: servedBy(ROW_AT_WAR, 0, { agency: foundedWith([]) }),
    },
    {
      agency: {
        ...foundedWith(PEACE_BOUGHT),
        work: {
          daysLeft: AGENCY_DAYS,
          kind: "working",
          project: "army-department",
        },
      },
      condition: "a nation at peace has bought everything its order names",
      simulation: servedBy(ROW_SIMULATION, 0, {
        agency: foundedWith(PEACE_BOUGHT),
      }),
    },
    {
      agency: {
        ...NO_AGENCY,
        work: { daysLeft: 3, kind: "working", project: "found" },
      },
      condition: "a nation's agency is still at work",
      simulation: servedBy(ROW_SIMULATION, 0, {
        agency: {
          ...NO_AGENCY,
          work: { daysLeft: 3, kind: "working", project: "found" },
        },
      }),
    },
  ])(
    "should have the agency working on $agency.work.project when $condition",
    ({ agency, simulation }) => {
      expect(
        ruledByRules(ROW_WORLD, simulation, COUNCIL_DAY).services[0]?.agency
      ).toStrictEqual(agency);
    }
  );

  it.each<{ condition: string; simulation: Simulation; target: number }>([
    {
      condition: "a nation at war fights two enemies",
      simulation: {
        ...withDiplomacy(
          warDeclared(warDeclared(ROW_SIMULATION.diplomacy, 1, 0), 1, 2)
        ),
        divisions: [division({ nation: 2, province: 2 })],
      },
      target: 2,
    },
    {
      condition: "a nation at peace borders two neighbours",
      simulation: {
        ...ROW_SIMULATION,
        divisions: [division({ nation: 2, province: 2 })],
      },
      target: 2,
    },
    {
      condition: "a nation's operatives already work in a neighbour",
      simulation: {
        ...servedBy(ROW_SIMULATION, 1, { target: 0 }),
        divisions: [division({ nation: 2, province: 2 })],
      },
      target: 0,
    },
    {
      condition:
        "a nation's operatives work in a nation it neither borders nor fights",
      simulation: servedBy(ROW_SIMULATION, 1, { target: 3 }),
      target: 0,
    },
  ])(
    "should send nation 1's operatives to nation $target when $condition",
    ({ simulation, target }) => {
      expect(
        ruledByRules(ROW_WORLD, simulation, COUNCIL_DAY).services[1]?.target
      ).toBe(target);
    }
  );

  it("should keep the operatives home when a nation neither borders nor fights anyone", () => {
    const stranded: Simulation = {
      ...servedBy(ROW_SIMULATION, 3, { target: 1 }),
      owners: Int32Array.from([0, 1, 2, UNASSIGNED, UNASSIGNED]),
    };

    expect(
      ruledByRules(ROW_WORLD, stranded, COUNCIL_DAY).services[3]?.target
    ).toBe(HOME);
  });
});

const fromJev = (probability: number) => ({ kind: "jev", probability });

describe(rulingsFrom, () => {
  it("should decide the law when a conscription verdict names one", () => {
    expect(
      rulingsFrom(
        COUNCIL,
        [verdict({ choice: "limited", question: "conscription" })],
        ANY_DRAW
      )
    ).toStrictEqual([
      {
        decision: { kind: "conscription", law: "limited", nation: 1 },
        source: fromJev(0.7),
      },
    ]);
  });

  it("should decide the plan when a plan verdict names one", () => {
    expect(
      rulingsFrom(
        COUNCIL,
        [verdict({ choice: "military", question: "plan" })],
        ANY_DRAW
      )
    ).toStrictEqual([
      {
        decision: { kind: "plan", nation: 1, plan: "military" },
        source: fromJev(0.7),
      },
    ]);
  });

  it("should decide the stance when a stance verdict names one", () => {
    expect(
      rulingsFrom(
        COUNCIL,
        [verdict({ choice: "defensive", question: "stance" })],
        ANY_DRAW
      )
    ).toStrictEqual([
      {
        decision: { kind: "stance", nation: 1, stance: "defensive" },
        source: fromJev(0.7),
      },
    ]);
  });

  it("should declare on the rival the draw lands on when Jev weighs a war", () => {
    const weighed = verdict({
      weights: [
        { choice: "none", probability: 0.3 },
        { choice: "n2", probability: 0.7 },
      ],
    });

    expect(rulingsFrom(COUNCIL, [weighed], landingOn(0.5))).toStrictEqual([
      {
        decision: { kind: "declare", nation: 1, target: 2 },
        source: fromJev(0.7),
      },
    ]);
  });

  it("should start justifying on the rival the draw lands on when Jev weighs a justification", () => {
    const weighed = verdict({
      question: "justify",
      weights: [
        { choice: "none", probability: 0.3 },
        { choice: "j0", probability: 0.7 },
      ],
    });

    expect(rulingsFrom(COUNCIL, [weighed], landingOn(0.5))).toStrictEqual([
      {
        decision: { kind: "justify", nation: 1, target: 0 },
        source: fromJev(0.7),
      },
    ]);
  });

  it("should justify nothing when Jev names a nation the brief did not offer to justify on", () => {
    const weighed = verdict({
      question: "justify",
      weights: [{ choice: "j2", probability: 1 }],
    });

    expect(rulingsFrom(COUNCIL, [weighed], landingOn(0.5))).toStrictEqual([]);
  });

  it("should keep the peace when the draw lands on none", () => {
    const weighed = verdict({
      weights: [
        { choice: "none", probability: 0.9 },
        { choice: "n2", probability: 0.1 },
      ],
    });

    expect(rulingsFrom(COUNCIL, [weighed], landingOn(0.5))).toStrictEqual([]);
  });

  it("should keep the peace when the draw falls past every weight Jev gave", () => {
    const weighed = verdict({ weights: [{ choice: "n2", probability: 0.5 }] });

    expect(rulingsFrom(COUNCIL, [weighed], landingOn(0.9))).toStrictEqual([]);
  });

  it("should decide the trade law when a trade verdict names one", () => {
    expect(
      rulingsFrom(
        COUNCIL,
        [verdict({ choice: "free-trade", question: "trade" })],
        ANY_DRAW
      )
    ).toStrictEqual([
      {
        decision: { kind: "trade", law: "free-trade", nation: 1 },
        source: fromJev(0.7),
      },
    ]);
  });

  it("should turn the dockyards when a shipbuilding verdict names an order and the nation has dockyards", () => {
    const building: Council = {
      ...COUNCIL,
      nations: [{ ...BRIEF, dockyards: 3 }],
    };

    expect(
      rulingsFrom(
        building,
        [verdict({ choice: "submarine", question: "shipbuilding" })],
        ANY_DRAW
      )
    ).toStrictEqual([
      {
        decision: { kind: "shipbuilding", nation: 1, order: "submarine" },
        source: fromJev(0.7),
      },
    ]);
  });

  it("should pick the build site when a build-site verdict names a province the brief offered", () => {
    const building: Council = {
      ...COUNCIL,
      nations: [
        {
          ...BRIEF,
          buildSites: [
            { coastal: false, free: 2, infrastructure: 3, province: 7 },
          ],
        },
      ],
    };

    expect(
      rulingsFrom(
        building,
        [verdict({ choice: "p7", probability: 0.3, question: "build-site" })],
        ANY_DRAW
      )
    ).toStrictEqual([
      {
        decision: { kind: "build-site", nation: 1, province: 7 },
        source: fromJev(0.3),
      },
    ]);
  });

  it("should raise the kind of division a sure division-kind verdict names when the brief offered it", () => {
    expect(
      rulingsFrom(
        COUNCIL,
        [
          verdict({
            choice: "cavalry",
            probability: 0.8,
            question: "division-kind",
          }),
        ],
        ANY_DRAW
      )
    ).toStrictEqual([
      {
        decision: { division: "cavalry", kind: "division-kind", nation: 1 },
        source: fromJev(0.8),
      },
    ]);
  });

  it("should hand the depots back to the mix when a sure division-kind verdict names the mix", () => {
    expect(
      rulingsFrom(
        COUNCIL,
        [
          verdict({
            choice: "mix",
            probability: 0.8,
            question: "division-kind",
          }),
        ],
        ANY_DRAW
      )
    ).toStrictEqual([
      {
        decision: { division: "mix", kind: "division-kind", nation: 1 },
        source: fromJev(0.8),
      },
    ]);
  });

  it("should decide nothing when a division-kind verdict names a kind the nation's research has not unlocked", () => {
    expect(
      rulingsFrom(
        COUNCIL,
        [
          verdict({
            choice: "heavy-armour",
            probability: 0.8,
            question: "division-kind",
          }),
        ],
        ANY_DRAW
      )
    ).toStrictEqual([]);
  });

  it("should decide nothing when a build-site verdict names a province the brief never offered", () => {
    expect(
      rulingsFrom(
        COUNCIL,
        [verdict({ choice: "p7", question: "build-site" })],
        ANY_DRAW
      )
    ).toStrictEqual([]);
  });

  it("should decide nothing when a shipbuilding verdict is about a nation with no dockyards", () => {
    expect(
      rulingsFrom(
        COUNCIL,
        [verdict({ choice: "submarine", question: "shipbuilding" })],
        ANY_DRAW
      )
    ).toStrictEqual([]);
  });

  it("should change nothing when Jev is unsure of a new law", () => {
    expect(
      rulingsFrom(
        COUNCIL,
        [
          verdict({
            choice: "limited",
            probability: 0.4,
            question: "conscription",
          }),
        ],
        ANY_DRAW
      )
    ).toStrictEqual([]);
  });

  it("should join the faction when a faction verdict names one", () => {
    expect(
      rulingsFrom(
        COUNCIL,
        [verdict({ choice: "f0", question: "faction" })],
        ANY_DRAW
      )
    ).toStrictEqual([
      {
        decision: { faction: 0, kind: "join", nation: 1 },
        source: fromJev(0.7),
      },
    ]);
  });

  it("should decide nothing when the draw lands on an option the brief never offered", () => {
    const weighed = verdict({ weights: [{ choice: "n3", probability: 1 }] });

    expect(rulingsFrom(COUNCIL, [weighed], ANY_DRAW)).toStrictEqual([]);
  });

  it("should decide nothing when the verdict is about a nation the council did not brief", () => {
    expect(
      rulingsFrom(
        COUNCIL,
        [verdict({ choice: "limited", nation: 2, question: "conscription" })],
        ANY_DRAW
      )
    ).toStrictEqual([]);
  });

  it("should leave terms to the talks when a council verdict names some", () => {
    expect(
      rulingsFrom(
        COUNCIL,
        [verdict({ choice: "annex", question: "terms" })],
        ANY_DRAW
      )
    ).toStrictEqual([]);
  });

  it("should hand every offered technology on, the heaviest first, when Jev weighs the research", () => {
    const researching: Council = {
      ...COUNCIL,
      nations: [
        { ...BRIEF, freeSlots: 1, techs: ["construction-1", "fuel-storage"] },
      ],
    };

    expect(
      rulingsFrom(
        researching,
        [
          verdict({
            choice: "fuel-storage",
            question: "research",
            weights: [
              { choice: "construction-1", probability: 0.3 },
              { choice: "fuel-storage", probability: 0.6 },
            ],
          }),
        ],
        ANY_DRAW
      )
    ).toStrictEqual([
      {
        decision: { kind: "research", nation: 1, tech: "fuel-storage" },
        source: fromJev(0.6),
      },
      {
        decision: { kind: "research", nation: 1, tech: "construction-1" },
        source: fromJev(0.3),
      },
    ]);
  });

  it("should pass over a technology the brief never offered when Jev weighs one", () => {
    expect(
      rulingsFrom(
        COUNCIL,
        [
          verdict({
            choice: "construction-1",
            question: "research",
            weights: [{ choice: "construction-1", probability: 1 }],
          }),
        ],
        ANY_DRAW
      )
    ).toStrictEqual([]);
  });

  it("should start the project Jev picked when an agency verdict names one it is unsure of", () => {
    const founding: Council = {
      ...COUNCIL,
      nations: [{ ...BRIEF, agencyProjects: ["found"] }],
    };

    expect(
      rulingsFrom(
        founding,
        [verdict({ choice: "found", probability: 0.2, question: "agency" })],
        ANY_DRAW
      )
    ).toStrictEqual([
      {
        decision: { kind: "agency", nation: 1, project: "found" },
        source: fromJev(0.2),
      },
    ]);
  });

  it.each([
    { decided: 1, posted: false },
    { decided: 0, posted: true },
  ])(
    "should carry out $decided espionage rulings for a pick Jev is unsure of when the operatives are posted is $posted",
    ({ decided, posted }) => {
      const sending: Council = {
        ...COUNCIL,
        nations: [{ ...BRIEF, posted, spyTargets: [{ known: 0, nation: 2 }] }],
      };

      expect(
        rulingsFrom(
          sending,
          [verdict({ choice: "s2", probability: 0.3, question: "espionage" })],
          ANY_DRAW
        )
      ).toHaveLength(decided);
    }
  );

  it("should pursue the focus Jev picked when a focus verdict names one", () => {
    const choosing: Council = {
      ...COUNCIL,
      nations: [{ ...BRIEF, focuses: ["army-effort"] }],
    };

    expect(
      rulingsFrom(
        choosing,
        [
          verdict({
            choice: "army-effort",
            probability: 0.2,
            question: "focus",
          }),
        ],
        ANY_DRAW
      )
    ).toStrictEqual([
      {
        decision: { focus: "army-effort", kind: "focus", nation: 1 },
        source: fromJev(0.2),
      },
    ]);
  });
});

describe("rulingsFrom for the air force", () => {
  it.each<{
    question: "aircraft" | "aviation";
    choice: string;
    decided: readonly unknown[];
  }>([
    {
      choice: "naval-bomber",
      decided: [
        {
          decision: { aircraft: "naval-bomber", kind: "aircraft", nation: 1 },
          source: fromJev(0.7),
        },
      ],
      question: "aircraft",
    },
    { choice: "zeppelin", decided: [], question: "aircraft" },
    {
      choice: "heavy",
      decided: [
        {
          decision: { aviation: "heavy", kind: "aviation", nation: 1 },
          source: fromJev(0.7),
        },
      ],
      question: "aviation",
    },
    { choice: "total", decided: [], question: "aviation" },
  ])(
    "should decide $decided.length ruling when an $question verdict names $choice",
    ({ choice, decided, question }) => {
      expect(
        rulingsFrom(COUNCIL, [verdict({ choice, question })], ANY_DRAW)
      ).toStrictEqual(decided);
    }
  );
});

/** A council whose one brief offers founding the agency and spying on nation 2. */
const INTELLIGENCE_COUNCIL: Council = {
  ...COUNCIL,
  nations: [
    {
      ...BRIEF,
      agencyProjects: ["found"],
      operatives: 1,
      spyTargets: [{ known: 0, nation: 2 }],
    },
  ],
};

describe("rulingsFrom for the intelligence service", () => {
  it.each<{
    question: "agency" | "espionage";
    choice: string;
    decided: readonly unknown[];
  }>([
    {
      choice: "found",
      decided: [
        {
          decision: { kind: "agency", nation: 1, project: "found" },
          source: fromJev(0.7),
        },
      ],
      question: "agency",
    },
    { choice: "civilian-department", decided: [], question: "agency" },
    {
      choice: "home",
      decided: [
        {
          decision: { kind: "espionage", nation: 1, target: HOME },
          source: fromJev(0.7),
        },
      ],
      question: "espionage",
    },
    {
      choice: "s2",
      decided: [
        {
          decision: { kind: "espionage", nation: 1, target: 2 },
          source: fromJev(0.7),
        },
      ],
      question: "espionage",
    },
    { choice: "s3", decided: [], question: "espionage" },
  ])(
    "should decide $decided.length ruling when an $question verdict names $choice",
    ({ choice, decided, question }) => {
      expect(
        rulingsFrom(
          INTELLIGENCE_COUNCIL,
          [verdict({ choice, question })],
          ANY_DRAW
        )
      ).toStrictEqual(decided);
    }
  );
});

describe(termsFrom, () => {
  it("should dictate the named terms under the talks' victor when Jev names terms", () => {
    expect(
      termsFrom(NEGOTIATION, [
        verdict({ choice: "puppet", probability: 0.8, question: "terms" }),
      ])
    ).toStrictEqual(
      Option.some({
        decision: {
          kind: "peace",
          loser: 1,
          settlement: { terms: "puppet", victor: 0 },
        },
        source: { kind: "jev", probability: 0.8 },
      })
    );
  });

  it("should name no terms when no verdict is about the loser's talks", () => {
    expect(
      termsFrom(NEGOTIATION, [
        verdict({ choice: "puppet", nation: 2, question: "terms" }),
      ])
    ).toStrictEqual(Option.none());
  });

  it("should name no terms when the verdict names terms that do not exist", () => {
    expect(
      termsFrom(NEGOTIATION, [
        verdict({ choice: "tribute", question: "terms" }),
      ])
    ).toStrictEqual(Option.none());
  });
});

describe(ruledByJev, () => {
  it("should carry out every decision when Jev's verdicts name several", () => {
    const convened = {
      council: councilOf(ROW_WORLD, ROW_SIMULATION),
      day: COUNCIL_DAY,
    };

    const after = ruledByJev(ROW_WORLD, ROW_SIMULATION, convened, [
      verdict({ choice: "limited", nation: 0, question: "conscription" }),
      verdict({ choice: "military", nation: 3, question: "plan" }),
    ]);

    expect(
      after.economies.map((economy) => [economy.conscription, economy.plan])
    ).toStrictEqual([
      ["limited", "civilian"],
      ["volunteer", "civilian"],
      ["volunteer", "civilian"],
      ["volunteer", "military"],
    ]);
  });
});

describe(afterCouncil, () => {
  const atWar = withDiplomacy(warDeclared(ROW_SIMULATION.diplomacy, 0, 1));
  const convened = { council: councilOf(ROW_WORLD, atWar), day: COUNCIL_DAY };

  it("should carry out Jev's verdicts when Jev answered", () => {
    const after = afterCouncil(ROW_WORLD, atWar, convened, {
      _tag: "answered",
      verdicts: [
        verdict({ choice: "extensive", nation: 0, question: "conscription" }),
      ],
    });

    expect(after.economies[0]?.conscription).toBe("extensive");
  });

  it("should decide the month by the rules when Jev could not be asked", () => {
    const after = afterCouncil(ROW_WORLD, atWar, convened, {
      _tag: "rate-limited",
    });

    expect(after.economies[0]?.conscription).toBe("limited");
  });
});

describe(afterTalks, () => {
  /** The talks with the loser still holding province 2. */
  const HOLDING: Simulation = {
    ...TALKING,
    owners: Int32Array.from([0, 0, 1, 3, UNASSIGNED]),
  };

  it("should sign the terms Jev names when Jev answered", () => {
    const after = afterTalks(ROW_WORLD, HOLDING, NEGOTIATION, {
      _tag: "answered",
      verdicts: [verdict({ choice: "cede", question: "terms" })],
    });

    expect(standingOf(after.diplomacy, 1)).toStrictEqual(INDEPENDENT);
  });

  it("should sign the rules' terms when Jev answered without naming any", () => {
    const after = afterTalks(ROW_WORLD, HOLDING, NEGOTIATION, {
      _tag: "answered",
      verdicts: [],
    });

    expect(standingOf(after.diplomacy, 1)).toStrictEqual({
      by: 0,
      kind: "annexed",
    });
  });

  it("should sign the rules' terms when Jev could not be asked", () => {
    const after = afterTalks(ROW_WORLD, HOLDING, NEGOTIATION, {
      _tag: "unavailable",
    });

    expect(after.chronicle[0]?.ruling.source).toStrictEqual({ kind: "rules" });
  });

  it("should change nothing when the talks it answers have closed and others opened", () => {
    const reopened: Simulation = {
      ...HOLDING,
      negotiations: [{ ...NEGOTIATION, openedOn: 40 }],
    };

    expect(
      afterTalks(ROW_WORLD, reopened, NEGOTIATION, { _tag: "unavailable" })
    ).toBe(reopened);
  });
});
