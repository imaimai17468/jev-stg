import { describe, expect, it } from "vite-plus/test";
import type { Armoury } from "../armoury";
import { OPENING_ARMOURY } from "../armoury";
import { itemAt } from "../lookup";
import { UNASSIGNED } from "../spread";
import { declared } from "../wars";
import { afloatAfter, foughtAtSea, foughtToday } from "./naval-combat";
import type { FleetRole, Navy, TaskForce } from "./navy";
import { FLEET_ROLES, fleetOf, NO_NAVY } from "./navy";
import { SHIPS_1936, ZERO_FIGHTS_ONE } from "./sea-fixture";
import type { Ship, ShipClass } from "./ships";
import { launched } from "./ships";

/** The task forces each nation keeps, which is how a battle's places are counted. */
const ROLES = FLEET_ROLES.length;

/** A ship that stands in for one a fleet has lost, so a read of it shows no hull. */
const SUNK: Ship = {
  design: "destroyer-2",
  hp: 0,
  organisation: 0,
  planes: 0,
};

/** Every nation's guns firing in full, their fuel tanks full. */
const FULL_GUNS: readonly number[] = [1, 1, 1];

/** Every nation armed as it opens the world. */
const OPENING: readonly Armoury[] = [
  OPENING_ARMOURY,
  OPENING_ARMOURY,
  OPENING_ARMOURY,
];

/** A nation whose research doubles its submarines' torpedoes. */
const TORPEDOES_DOUBLED: Armoury = {
  ...OPENING_ARMOURY,
  weapons: {
    ...OPENING_ARMOURY.weapons,
    submarine: { heavy: 0, light: 0, torpedo: 1 },
  },
};

/** A nation whose research doubles its battleships' light batteries and triples their heavy ones. */
const BATTERIES_DOUBLED: Armoury = {
  ...OPENING_ARMOURY,
  weapons: {
    ...OPENING_ARMOURY.weapons,
    battleship: { heavy: 2, light: 1, torpedo: 0 },
  },
};

/** A nation whose carriers fly the second naval bomber. */
const NEWER_BOMBERS: Armoury = {
  ...OPENING_ARMOURY,
  planes: { ...OPENING_ARMOURY.planes, "naval-bomber": "naval-bomber-2" },
};

/** A navy whose task force in `role` holds 1936 ships of `classes` in zone 5 on `mission`. */
const afloat = (
  role: FleetRole,
  classes: readonly ShipClass[],
  mission: TaskForce["mission"] = "patrol"
): Navy => ({
  ...NO_NAVY,
  fleets: NO_NAVY.fleets.map((fleet) => {
    if (fleet.role !== role) {
      return fleet;
    }
    return {
      ...fleet,
      mission,
      ships: classes.map((shipClass) => launched(SHIPS_1936[shipClass])),
      zone: 5,
    };
  }),
});

/** The navy with the task forces of `other` that are at sea put in beside its own. */
const alongside = (navy: Navy, other: Navy): Navy => ({
  ...navy,
  fleets: navy.fleets.map((fleet, index) => {
    if (fleet.zone !== UNASSIGNED) {
      return fleet;
    }
    return itemAt(other.fleets, index, fleet);
  }),
});

/** The first ship left in the task force `role` of `nation` after the day. */
const firstShip = (
  navies: readonly Navy[],
  nation: number,
  role: FleetRole
): Ship =>
  itemAt(fleetOf(itemAt(navies, nation, NO_NAVY), role).ships, 0, SUNK);

