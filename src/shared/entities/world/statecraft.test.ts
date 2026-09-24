import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { Armies } from "./army";
import { division } from "./army-fixture";
import type { Clock } from "./clock";
import { START_CLOCK } from "./clock";
import type { Diplomacy } from "./diplomacy";
import {
  INDEPENDENT,
  joined,
  justificationStarted,
  openingDiplomacy,
  standingOf,
  warDeclared,
} from "./diplomacy";
import { ROW_OWNERS, ROW_PEACE, ROW_WORLD } from "./diplomacy-fixture";
import type { NationEconomy } from "./economy";
import { NO_ECONOMY } from "./economy";
import type { Focuses } from "./focus";
import { START_FOCUSES } from "./focus";
import { neighbouringNations } from "./geography/nations";
import type { World } from "./geography/world";
import type { Province } from "./provinces";
import type { Random } from "./random";
import { UNASSIGNED } from "./spread";
import type { Realm } from "./statecraft";
import {
  conductedOneDay,
  factionFounders,
  factionToJoin,
  justificationTarget,
  settlementFor,
  surrenders,
  warTarget,
  withinReach,
} from "./statecraft";

const ECONOMIES: readonly NationEconomy[] = [
  NO_ECONOMY,
  NO_ECONOMY,
  NO_ECONOMY,
  NO_ECONOMY,
];

/** Nation 3 with one division in the field and nobody else armed. */
const ARMED_THREE: Armies = {
  divisions: [division({ nation: 3, province: 3 })],
  economies: ECONOMIES,
  owners: ROW_OWNERS,
};

/** Nation 0 leading a faction nation 1 has joined, beside unaligned 2 and 3. */
const BLOC: Diplomacy = joined(openingDiplomacy(ROW_OWNERS, 4, [0]), 1, 0);

/** A plains province of the row's size, bordering nothing yet. */
const land = (id: number): Province => ({
  cells: 10,
  id,
  kind: "land",
  neighbours: [],
  terrain: "plains",
  x: id,
  y: 0,
});

/** Who borders whom along the row. */
const ROW_BORDERS = neighbouringNations(ROW_WORLD, ROW_OWNERS);

/** A draw that always falls the declarer's way, and one that never does. */
const LUCKY: Random = { below: () => 0, unit: () => 0 };
const UNLUCKY: Random = { below: () => 0, unit: () => 0.99 };

/** A government that finished militarism, which may justify at any tension. */
const MILITARIST: Focuses = {
  ...START_FOCUSES,
  done: ["political-effort", "militarism"],
};

/** Nation 1's homeland stretched over the whole row, held as `owners` say. */
const homelandOfOne = (owners: readonly number[]) => ({
  armies: {
    divisions: [],
    economies: ECONOMIES,
    owners: Int32Array.from([...owners, UNASSIGNED]),
  },
  diplomacy: warDeclared(
    warDeclared(
      { ...ROW_PEACE, cores: Int32Array.from([1, 1, 1, 1, UNASSIGNED]) },
      0,
      1
    ),
    2,
    1
  ),
  world: ROW_WORLD,
});

describe(factionFounders, () => {
  it("should pick the three most populous nations, the largest first, when a world opens", () => {
    const economies = [10, 40, 20, 30].map((population) => ({
      ...NO_ECONOMY,
      population,
    }));

    expect(factionFounders(economies)).toStrictEqual([1, 3, 2]);
  });
});

