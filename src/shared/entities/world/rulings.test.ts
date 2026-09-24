import { describe, expect, it } from "vite-plus/test";
import type { Advancement } from "./advancement";
import { START_ADVANCEMENT } from "./advancement";
import { AGENCY_DAYS, NO_AGENCY } from "./agency";
import type { AirForce } from "./air-force";
import { NO_AIR_FORCE } from "./air-force";
import { airspaceOf } from "./airspace";
import { OPENING_ARMOURY } from "./armoury";
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
import { NO_RESOURCES } from "./economy/resources";
import { HOME, serviceFor } from "./espionage";
import { focusStarted, START_FOCUSES } from "./focus";
import { NO_NATION } from "./geography/nations";
import type { World } from "./geography/world";
import { replacedAt } from "./lookup";
import { NO_NAVY, openingNavy } from "./navy";
import type { Province } from "./provinces";
import { START_RESEARCH } from "./research";
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

/** `diplomacy` with `nation` holding a war goal on `target` justified on the first day. */
const withGoal = (
  diplomacy: Diplomacy,
  nation: number,
  target: number
): Diplomacy => ({
  ...diplomacy,
  warGoals: [...diplomacy.warGoals, { nation, readyOn: 0, target }],
});

/** The row with each of `goals` justified on the first day. */
const justifiedRow = (
  ...goals: readonly (readonly [number, number])[]
): Simulation =>
  withDiplomacy({
    ...ROW_SIMULATION.diplomacy,
    warGoals: goals.map(([nation, target]) => ({ nation, readyOn: 0, target })),
  });

