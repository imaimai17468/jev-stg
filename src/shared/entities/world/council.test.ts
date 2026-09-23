import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { Advancement } from "./advancement";
import { START_ADVANCEMENT } from "./advancement";
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
import type { Random } from "./random";
import type { Simulation } from "./simulation";
import { UNASSIGNED } from "./spread";
import { enemiesOf, warCount } from "./wars";

const withDiplomacy = (diplomacy: Diplomacy): Simulation => ({
  ...ROW_SIMULATION,
  diplomacy,
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

/** A brief with nothing in it, for the verdicts to be read against. */
const BRIEF: NationBrief = {
  atWar: false,
  civilianFactories: 0,
  enemyStrength: 0,
  equipment: 0,
  factions: [{ faction: 0, strength: 0 }],
  focuses: [],
  freeSlots: 0,
  manpower: 0,
  militaryFactories: 0,
  nation: 1,
  population: 0,
  rivals: [{ nation: 2, strength: 0 }],
  strength: 0,
  techs: [],
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

/** Nation 0 with the technologies of `researched` finished. */
const researchedAll = (
  simulation: Simulation,
  researched: Advancement["research"]["researched"]
): Simulation =>
  advancedTo(simulation, {
    ...START_ADVANCEMENT,
    research: { researched, studies: [] },
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

  it("should offer the neighbours it outmatches and the factions across its borders when a nation is unaligned and at peace", () => {
    const armed: Simulation = {
      ...ORDERED,
      divisions: [division({ nation: 1, province: 1 })],
    };
    const brief = councilOf(ROW_WORLD, armed).nations.find(
      (entry) => entry.nation === 1
    );

    expect({
      factions: brief?.factions,
      rivals: brief?.rivals,
    }).toStrictEqual({
      factions: [{ faction: 0, strength: 0 }],
      rivals: [
        { nation: 0, strength: 0 },
        { nation: 2, strength: 0 },
      ],
    });
  });

  it("should offer no neighbour to declare on when the nation outmatches none of them", () => {
    const brief = councilOf(ROW_WORLD, ORDERED).nations.find(
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

  it("should count what its enemies have in the field when the nation is at war", () => {
    const fighting: Simulation = {
      ...withDiplomacy(warDeclared(ROW_SIMULATION.diplomacy, 0, 1)),
      divisions: [division({ nation: 1, province: 1 })],
    };

    expect(
      councilOf(ROW_WORLD, fighting).nations.find((entry) => entry.nation === 0)
        ?.enemyStrength
    ).toBe(20_000);
  });

  it("should offer the free slots every technology and focus without a prerequisite when a government has researched nothing", () => {
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
        "infantry-weapons-1",
        "artillery-1",
        "modern-tactics",
        "tools-1",
        "construction-1",
        "electronics-1",
        "logistics-1",
      ],
    });
  });

  it("should offer no technology when every research slot is busy", () => {
    const busy = advancedTo(ROW_SIMULATION, {
      ...START_ADVANCEMENT,
      research: {
        researched: [],
        studies: [
          { progress: 0, tech: "tools-1" },
          { progress: 0, tech: "construction-1" },
          { progress: 0, tech: "electronics-1" },
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
      ...ROW_SIMULATION,
      divisions: [division({ nation: 3, province: 3 })],
    };

    expect([
      warCount(ruledByRules(ROW_WORLD, armed, 31).diplomacy.wars),
      warCount(ruledByRules(ROW_WORLD, armed, 60).diplomacy.wars),
    ]).toStrictEqual([0, 1]);
  });

  it("should declare the war the month's draw allows when the council meets on 1936-03-01", () => {
    const armed: Simulation = {
      ...ROW_SIMULATION,
      clock: { ...ROW_SIMULATION.clock, days: 60 },
      divisions: [division({ nation: 3, province: 3 })],
    };

    expect(
      enemiesOf(ruledByRules(ROW_WORLD, armed, 60).diplomacy.wars, 3)
    ).toStrictEqual([2]);
  });

  it("should start the army's technologies first when the rules declare war in the same council", () => {
    const armed: Simulation = {
      ...ROW_SIMULATION,
      clock: { ...ROW_SIMULATION.clock, days: 60 },
      divisions: [division({ nation: 3, province: 3 })],
    };

    expect(
      ruledByRules(ROW_WORLD, armed, 60).advancements[3]?.research.studies.map(
        (study) => study.tech
      )
    ).toStrictEqual(["infantry-weapons-1", "artillery-1", "modern-tactics"]);
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

  it("should start the economy's technologies first on every free slot when a nation is at peace", () => {
    expect(
      startedTechs(ruledByRules(ROW_WORLD, ROW_SIMULATION, COUNCIL_DAY))
    ).toStrictEqual(["tools-1", "construction-1", "electronics-1"]);
  });

  it("should start the army's technologies first on every free slot when a nation is at war", () => {
    expect(
      startedTechs(ruledByRules(ROW_WORLD, atWar([]), COUNCIL_DAY))
    ).toStrictEqual(["infantry-weapons-1", "artillery-1", "modern-tactics"]);
  });

  it("should start a technology meant for this year before a later one when both are on offer", () => {
    expect(
      startedTechs(
        ruledByRules(
          ROW_WORLD,
          researchedAll(ROW_SIMULATION, ["tools-1"]),
          COUNCIL_DAY
        )
      )
    ).toStrictEqual(["construction-1", "electronics-1", "infantry-weapons-1"]);
  });

  it("should pass over a technology an earlier pick ruled out when the rules fill the slots", () => {
    expect(
      startedTechs(
        ruledByRules(
          ROW_WORLD,
          researchedAll(ROW_SIMULATION, [
            "infantry-weapons-1",
            "artillery-1",
            "modern-tactics",
            "tools-1",
            "construction-1",
            "electronics-1",
            "logistics-1",
          ]),
          COUNCIL_DAY
        )
      )
    ).toStrictEqual([
      "tools-2",
      "concentrated-industry-1",
      "support-weapons-1",
    ]);
  });

  it("should pursue the first focus outside the army's branch when a nation is at peace", () => {
    expect(
      ruledByRules(ROW_WORLD, ROW_SIMULATION, COUNCIL_DAY).advancements[0]
        ?.focuses.current
    ).toStrictEqual(Option.some({ focus: "industrialisation", progress: 0 }));
  });

  it("should pursue the first focus in the army's branch when a nation is at war", () => {
    expect(
      ruledByRules(ROW_WORLD, atWar([]), COUNCIL_DAY).advancements[0]?.focuses
        .current
    ).toStrictEqual(Option.some({ focus: "army-effort", progress: 0 }));
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
      nations: [{ ...BRIEF, freeSlots: 1, techs: ["tools-1", "artillery-1"] }],
    };

    expect(
      rulingsFrom(
        researching,
        [
          verdict({
            choice: "artillery-1",
            question: "research",
            weights: [
              { choice: "tools-1", probability: 0.3 },
              { choice: "artillery-1", probability: 0.6 },
            ],
          }),
        ],
        ANY_DRAW
      )
    ).toStrictEqual([
      {
        decision: { kind: "research", nation: 1, tech: "artillery-1" },
        source: fromJev(0.6),
      },
      {
        decision: { kind: "research", nation: 1, tech: "tools-1" },
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
            choice: "tools-1",
            question: "research",
            weights: [{ choice: "tools-1", probability: 1 }],
          }),
        ],
        ANY_DRAW
      )
    ).toStrictEqual([]);
  });

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
