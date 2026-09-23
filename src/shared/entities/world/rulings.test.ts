import { describe, expect, it } from "vite-plus/test";
import type { Advancement } from "./advancement";
import { START_ADVANCEMENT } from "./advancement";
import type { Order, Ruling } from "./chronicle";
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
import { focusStarted, START_FOCUSES } from "./focus";
import type { World } from "./index";
import { NO_NATION } from "./nations";
import { NO_NAVY, openingNavy } from "./navy";
import type { Province } from "./provinces";
import { NO_RESOURCES } from "./resources";
import { ruled } from "./rulings";
import type { Simulation } from "./simulation";
import { UNASSIGNED } from "./spread";
import { enemiesOf } from "./wars";

const byRules = (decision: Order): Ruling<Order> => ({
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

/** The row with nation 0's advancement replaced by `advancement`. */
const advancedTo = (advancement: Advancement): Simulation => ({
  ...ROW_SIMULATION,
  advancements: ROW_SIMULATION.advancements.map((held, nation) => {
    if (nation === 0) {
      return advancement;
    }
    return held;
  }),
});

/** Nation 0 with a technology on each of its three slots. */
const BUSY: Simulation = advancedTo({
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

/** A plains province bordering `neighbours`. */
const land = (id: number, neighbours: readonly number[]): Province => ({
  cells: 10,
  id,
  kind: "land",
  neighbours,
  terrain: "plains",
  x: id,
  y: 0,
});

/** Two islands with a sea zone between them, nation 0 on the first and nation 1 on the second. */
const ISLES: World = {
  cellProvince: Int32Array.from([0, 1, 2]),
  deposits: [0, 1, 2].map(() => NO_RESOURCES),
  grid: { height: 1, width: 3 },
  nations: [0, 2].map((capital, id) => ({
    ...NO_NATION,
    capital,
    id,
    name: `国${id}`,
  })),
  provinces: [
    land(0, [1]),
    { cells: 4, id: 1, kind: "sea", neighbours: [0, 2], x: 1, y: 0 },
    land(2, [1]),
  ],
  seed: 1,
};

const ISLE_OWNERS = Int32Array.from([0, UNASSIGNED, 1]);

/** The islands at peace, nation 0 with a battle fleet off its port and nation 1 with no navy. */
const ISLE_SIMULATION: Simulation = {
  ...ROW_SIMULATION,
  diplomacy: openingDiplomacy(ISLE_OWNERS, 2, []),
  navies: [openingNavy(4, 1), NO_NAVY],
  owners: ISLE_OWNERS,
};

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

  it("should put the technology on a free slot when a nation starts researching it", () => {
    const after = ruled(
      ROW_WORLD,
      ROW_SIMULATION,
      byRules({ kind: "research", nation: 0, tech: "tools-1" })
    );

    expect(after.advancements[0]?.research.studies).toStrictEqual([
      { progress: 0, tech: "tools-1" },
    ]);
  });

  it("should drop a technology when every slot is busy", () => {
    expect(
      ruled(
        ROW_WORLD,
        BUSY,
        byRules({ kind: "research", nation: 0, tech: "artillery-1" })
      )
    ).toBe(BUSY);
  });

  it("should drop a technology when its prerequisites are not researched", () => {
    expect(
      ruled(
        ROW_WORLD,
        ROW_SIMULATION,
        byRules({ kind: "research", nation: 0, tech: "tools-2" })
      )
    ).toBe(ROW_SIMULATION);
  });

  it("should start the focus when a nation picks one on offer", () => {
    const after = ruled(
      ROW_WORLD,
      ROW_SIMULATION,
      byRules({ focus: "army-effort", kind: "focus", nation: 0 })
    );

    expect(after.advancements[0]?.focuses).toStrictEqual(
      focusStarted(START_FOCUSES, "army-effort")
    );
  });

  it("should drop a focus when the nation is already pursuing one", () => {
    const pursuing = advancedTo({
      ...START_ADVANCEMENT,
      focuses: focusStarted(START_FOCUSES, "army-effort"),
    });

    expect(
      ruled(
        ROW_WORLD,
        pursuing,
        byRules({ focus: "industrialisation", kind: "focus", nation: 0 })
      )
    ).toBe(pursuing);
  });

  it("should start the war when a nation declares on one its fleet can reach across the sea", () => {
    const after = ruled(
      ISLES,
      ISLE_SIMULATION,
      byRules({ kind: "declare", nation: 0, target: 1 })
    );

    expect(enemiesOf(after.diplomacy.wars, 0)).toStrictEqual([1]);
  });

  it("should drop the declaration when a nation with no fleet declares on one whose fleet outmatches it across the sea", () => {
    const after = ruled(
      ISLES,
      ISLE_SIMULATION,
      byRules({ kind: "declare", nation: 1, target: 0 })
    );

    expect(enemiesOf(after.diplomacy.wars, 1)).toStrictEqual([]);
  });

  it("should change the trade law and record the ruling when a nation takes a new one", () => {
    const ruling = byRules({
      kind: "trade",
      law: "limited-exports",
      nation: 1,
    });

    const after = ruled(ROW_WORLD, ROW_SIMULATION, ruling);

    expect({
      chronicle: after.chronicle,
      law: after.economies[1]?.tradeLaw,
    }).toStrictEqual({
      chronicle: [{ day: 0, ruling, seq: 0 }],
      law: "limited-exports",
    });
  });

  it("should change nothing when a nation keeps the trade law it has", () => {
    expect(
      ruled(
        ROW_WORLD,
        ROW_SIMULATION,
        byRules({ kind: "trade", law: "export-focus", nation: 1 })
      )
    ).toBe(ROW_SIMULATION);
  });

  it("should turn the dockyards and record the ruling when a nation orders a new class of ship", () => {
    const ruling = byRules({
      kind: "shipbuilding",
      nation: 3,
      order: "destroyer",
    });

    const after = ruled(ROW_WORLD, ROW_SIMULATION, ruling);

    expect({
      chronicle: after.chronicle,
      order: after.navies[3]?.order,
    }).toStrictEqual({
      chronicle: [{ day: 0, ruling, seq: 0 }],
      order: "destroyer",
    });
  });

  it("should change nothing when a nation's dockyards keep the order they have", () => {
    expect(
      ruled(
        ROW_WORLD,
        ROW_SIMULATION,
        byRules({ kind: "shipbuilding", nation: 3, order: "convoy" })
      )
    ).toBe(ROW_SIMULATION);
  });

  it("should change nothing when a puppet's dockyards are ruled on", () => {
    expect(
      ruled(
        ROW_WORLD,
        SUBJECTS,
        byRules({ kind: "shipbuilding", nation: 2, order: "battleship" })
      )
    ).toBe(SUBJECTS);
  });
});
