import { describe, expect, it } from "vite-plus/test";
import { itemAt } from "./lookup";
import { afloatAfter, foughtAtSea, foughtToday } from "./naval-combat";
import type { FleetRole, Navy, TaskForce } from "./navy";
import { FLEET_ROLES, fleetOf, NO_NAVY } from "./navy";
import { ZERO_FIGHTS_ONE } from "./sea-fixture";
import type { Ship, ShipClass } from "./ships";
import { launched } from "./ships";
import { UNASSIGNED } from "./spread";
import { declared } from "./wars";

/** The task forces each nation keeps, which is how a battle's places are counted. */
const ROLES = FLEET_ROLES.length;

/** A ship that stands in for one a fleet has lost, so a read of it shows no hull. */
const SUNK: Ship = {
  hp: 0,
  organisation: 0,
  planes: 0,
  shipClass: "destroyer",
};

/** Every nation's guns firing in full, their fuel tanks full. */
const FULL_GUNS: readonly number[] = [1, 1, 1];

/** A navy whose task force in `role` holds ships of `classes` in zone 5 on `mission`. */
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
    return { ...fleet, mission, ships: classes.map(launched), zone: 5 };
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
      foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS)
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
      foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS).zones
    ).toStrictEqual(new Set());
  });

  it("should record the zone a battle was fought in when two enemies meet there", () => {
    const navies = [
      afloat("main", ["battleship"]),
      afloat("main", ["battleship"]),
      NO_NAVY,
    ];

    expect(
      foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS).zones
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
          foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS).navies,
          1,
          NO_NAVY
        ),
        "raiders"
      ).ships
    ).toStrictEqual([]);
  });

  it("should take a submarine's torpedoes off the destroyer's hull when the two meet", () => {
    const navies = [
      afloat("main", ["destroyer"]),
      afloat("raiders", ["submarine"]),
      NO_NAVY,
    ];

    expect(
      firstShip(
        foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS).navies,
        0,
        "main"
      ).hp
    ).toBeCloseTo(3.712);
  });

  it("should strip the destroyer's cohesion no lower than none when the fire exceeds it", () => {
    const navies = [
      afloat("main", ["destroyer"]),
      afloat("raiders", ["submarine"]),
      NO_NAVY,
    ];

    expect(
      firstShip(
        foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS).navies,
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
        foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS).navies,
        0,
        "main"
      ).hp
    ).toBeCloseTo(323.632);
  });

  it("should split an enemy's fire between two allies by how visible each is when both are at war with it", () => {
    const wars = declared(ZERO_FIGHTS_ONE.wars, { one: 2, other: 1 });
    const navies = [
      afloat("main", ["destroyer"]),
      afloat("raiders", ["submarine"]),
      afloat("escort", ["destroyer"]),
    ];

    expect(
      firstShip(foughtAtSea(navies, wars, ROLES, FULL_GUNS).navies, 2, "escort")
        .hp
    ).toBeCloseTo(21.856);
  });

  it("should take the carrier's naval bombers off an enemy battleship's hull when the two meet", () => {
    const navies = [
      afloat("main", ["battleship"]),
      afloat("main", ["carrier"]),
      NO_NAVY,
    ];

    expect(
      firstShip(
        foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS).navies,
        0,
        "main"
      ).hp
    ).toBeCloseTo(235);
  });

  it("should put out half its fire when its nation's fuel leaves its guns half of it", () => {
    const navies = [
      afloat("main", ["battleship"]),
      afloat("main", ["carrier"]),
      NO_NAVY,
    ];

    expect(
      firstShip(
        foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, [1, 0.5, 1]).navies,
        0,
        "main"
      ).hp
    ).toBeCloseTo(302.5);
  });

  it("should fire in full when no share of its guns is given for the nation", () => {
    const navies = [
      afloat("main", ["battleship"]),
      afloat("main", ["carrier"]),
      NO_NAVY,
    ];

    expect(
      firstShip(
        foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, []).navies,
        0,
        "main"
      ).hp
    ).toBeCloseTo(235);
  });

  it("should cut the depth charges by the same share when its nation's fuel leaves its guns half of them", () => {
    const navies = [
      afloat("escort", ["destroyer"]),
      afloat("raiders", ["submarine"]),
      NO_NAVY,
    ];

    expect(
      firstShip(
        foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, [0.5, 1, 1]).navies,
        1,
        "raiders"
      ).hp
    ).toBeCloseTo(9.92);
  });
});

describe(afloatAfter, () => {
  it("should take three fifths of the damage off the hull and all of it off the cohesion when the ship survives the hit", () => {
    expect(afloatAfter(launched("cruiser"), 10)).toStrictEqual([
      { hp: 104, organisation: 30, planes: 0, shipClass: "cruiser" },
    ]);
  });

  it("should leave nothing when the hit takes the whole hull", () => {
    expect(afloatAfter(launched("destroyer"), 1000)).toStrictEqual([]);
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
        foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS),
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
        foughtAtSea(navies, ZERO_FIGHTS_ONE.wars, ROLES, FULL_GUNS),
        ROLES,
        1,
        0
      )
    ).toBeFalsy();
  });
});