describe(factionToJoin, () => {
  it("should join the faction across its border when a stronger neighbour threatens it", () => {
    expect(
      factionToJoin(
        {
          armies: ARMED_THREE,
          borders: ROW_BORDERS,
          diplomacy: BLOC,
          overseas: [],
          world: ROW_WORLD,
        },
        2
      )
    ).toStrictEqual(Option.some(0));
  });

  it("should join the strongest faction across its borders when two are in reach", () => {
    const star: World = {
      ...ROW_WORLD,
      provinces: [
        { ...land(0), neighbours: [1, 2, 3] },
        { ...land(1), neighbours: [0] },
        { ...land(2), neighbours: [0] },
        { ...land(3), neighbours: [0] },
        { cells: 4, id: 4, kind: "sea", neighbours: [], x: 4, y: 0 },
      ],
    };
    // Nation 0 fields two divisions, so only nation 3's four outmatch it and
    // the factions of nations 1 and 2 stay in reach.
    const armies: Armies = {
      ...ARMED_THREE,
      divisions: [0, 0, 1, 2, 2, 3, 3, 3, 3].map((nation) =>
        division({ nation, province: nation })
      ),
    };

    expect(
      factionToJoin(
        {
          armies,
          borders: neighbouringNations(star, ROW_OWNERS),
          diplomacy: openingDiplomacy(ROW_OWNERS, 4, [1, 2]),
          overseas: [],
          world: star,
        },
        0
      )
    ).toStrictEqual(Option.some(2));
  });

  it("should join nothing when no neighbour outmatches it", () => {
    expect(
      factionToJoin(
        {
          armies: ARMED_THREE,
          borders: ROW_BORDERS,
          diplomacy: BLOC,
          overseas: [],
          world: ROW_WORLD,
        },
        3
      )
    ).toStrictEqual(Option.none());
  });

  it("should join nothing when the only faction in reach is its threat's", () => {
    const diplomacy = joined(BLOC, 3, 0);

    expect(
      factionToJoin(
        {
          armies: ARMED_THREE,
          borders: ROW_BORDERS,
          diplomacy,
          overseas: [],
          world: ROW_WORLD,
        },
        2
      )
    ).toStrictEqual(Option.none());
  });

  it("should join nothing when the faction in reach is at war with it", () => {
    const diplomacy = warDeclared(BLOC, 1, 2);

    expect(
      factionToJoin(
        {
          armies: ARMED_THREE,
          borders: ROW_BORDERS,
          diplomacy,
          overseas: [],
          world: ROW_WORLD,
        },
        2
      )
    ).toStrictEqual(Option.none());
  });

  it("should join nothing when a member of the faction in reach is at war with it", () => {
    const diplomacy = joined(joined(warDeclared(ROW_PEACE, 0, 2), 0, 0), 1, 0);

    expect(
      factionToJoin(
        {
          armies: ARMED_THREE,
          borders: ROW_BORDERS,
          diplomacy,
          overseas: [],
          world: ROW_WORLD,
        },
        2
      )
    ).toStrictEqual(Option.none());
  });

  it("should join nothing when it has joined a faction already", () => {
    expect(
      factionToJoin(
        {
          armies: ARMED_THREE,
          borders: ROW_BORDERS,
          diplomacy: BLOC,
          overseas: [],
          world: ROW_WORLD,
        },
        1
      )
    ).toStrictEqual(Option.none());
  });

  it("should join nothing when it answers to an overlord", () => {
    const diplomacy: Diplomacy = {
      ...BLOC,
      standings: [
        INDEPENDENT,
        INDEPENDENT,
        { kind: "puppet", overlord: 3 },
        INDEPENDENT,
      ],
    };

    expect(
      factionToJoin(
        {
          armies: ARMED_THREE,
          borders: ROW_BORDERS,
          diplomacy,
          overseas: [],
          world: ROW_WORLD,
        },
        2
      )
    ).toStrictEqual(Option.none());
  });
});

describe(justificationTarget, () => {
  const situation = {
    armies: ARMED_THREE,
    borders: ROW_BORDERS,
    diplomacy: ROW_PEACE,
    overseas: [],
    world: ROW_WORLD,
  };

  it("should start justifying on its weaker neighbour when it is militarist and the draw falls its way", () => {
    expect(justificationTarget(situation, MILITARIST, 3, LUCKY)).toStrictEqual(
      Option.some(2)
    );
  });

  it("should hold back when the draw goes against it", () => {
    expect(
      justificationTarget(situation, MILITARIST, 3, UNLUCKY)
    ).toStrictEqual(Option.none());
  });

  it("should hold back when it does not outmatch its neighbour", () => {
    expect(justificationTarget(situation, MILITARIST, 1, LUCKY)).toStrictEqual(
      Option.none()
    );
  });

  it("should hold back when it took no stand and world tension is under half", () => {
    expect(
      justificationTarget(situation, START_FOCUSES, 3, LUCKY)
    ).toStrictEqual(Option.none());
  });

  it("should start justifying when it took no stand and world tension has reached half", () => {
    expect(
      justificationTarget(
        { ...situation, diplomacy: { ...ROW_PEACE, tension: 0.5 } },
        START_FOCUSES,
        3,
        LUCKY
      )
    ).toStrictEqual(Option.some(2));
  });

  it("should hold back when it already holds a war goal", () => {
    const diplomacy = justificationStarted(
      ROW_PEACE,
      { nation: 3, target: 2 },
      0
    );

    expect(
      justificationTarget({ ...situation, diplomacy }, MILITARIST, 3, LUCKY)
    ).toStrictEqual(Option.none());
  });

  it("should hold back when every neighbour is its ally", () => {
    const diplomacy = joined(joined(ROW_PEACE, 2, 3), 3, 3);

    expect(
      justificationTarget({ ...situation, diplomacy }, MILITARIST, 3, LUCKY)
    ).toStrictEqual(Option.none());
  });

  it("should hold back when it is already at war", () => {
    const diplomacy = warDeclared(ROW_PEACE, 0, 1);

    expect(
      justificationTarget({ ...situation, diplomacy }, MILITARIST, 1, LUCKY)
    ).toStrictEqual(Option.none());
  });

  it("should hold back when it answers to an overlord", () => {
    const diplomacy: Diplomacy = {
      ...ROW_PEACE,
      standings: [
        INDEPENDENT,
        INDEPENDENT,
        INDEPENDENT,
        { kind: "puppet", overlord: 0 },
      ],
    };

    expect(
      justificationTarget({ ...situation, diplomacy }, MILITARIST, 3, LUCKY)
    ).toStrictEqual(Option.none());
  });
});

