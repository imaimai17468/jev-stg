import { describe, expect, it } from "vite-plus/test";
import type { Diplomacy } from "./diplomacy";
import {
  allied,
  factionOf,
  INDEPENDENT,
  joined,
  leftTheWar,
  nationsStanding,
  NO_FACTION,
  openingDiplomacy,
  puppetsOf,
  sideOf,
  standingOf,
  warDeclared,
} from "./diplomacy";
import { ROW_OWNERS, ROW_PEACE } from "./diplomacy-fixture";
import { enemiesOf } from "./wars";

/** Nation 1 answering to nation 0, which leads a faction nation 2 has joined. */
const BLOC: Diplomacy = {
  ...joined(openingDiplomacy(ROW_OWNERS, 4, [0]), 2, 0),
  standings: [
    INDEPENDENT,
    { kind: "puppet", overlord: 0 },
    INDEPENDENT,
    INDEPENDENT,
  ],
};

describe(openingDiplomacy, () => {
  it("should put each founder in a faction named after itself when a world opens", () => {
    expect([...openingDiplomacy(ROW_OWNERS, 4, [3, 1]).factions]).toStrictEqual(
      [NO_FACTION, 1, NO_FACTION, 3]
    );
  });
});

describe(standingOf, () => {
  it("should read a nation as independent when the world holds no such nation", () => {
    expect(standingOf(ROW_PEACE, 9)).toStrictEqual(INDEPENDENT);
  });
});

describe(factionOf, () => {
  it("should read a puppet as fighting under its overlord's faction when it has joined none itself", () => {
    expect(factionOf(BLOC, 1)).toBe(0);
  });
});

describe(allied, () => {
  it("should hold a puppet and its overlord together when neither leads a faction", () => {
    const vassal: Diplomacy = {
      ...ROW_PEACE,
      standings: [
        INDEPENDENT,
        { kind: "puppet", overlord: 0 },
        INDEPENDENT,
        INDEPENDENT,
      ],
    };

    expect(allied(vassal, 0, 1)).toBeTruthy();
  });

  it("should hold two members of one faction together when they have joined it", () => {
    expect(allied(BLOC, 0, 2)).toBeTruthy();
  });

  it("should hold two unaligned nations apart when neither has joined a faction", () => {
    expect(allied(ROW_PEACE, 2, 3)).toBeFalsy();
  });

  it("should hold an annexed nation apart from everyone when it has been annexed", () => {
    const gone: Diplomacy = {
      ...ROW_PEACE,
      standings: [
        INDEPENDENT,
        INDEPENDENT,
        INDEPENDENT,
        { by: 2, kind: "annexed" },
      ],
    };

    expect(allied(gone, 3, 3)).toBeFalsy();
  });
});

describe(sideOf, () => {
  it("should gather the faction and its puppets when a member is asked", () => {
    expect(sideOf(BLOC, 2)).toStrictEqual([0, 1, 2]);
  });
});

describe(warDeclared, () => {
  it("should bring the whole of the target's side into the war when a faction member is declared on", () => {
    const { wars } = warDeclared(BLOC, 3, 2);

    expect(enemiesOf(wars, 3)).toStrictEqual([0, 1, 2]);
  });

  it("should change nothing when a nation declares on its own ally", () => {
    expect(warDeclared(BLOC, 0, 2)).toBe(BLOC);
  });
});

describe(leftTheWar, () => {
  it("should end its wars, drop its faction and take its new standing when a nation leaves the war", () => {
    const fighting = warDeclared(BLOC, 3, 2);

    const left = leftTheWar(fighting, 2, { kind: "puppet", overlord: 3 });

    expect({
      enemies: enemiesOf(left.wars, 2),
      faction: factionOf(left, 2),
      standing: standingOf(left, 2),
    }).toStrictEqual({
      enemies: [],
      faction: NO_FACTION,
      standing: { kind: "puppet", overlord: 3 },
    });
  });
});

describe("leftTheWar by a founder", () => {
  it("should hand the faction to its remaining member with the lowest id when its founder leaves", () => {
    const three = joined(BLOC, 3, 0);

    expect([...leftTheWar(three, 0, INDEPENDENT).factions]).toStrictEqual([
      NO_FACTION,
      NO_FACTION,
      2,
      2,
    ]);
  });
});

describe(nationsStanding, () => {
  it("should leave annexed nations out of the count when some have been annexed", () => {
    const gone: Diplomacy = {
      ...ROW_PEACE,
      standings: [
        INDEPENDENT,
        { by: 0, kind: "annexed" },
        { kind: "puppet", overlord: 0 },
        INDEPENDENT,
      ],
    };

    expect(nationsStanding(gone)).toBe(3);
  });
});

describe(puppetsOf, () => {
  it("should name the nations that answer to an overlord when it has some", () => {
    expect(puppetsOf(BLOC, 0)).toStrictEqual([1]);
  });

  it("should name nobody when the only puppet answers to another overlord", () => {
    expect(puppetsOf(BLOC, 2)).toStrictEqual([]);
  });
});