describe(foughtAtSea, () => {
  it("should leave every navy as it was and record no battle when no two nations in a zone are at war", () => {
    const navies = [
      afloat("main", ["battleship"]),
      NO_NAVY,
      afloat("main", ["destroyer"]),
    ];

    expect(
      foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS, OPENING)
    ).toStrictEqual({
      fought: new Uint8Array(3 * ROLES),
      navies,
      zones: new Set(),
    });
  });

  it("should let a task force making for port slip past when the enemy is in its zone", () => {
    const navies = [
      afloat("main", ["battleship"], "repair"),
      afloat("main", ["battleship"]),
      NO_NAVY,
    ];

    expect(
      foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS, OPENING).zones
    ).toStrictEqual(new Set());
  });

  it("should record the zone a battle was fought in when two enemies meet there", () => {
    const navies = [
      afloat("main", ["battleship"]),
      afloat("main", ["battleship"]),
      NO_NAVY,
    ];

    expect(
      foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS, OPENING).zones
    ).toStrictEqual(new Set([5]));
  });

  it("should sink a submarine under a destroyer's depth charges when the two meet", () => {
    const navies = [
      afloat("escort", ["destroyer"]),
      afloat("raiders", ["submarine"]),
      NO_NAVY,
    ];

    expect(
      fleetOf(
        itemAt(
          foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS, OPENING)
            .navies,
          1,
          NO_NAVY
        ),
        "raiders"
      ).ships
    ).toStrictEqual([]);
  });

  it("should take a submarine's torpedoes off the cruiser's hull when the two meet", () => {
    const navies = [
      afloat("main", ["cruiser"]),
      afloat("raiders", ["submarine"]),
      NO_NAVY,
    ];

    expect(
      firstShip(
        foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS, OPENING)
          .navies,
        0,
        "main"
      ).hp
    ).toBeCloseTo(87.584);
  });

  it("should strip the cruiser's cohesion no lower than none when the fire exceeds it", () => {
    const navies = [
      afloat("main", ["cruiser"]),
      afloat("raiders", ["submarine"]),
      NO_NAVY,
    ];

    expect(
      firstShip(
        foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS, OPENING)
          .navies,
        0,
        "main"
      ).organisation
    ).toBe(0);
  });

  it("should aim the whole surface fire at the ships on the surface when a submarine of the same side is there too", () => {
    const navies = [
      alongside(
        afloat("main", ["battleship"]),
        afloat("raiders", ["submarine"])
      ),
      afloat("main", ["destroyer"]),
      NO_NAVY,
    ];

    expect(
      firstShip(
        foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS, OPENING)
          .navies,
        0,
        "main"
      ).hp
    ).toBeCloseTo(443.4408);
  });

  it("should split an enemy's fire between two allies by how visible each is when both are at war with it", () => {
    const wars = declared(ZERO_FIGHTS_ONE.wars, { one: 2, other: 1 });
    const navies = [
      afloat("main", ["destroyer"]),
      afloat("raiders", ["submarine"]),
      afloat("escort", ["destroyer"]),
    ];

    expect(
      firstShip(
        foughtAtSea(navies, wars, ROLES, FULL_GUNS, OPENING).navies,
        2,
        "escort"
      ).hp
    ).toBeCloseTo(13.792);
  });

  it("should take the carrier's naval bombers off an enemy battleship's hull when the two meet", () => {
    const navies = [
      afloat("main", ["battleship"]),
      afloat("main", ["carrier"]),
      NO_NAVY,
    ];

    expect(
      firstShip(
        foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS, OPENING)
          .navies,
        0,
        "main"
      ).hp
    ).toBeCloseTo(423.18);
  });

  it("should put out half its fire when its nation's fuel leaves its guns half of it", () => {
    const navies = [
      afloat("main", ["battleship"]),
      afloat("main", ["carrier"]),
      NO_NAVY,
    ];

    expect(
      firstShip(
        foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, [1, 0.5, 1], OPENING)
          .navies,
        0,
        "main"
      ).hp
    ).toBeCloseTo(459.09);
  });

  it("should fire in full when no share of its guns is given for the nation", () => {
    const navies = [
      afloat("main", ["battleship"]),
      afloat("main", ["carrier"]),
      NO_NAVY,
    ];

    expect(
      firstShip(
        foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, [], OPENING).navies,
        0,
        "main"
      ).hp
    ).toBeCloseTo(423.18);
  });

  it("should cut the depth charges by the same share when its nation's fuel leaves its guns half of them", () => {
    const navies = [
      afloat("escort", ["destroyer"]),
      afloat("raiders", ["submarine"]),
      NO_NAVY,
    ];

    expect(
      firstShip(
        foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, [0.5, 1, 1], OPENING)
          .navies,
        1,
        "raiders"
      ).hp
    ).toBeCloseTo(5.888);
  });

  it("should arm a nation as it opens the world when no armoury is given for it", () => {
    const navies = [
      afloat("main", ["battleship"]),
      afloat("main", ["destroyer"]),
      NO_NAVY,
    ];

    expect(
      firstShip(
        foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS, []).navies,
        0,
        "main"
      ).hp
    ).toBeCloseTo(443.4408);
  });

  it("should raise a submarine's torpedoes by the share its nation's research adds to them when the two meet", () => {
    const navies = [
      afloat("main", ["battleship"]),
      afloat("raiders", ["submarine"]),
      NO_NAVY,
    ];

    expect(
      firstShip(
        foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS, [
          OPENING_ARMOURY,
          TORPEDOES_DOUBLED,
        ]).navies,
        0,
        "main"
      ).hp
    ).toBeCloseTo(390.168);
  });

  it("should raise a battleship's light and heavy batteries by the shares its nation's research adds to them when it meets a battleship", () => {
    const navies = [
      afloat("main", ["battleship"]),
      afloat("main", ["battleship"]),
      NO_NAVY,
    ];

    expect(
      firstShip(
        foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS, [
          OPENING_ARMOURY,
          BATTERIES_DOUBLED,
        ]).navies,
        0,
        "main"
      ).hp
    ).toBeCloseTo(319.32);
  });

  it("should strike with the naval attack of the nation's newest naval bomber when its carrier meets a battleship", () => {
    const navies = [
      afloat("main", ["battleship"]),
      afloat("main", ["carrier"]),
      NO_NAVY,
    ];

    expect(
      firstShip(
        foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS, [
          OPENING_ARMOURY,
          NEWER_BOMBERS,
        ]).navies,
        0,
        "main"
      ).hp
    ).toBeCloseTo(400.68);
  });
});

describe(afloatAfter, () => {
  it("should take three fifths of the damage off the hull and all of it off the cohesion when the ship survives the hit", () => {
    expect(afloatAfter(launched("light-cruiser-2"), 10)).toStrictEqual([
      { design: "light-cruiser-2", hp: 134, organisation: 30, planes: 0 },
    ]);
  });

  it("should leave nothing when the hit takes the whole hull", () => {
    expect(afloatAfter(launched("destroyer-2"), 1000)).toStrictEqual([]);
  });
});

describe(foughtToday, () => {
  it("should read true for a task force that met an enemy when the day's battles are done", () => {
    const navies = [
      afloat("main", ["battleship"]),
      afloat("raiders", ["submarine"]),
      NO_NAVY,
    ];

    expect(
      foughtToday(
        foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS, OPENING),
        ROLES,
        1,
        2
      )
    ).toBeTruthy();
  });

  it("should read false for a task force that met no enemy when the day's battles are done", () => {
    const navies = [
      afloat("main", ["battleship"]),
      afloat("raiders", ["submarine"]),
      NO_NAVY,
    ];

    expect(
      foughtToday(
        foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS, OPENING),
        ROLES,
        1,
        0
      )
    ).toBeFalsy();
  });
});