/** The row with nation 1 having finished militarism, which may justify at any tension. */
const MILITARIST_ONE: Simulation = {
  ...ROW_SIMULATION,
  advancements: replacedAt(ROW_SIMULATION.advancements, 1, {
    ...START_ADVANCEMENT,
    focuses: { ...START_FOCUSES, done: ["political-effort", "militarism"] },
  }),
};

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
    ...START_RESEARCH,
    studies: [
      { ahead: 0, bonus: 0, progress: 0, saved: 0, tech: "fuel-storage" },
      { ahead: 0, bonus: 0, progress: 0, saved: 0, tech: "construction-1" },
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

const ISLE_PROVINCES: readonly Province[] = [
  land(0, [1]),
  { cells: 4, id: 1, kind: "sea", neighbours: [0, 2], x: 1, y: 0 },
  land(2, [1]),
];

/** Two islands with a sea zone between them, nation 0 on the first and nation 1 on the second. */
const ISLES: World = {
  airspace: airspaceOf(ISLE_PROVINCES, 1),
  cellProvince: Int32Array.from([0, 1, 2]),
  deposits: [0, 1, 2].map(() => NO_RESOURCES),
  grid: { height: 1, width: 3 },
  nations: [0, 2].map((capital, id) => ({
    ...NO_NATION,
    capital,
    id,
    name: `国${id}`,
  })),
  provinces: ISLE_PROVINCES,
  seed: 1,
};

const ISLE_OWNERS = Int32Array.from([0, UNASSIGNED, 1]);

/** The islands at peace, nation 0 with a battle fleet off its port and nation 1 with no navy. */
const ISLE_SIMULATION: Simulation = {
  ...ROW_SIMULATION,
  diplomacy: openingDiplomacy(ISLE_OWNERS, 2, []),
  navies: [openingNavy(4, 1, OPENING_ARMOURY.ships), NO_NAVY],
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
      justifiedRow([1, 0]),
      byRules({ kind: "declare", nation: 1, target: 0 })
    );

    expect(enemiesOf(after.diplomacy.wars, 1)).toStrictEqual([0]);
  });

  it("should start the war when a nation declares on the higher-numbered neighbour it borders", () => {
    const after = ruled(
      ROW_WORLD,
      justifiedRow([1, 2]),
      byRules({ kind: "declare", nation: 1, target: 2 })
    );

    expect(enemiesOf(after.diplomacy.wars, 1)).toStrictEqual([2]);
  });

  it("should spend the war goal and raise world tension when a nation declares", () => {
    const after = ruled(
      ROW_WORLD,
      justifiedRow([1, 2]),
      byRules({ kind: "declare", nation: 1, target: 2 })
    );

    expect({
      tension: after.diplomacy.tension,
      warGoals: after.diplomacy.warGoals,
    }).toStrictEqual({ tension: 0.08, warGoals: [] });
  });

  it("should drop a declaration when the declarer holds no war goal on the target", () => {
    const simulation = justifiedRow([1, 0]);

    expect(
      ruled(
        ROW_WORLD,
        simulation,
        byRules({ kind: "declare", nation: 1, target: 2 })
      )
    ).toBe(simulation);
  });

  it("should drop a declaration when the war goal is still being justified", () => {
    const simulation = withDiplomacy({
      ...ROW_SIMULATION.diplomacy,
      warGoals: [{ nation: 1, readyOn: 1, target: 2 }],
    });

    expect(
      ruled(
        ROW_WORLD,
        simulation,
        byRules({ kind: "declare", nation: 1, target: 2 })
      )
    ).toBe(simulation);
  });

  it("should start justifying a war goal and raise world tension when a militarist nation borders the target", () => {
    const after = ruled(
      ROW_WORLD,
      MILITARIST_ONE,
      byRules({ kind: "justify", nation: 1, target: 2 })
    );

    expect({
      tension: after.diplomacy.tension,
      warGoals: after.diplomacy.warGoals,
    }).toStrictEqual({
      tension: 0.03,
      warGoals: [{ nation: 1, readyOn: 180, target: 2 }],
    });
  });

  it("should drop a justification when world tension is under what the nation's focuses require", () => {
    expect(
      ruled(
        ROW_WORLD,
        ROW_SIMULATION,
        byRules({ kind: "justify", nation: 1, target: 2 })
      )
    ).toBe(ROW_SIMULATION);
  });

  it("should drop a justification when the nation does not reach the target", () => {
    expect(
      ruled(
        ROW_WORLD,
        MILITARIST_ONE,
        byRules({ kind: "justify", nation: 1, target: 3 })
      )
    ).toBe(MILITARIST_ONE);
  });

  it("should drop a justification when the target is an ally", () => {
    const allies: Simulation = {
      ...MILITARIST_ONE,
      diplomacy: joined(joined(ROW_SIMULATION.diplomacy, 1, 1), 2, 1),
    };

    expect(
      ruled(
        ROW_WORLD,
        allies,
        byRules({ kind: "justify", nation: 1, target: 2 })
      )
    ).toBe(allies);
  });

  it("should drop a declaration when the declarer does not border the target", () => {
    const simulation = justifiedRow([0, 2]);

    expect(
      ruled(
        ROW_WORLD,
        simulation,
        byRules({ kind: "declare", nation: 0, target: 2 })
      )
    ).toBe(simulation);
  });

  it("should drop a declaration when the declarer is already at war", () => {
    const fighting = withDiplomacy(
      warDeclared(withGoal(ROW_SIMULATION.diplomacy, 2, 1), 2, 3)
    );

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
      withGoal(joined(openingDiplomacy(ROW_OWNERS, 4, [0]), 1, 0), 1, 0)
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
      byRules({ kind: "research", nation: 0, tech: "construction-1" })
    );

    expect(after.advancements[0]?.research.studies).toStrictEqual([
      { ahead: 0, bonus: 0, progress: 0, saved: 0, tech: "construction-1" },
    ]);
  });

  it("should drop a technology when every slot is busy", () => {
    expect(
      ruled(
        ROW_WORLD,
        BUSY,
        byRules({ kind: "research", nation: 0, tech: "atomic-research" })
      )
    ).toBe(BUSY);
  });

  it("should drop a technology when its prerequisites are not researched", () => {
    expect(
      ruled(
        ROW_WORLD,
        ROW_SIMULATION,
        byRules({ kind: "research", nation: 0, tech: "construction-2" })
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
      {
        ...ISLE_SIMULATION,
        diplomacy: withGoal(ISLE_SIMULATION.diplomacy, 0, 1),
      },
      byRules({ kind: "declare", nation: 0, target: 1 })
    );

    expect(enemiesOf(after.diplomacy.wars, 0)).toStrictEqual([1]);
  });

  it("should drop the declaration when a nation with no fleet declares on one whose fleet outmatches it across the sea", () => {
    const after = ruled(
      ISLES,
      {
        ...ISLE_SIMULATION,
        diplomacy: withGoal(ISLE_SIMULATION.diplomacy, 1, 0),
      },
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

  it.each<{ condition: string; order: Order; air: AirForce }>([
    {
      air: { ...NO_AIR_FORCE, order: "naval-bomber" },
      condition: "a nation's air factories turn to another plane",
      order: { aircraft: "naval-bomber", kind: "aircraft", nation: 3 },
    },
    {
      air: { ...NO_AIR_FORCE, aviation: "heavy" },
      condition: "a nation puts more of its factories on planes",
      order: { aviation: "heavy", kind: "aviation", nation: 3 },
    },
  ])("should change the air force when $condition", ({ air, order }) => {
    expect(
      ruled(ROW_WORLD, ROW_SIMULATION, byRules(order)).airForces[3]
    ).toStrictEqual(air);
  });

  it.each<{ condition: string; order: Order }>([
    {
      condition: "a nation's air factories keep the plane they build",
      order: { aircraft: "fighter", kind: "aircraft", nation: 3 },
    },
    {
      condition: "a nation keeps the share of its factories on planes",
      order: { aviation: "none", kind: "aviation", nation: 3 },
    },
  ])("should change nothing when $condition", ({ order }) => {
    expect(ruled(ROW_WORLD, ROW_SIMULATION, byRules(order))).toBe(
      ROW_SIMULATION
    );
  });

  it("should build the nation's factories in the province decided and record the ruling when it holds that province", () => {
    const ruling = byRules({ kind: "build-site", nation: 3, province: 3 });

    const after = ruled(ROW_WORLD, ROW_SIMULATION, ruling);

    expect({
      buildSite: after.economies[3]?.buildSite,
      chronicle: after.chronicle,
    }).toStrictEqual({
      buildSite: 3,
      chronicle: [{ day: 0, ruling, seq: 0 }],
    });
  });

  it("should raise the kind of division decided and record the ruling when the nation raised another kind", () => {
    const ruling = byRules({
      division: "mountaineers",
      kind: "division-kind",
      nation: 3,
    });

    const after = ruled(ROW_WORLD, ROW_SIMULATION, ruling);

    expect({
      chronicle: after.chronicle,
      raising: after.economies[3]?.raising,
    }).toStrictEqual({
      chronicle: [{ day: 0, ruling, seq: 0 }],
      raising: "mountaineers",
    });
  });

  it("should hand the depots back to the mix when a nation raising one kind decides on the mix", () => {
    const raising = ruled(
      ROW_WORLD,
      ROW_SIMULATION,
      byRules({ division: "marines", kind: "division-kind", nation: 3 })
    );

    expect(
      ruled(
        ROW_WORLD,
        raising,
        byRules({ division: "mix", kind: "division-kind", nation: 3 })
      ).economies[3]?.raising
    ).toBe("mix");
  });

  it("should change nothing when a nation decides on the kind of division it already raises", () => {
    const raising = ruled(
      ROW_WORLD,
      ROW_SIMULATION,
      byRules({ division: "marines", kind: "division-kind", nation: 3 })
    );

    expect(
      ruled(
        ROW_WORLD,
        raising,
        byRules({ division: "marines", kind: "division-kind", nation: 3 })
      )
    ).toBe(raising);
  });

  it("should change nothing when a nation picks a province it does not hold to build in", () => {
    expect(
      ruled(
        ROW_WORLD,
        ROW_SIMULATION,
        byRules({ kind: "build-site", nation: 3, province: 2 })
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

/** The row with nation 0's operatives already working in nation 1. */
const SPYING: Simulation = {
  ...ROW_SIMULATION,
  services: replacedAt(ROW_SIMULATION.services, 0, {
    ...serviceFor(ROW_WORLD.nations.length),
    target: 1,
  }),
};

describe("ruled for the intelligence service", () => {
  it("should set the agency to work on the project when it is on offer", () => {
    const after = ruled(
      ROW_WORLD,
      ROW_SIMULATION,
      byRules({ kind: "agency", nation: 0, project: "found" })
    );

    expect(after.services[0]?.agency).toStrictEqual({
      ...NO_AGENCY,
      work: { daysLeft: AGENCY_DAYS, kind: "working", project: "found" },
    });
  });

  it("should change nothing when the agency project is not on offer", () => {
    expect(
      ruled(
        ROW_WORLD,
        ROW_SIMULATION,
        byRules({ kind: "agency", nation: 0, project: "civilian-department" })
      )
    ).toBe(ROW_SIMULATION);
  });

  it.each<{ condition: string; from: Simulation; target: number; to: number }>([
    {
      condition: "they go to another nation still standing",
      from: ROW_SIMULATION,
      target: 1,
      to: 1,
    },
    {
      condition: "they come home on counter-intelligence",
      from: SPYING,
      target: HOME,
      to: HOME,
    },
  ])(
    "should send the operatives where decided when $condition",
    ({ from, target, to }) => {
      expect(
        ruled(
          ROW_WORLD,
          from,
          byRules({ kind: "espionage", nation: 0, target })
        ).services[0]?.target
      ).toBe(to);
    }
  );

  it.each<{ condition: string; from: Simulation; target: number }>([
    {
      condition: "the operatives are already home",
      from: ROW_SIMULATION,
      target: HOME,
    },
    {
      condition: "the target is the nation itself",
      from: ROW_SIMULATION,
      target: 0,
    },
    {
      condition: "the target has been annexed",
      from: SUBJECTS,
      target: 1,
    },
  ])("should change nothing when $condition", ({ from, target }) => {
    expect(
      ruled(ROW_WORLD, from, byRules({ kind: "espionage", nation: 0, target }))
    ).toBe(from);
  });
});
