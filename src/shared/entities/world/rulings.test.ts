import { describe, expect, it } from "vite-plus/test";
import type { Decision, Ruling } from "./chronicle";
import { BY_RULES } from "./chronicle";
import type { Diplomacy } from "./diplomacy";
import {
  factionOf,
  INDEPENDENT,
  joined,
  openingDiplomacy,
  standingOf,
  warDeclared,
} from "./diplomacy";
import { ROW_OWNERS, ROW_SIMULATION, ROW_WORLD } from "./diplomacy-fixture";
import { ruled } from "./rulings";
import type { Simulation } from "./simulation";
import { enemiesOf } from "./wars";

const byRules = (decision: Decision): Ruling => ({
  decision,
  source: BY_RULES,
});

const withDiplomacy = (diplomacy: Diplomacy): Simulation => ({
  ...ROW_SIMULATION,
  diplomacy,
});

/** Nation 2 a puppet of nation 3, and nation 1 annexed by nation 0. */
const SUBJECTS: Simulation = withDiplomacy({
  ...ROW_SIMULATION.diplomacy,
  standings: [
    INDEPENDENT,
    { by: 0, kind: "annexed" },
    { kind: "puppet", overlord: 3 },
    INDEPENDENT,
  ],
});

describe(ruled, () => {
  it("should change the law and record the ruling when a nation takes a new conscription law", () => {
    const ruling = byRules({ kind: "conscription", law: "limited", nation: 0 });

    const after = ruled(ROW_WORLD, ROW_SIMULATION, ruling);

    expect({
      chronicle: after.chronicle,
      law: after.economies[0]?.conscription,
    }).toStrictEqual({
      chronicle: [{ day: 0, ruling, seq: 0 }],
      law: "limited",
    });
  });

  it("should change nothing when a nation keeps the law it has", () => {
    expect(
      ruled(
        ROW_WORLD,
        ROW_SIMULATION,
        byRules({ kind: "conscription", law: "volunteer", nation: 0 })
      )
    ).toBe(ROW_SIMULATION);
  });

  it("should change the plan when a nation takes a new industry plan", () => {
    expect(
      ruled(
        ROW_WORLD,
        ROW_SIMULATION,
        byRules({ kind: "plan", nation: 2, plan: "military" })
      ).economies[2]?.plan
    ).toBe("military");
  });

  it("should change nothing when a nation keeps the plan it has", () => {
    expect(
      ruled(
        ROW_WORLD,
        ROW_SIMULATION,
        byRules({ kind: "plan", nation: 2, plan: "civilian" })
      )
    ).toBe(ROW_SIMULATION);
  });

  it("should change the stance when a nation's army takes a new one", () => {
    expect(
      ruled(
        ROW_WORLD,
        ROW_SIMULATION,
        byRules({ kind: "stance", nation: 3, stance: "offensive" })
      ).stances
    ).toStrictEqual(["balanced", "balanced", "balanced", "offensive"]);
  });

  it("should change nothing when a nation's army keeps its stance", () => {
    expect(
      ruled(
        ROW_WORLD,
        ROW_SIMULATION,
        byRules({ kind: "stance", nation: 3, stance: "balanced" })
      )
    ).toBe(ROW_SIMULATION);
  });

  it("should change nothing when the deciding nation has been annexed", () => {
    expect(
      ruled(
        ROW_WORLD,
        SUBJECTS,
        byRules({ kind: "conscription", law: "limited", nation: 1 })
      )
    ).toBe(SUBJECTS);
  });

  it("should start the war when a nation declares on the lower-numbered neighbour it borders", () => {
    const after = ruled(
      ROW_WORLD,
      ROW_SIMULATION,
      byRules({ kind: "declare", nation: 1, target: 0 })
    );

    expect(enemiesOf(after.diplomacy.wars, 1)).toStrictEqual([0]);
  });

  it("should start the war when a nation declares on the higher-numbered neighbour it borders", () => {
    const after = ruled(
      ROW_WORLD,
      ROW_SIMULATION,
      byRules({ kind: "declare", nation: 1, target: 2 })
    );

    expect(enemiesOf(after.diplomacy.wars, 1)).toStrictEqual([2]);
  });

  it("should drop a declaration when the declarer does not border the target", () => {
    const simulation = ROW_SIMULATION;

    expect(
      ruled(
        ROW_WORLD,
        simulation,
        byRules({ kind: "declare", nation: 0, target: 2 })
      )
    ).toBe(simulation);
  });

  it("should drop a declaration when the declarer is already at war", () => {
    const fighting = withDiplomacy(warDeclared(ROW_SIMULATION.diplomacy, 2, 3));

    expect(
      ruled(
        ROW_WORLD,
        fighting,
        byRules({ kind: "declare", nation: 2, target: 1 })
      )
    ).toBe(fighting);
  });

  it("should drop a declaration when the target is an ally", () => {
    const allies = withDiplomacy(
      joined(openingDiplomacy(ROW_OWNERS, 4, [0]), 1, 0)
    );

    expect(
      ruled(
        ROW_WORLD,
        allies,
        byRules({ kind: "declare", nation: 1, target: 0 })
      )
    ).toBe(allies);
  });

  it("should drop a declaration when the declarer is a puppet", () => {
    expect(
      ruled(
        ROW_WORLD,
        SUBJECTS,
        byRules({ kind: "declare", nation: 2, target: 1 })
      )
    ).toBe(SUBJECTS);
  });

  it("should put the nation in the faction when it joins one that is still standing", () => {
    const bloc = withDiplomacy(openingDiplomacy(ROW_OWNERS, 4, [0]));

    const after = ruled(
      ROW_WORLD,
      bloc,
      byRules({ faction: 0, kind: "join", nation: 1 })
    );

    expect(factionOf(after.diplomacy, 1)).toBe(0);
  });

  it("should drop joining a faction when nobody fights under it", () => {
    expect(
      ruled(
        ROW_WORLD,
        ROW_SIMULATION,
        byRules({ faction: 0, kind: "join", nation: 1 })
      )
    ).toBe(ROW_SIMULATION);
  });

  it("should drop joining a faction when the nation has joined one already", () => {
    const blocs = withDiplomacy(
      joined(openingDiplomacy(ROW_OWNERS, 4, [0, 3]), 1, 0)
    );

    expect(
      ruled(ROW_WORLD, blocs, byRules({ faction: 3, kind: "join", nation: 1 }))
    ).toBe(blocs);
  });

  it("should drop joining a faction when it holds a nation the joiner is at war with", () => {
    const hostile = withDiplomacy(
      warDeclared(openingDiplomacy(ROW_OWNERS, 4, [0]), 1, 0)
    );

    expect(
      ruled(
        ROW_WORLD,
        hostile,
        byRules({ faction: 0, kind: "join", nation: 1 })
      )
    ).toBe(hostile);
  });

  it("should drop joining a faction when the joiner is a puppet", () => {
    const bloc = withDiplomacy({
      ...openingDiplomacy(ROW_OWNERS, 4, [0]),
      standings: SUBJECTS.diplomacy.standings,
    });

    expect(
      ruled(ROW_WORLD, bloc, byRules({ faction: 0, kind: "join", nation: 2 }))
    ).toBe(bloc);
  });

  it("should sign the peace when the loser's talks are still open", () => {
    const talking: Simulation = {
      ...withDiplomacy(warDeclared(ROW_SIMULATION.diplomacy, 0, 1)),
      negotiations: [
        { fallback: { terms: "annex", victor: 0 }, loser: 1, openedOn: 0 },
      ],
      owners: Int32Array.from([0, 0, 1, 3, -1]),
    };

    const after = ruled(
      ROW_WORLD,
      talking,
      byRules({
        kind: "peace",
        loser: 1,
        settlement: { terms: "puppet", victor: 0 },
      })
    );

    expect(standingOf(after.diplomacy, 1)).toStrictEqual({
      kind: "puppet",
      overlord: 0,
    });
  });

  it("should annex the loser whatever terms were named when it holds no ground", () => {
    const landless: Simulation = {
      ...withDiplomacy(warDeclared(ROW_SIMULATION.diplomacy, 0, 1)),
      negotiations: [
        { fallback: { terms: "annex", victor: 0 }, loser: 1, openedOn: 0 },
      ],
      owners: Int32Array.from([0, 0, 2, 3, -1]),
    };

    const after = ruled(
      ROW_WORLD,
      landless,
      byRules({
        kind: "peace",
        loser: 1,
        settlement: { terms: "cede", victor: 0 },
      })
    );

    expect(standingOf(after.diplomacy, 1)).toStrictEqual({
      by: 0,
      kind: "annexed",
    });
  });

  it("should change nothing when a puppet's law is ruled on", () => {
    expect(
      ruled(
        ROW_WORLD,
        SUBJECTS,
        byRules({ kind: "conscription", law: "limited", nation: 2 })
      )
    ).toBe(SUBJECTS);
  });

  it("should drop the terms when the loser's talks have closed", () => {
    expect(
      ruled(
        ROW_WORLD,
        ROW_SIMULATION,
        byRules({
          kind: "peace",
          loser: 1,
          settlement: { terms: "annex", victor: 0 },
        })
      )
    ).toBe(ROW_SIMULATION);
  });
});