describe(warTarget, () => {
  /** Nation 3 holding a war goal on 2 that completes on day 100. */
  const justifying: Diplomacy = {
    ...ROW_PEACE,
    warGoals: [{ nation: 3, readyOn: 100, target: 2 }],
  };
  const situation = {
    armies: ARMED_THREE,
    borders: ROW_BORDERS,
    diplomacy: justifying,
    overseas: [],
    world: ROW_WORLD,
  };

  it("should declare on the target when its war goal is justified", () => {
    expect(warTarget(situation, 3, 100)).toStrictEqual(Option.some(2));
  });

  it("should hold back when its war goal is still being justified", () => {
    expect(warTarget(situation, 3, 99)).toStrictEqual(Option.none());
  });

  it("should hold back when it holds no war goal", () => {
    expect(
      warTarget({ ...situation, diplomacy: ROW_PEACE }, 3, 100)
    ).toStrictEqual(Option.none());
  });

  it("should hold back when it no longer outmatches the target", () => {
    const diplomacy: Diplomacy = {
      ...ROW_PEACE,
      warGoals: [{ nation: 2, readyOn: 100, target: 3 }],
    };

    expect(warTarget({ ...situation, diplomacy }, 2, 100)).toStrictEqual(
      Option.none()
    );
  });

  it("should hold back when the target is no longer within its reach", () => {
    const diplomacy: Diplomacy = {
      ...ROW_PEACE,
      warGoals: [{ nation: 3, readyOn: 100, target: 0 }],
    };

    expect(warTarget({ ...situation, diplomacy }, 3, 100)).toStrictEqual(
      Option.none()
    );
  });

  it("should hold back when it is already at war", () => {
    const diplomacy = warDeclared(justifying, 1, 3);

    expect(warTarget({ ...situation, diplomacy }, 3, 100)).toStrictEqual(
      Option.none()
    );
  });
});

describe(withinReach, () => {
  const standoff = {
    armies: ARMED_THREE,
    borders: ROW_BORDERS,
    diplomacy: ROW_PEACE,
    world: ROW_WORLD,
  };

  it("should add the nation across the sea when its own fleet can carry a war there", () => {
    expect(
      withinReach({ ...standoff, overseas: [{ one: 3, other: 0 }] }, 3)
    ).toStrictEqual([2, 0]);
  });

  it("should leave out the nation across the sea when only that nation's fleet can carry a war", () => {
    expect(
      withinReach({ ...standoff, overseas: [{ one: 0, other: 3 }] }, 3)
    ).toStrictEqual([2]);
  });
});

describe(surrenders, () => {
  it("should give up when it is at war and holds less than a quarter of its homeland", () => {
    expect(surrenders(homelandOfOne([0, 0, 2, 3]), 1)).toBeTruthy();
  });

  it("should fight on when it still holds most of its homeland", () => {
    expect(surrenders(homelandOfOne([1, 1, 1, 3]), 1)).toBeFalsy();
  });

  it("should not surrender when it is at war with nobody", () => {
    expect(
      surrenders(
        { armies: ARMED_THREE, diplomacy: ROW_PEACE, world: ROW_WORLD },
        1
      )
    ).toBeFalsy();
  });
});

describe(settlementFor, () => {
  it("should annex the loser when one enemy holds most of its homeland", () => {
    expect(settlementFor(homelandOfOne([0, 0, 0, 3]), 1)).toStrictEqual({
      terms: "annex",
      victor: 0,
    });
  });

  it("should make a puppet of the loser when the strongest enemy holds half its homeland", () => {
    expect(settlementFor(homelandOfOne([1, 2, 2, 0]), 1)).toStrictEqual({
      terms: "puppet",
      victor: 2,
    });
  });

  it("should take only a cession when no enemy holds a large share", () => {
    expect(settlementFor(homelandOfOne([1, 0, 2, 3]), 1)).toStrictEqual({
      terms: "cede",
      victor: 0,
    });
  });

  it("should annex the loser when it holds no ground, however its homeland is split", () => {
    expect(settlementFor(homelandOfOne([0, 2, 3, 3]), 1)).toStrictEqual({
      terms: "annex",
      victor: 0,
    });
  });

  it("should give the peace to the overlord when its puppet holds most of the loser's homeland", () => {
    const situation = homelandOfOne([1, 0, 2, 2]);
    const diplomacy: Diplomacy = {
      ...situation.diplomacy,
      standings: [
        INDEPENDENT,
        INDEPENDENT,
        { kind: "puppet", overlord: 0 },
        INDEPENDENT,
      ],
    };

    expect(settlementFor({ ...situation, diplomacy }, 1)).toStrictEqual({
      terms: "annex",
      victor: 0,
    });
  });
});

const onDay = (days: number): Clock => ({ ...START_CLOCK, days });

describe(conductedOneDay, () => {
  /** Nation 1 at war with nation 0, which holds nation 1's only province. */
  const beaten: Realm = {
    armies: {
      divisions: [],
      economies: ECONOMIES,
      owners: Int32Array.from([0, 0, 2, 3, UNASSIGNED]),
    },
    chronicle: [],
    diplomacy: warDeclared(ROW_PEACE, 0, 1),
    negotiations: [],
  };

  /** The same war with nation 1's talks opened on day 1. */
  const talking: Realm = {
    ...beaten,
    negotiations: [
      { fallback: { terms: "annex", victor: 0 }, loser: 1, openedOn: 1 },
    ],
  };

  it("should open talks with the rules' terms when a nation loses its homeland", () => {
    expect(
      conductedOneDay(ROW_WORLD, onDay(1), beaten).negotiations
    ).toStrictEqual(talking.negotiations);
  });

  it("should keep one set of talks when a beaten nation is already talking", () => {
    expect(
      conductedOneDay(ROW_WORLD, onDay(2), talking).negotiations
    ).toStrictEqual(talking.negotiations);
  });

  it("should sign the rules' terms when the talks pass their deadline", () => {
    const after = conductedOneDay(ROW_WORLD, onDay(31), talking);

    expect({
      chronicle: after.chronicle,
      negotiations: after.negotiations,
      standing: standingOf(after.diplomacy, 1),
    }).toStrictEqual({
      chronicle: [
        {
          day: 31,
          ruling: {
            decision: {
              kind: "peace",
              loser: 1,
              settlement: { terms: "annex", victor: 0 },
            },
            source: { kind: "rules" },
          },
          seq: 0,
        },
      ],
      negotiations: [],
      standing: { by: 0, kind: "annexed" },
    });
  });

  it("should reopen the talks with the enemy it still fights when the victor has left the war by the deadline", () => {
    const after = conductedOneDay(ROW_WORLD, onDay(31), {
      ...talking,
      negotiations: [
        { fallback: { terms: "annex", victor: 2 }, loser: 1, openedOn: 1 },
      ],
    });

    expect(after.negotiations).toStrictEqual([
      { fallback: { terms: "annex", victor: 0 }, loser: 1, openedOn: 31 },
    ]);
  });

  it("should drop the talks when the loser is no longer at war with anyone", () => {
    const after = conductedOneDay(ROW_WORLD, onDay(2), {
      ...talking,
      armies: { ...talking.armies, owners: ROW_OWNERS },
      diplomacy: ROW_PEACE,
    });

    expect(after.negotiations).toStrictEqual([]);
  });
});
