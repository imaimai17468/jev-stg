import { Option } from "effect";
import type { Diplomacy } from "./diplomacy";
import { allied } from "./diplomacy";
import { valueAt } from "./grid";
import { itemAt, replacedAt } from "./lookup";
import type { ProvinceGraph } from "./provinces";
import { aroundZone, stepAtSea } from "./seas";
import type { Ship, ShipClass, ShipyardOrder } from "./ships";
import {
  hullOf,
  hullShare,
  launched,
  orderOf,
  organisationShare,
  SHIP_CLASSES,
  supremacyOf,
} from "./ships";
import { UNASSIGNED } from "./spread";
import { atWar } from "./wars";

/**
 * The task forces every nation's navy is split into: the battle fleet, the
 * destroyers that shepherd its convoys, and the submarines that hunt the
 * enemy's.
 */
export type FleetRole = "main" | "escort" | "raiders";

export const FLEET_ROLES: readonly FleetRole[] = ["main", "escort", "raiders"];

/** What a task force is doing at sea, which is what its presence counts for. */
export type Mission = "strike" | "patrol" | "escort" | "raid" | "repair";

/**
 * The share of its ships' weight each mission counts toward the hold over the
 * sea it covers, after Hearts of Iron IV's naval supremacy. A task force
 * making for its port to repair counts for nothing, as one holding in port
 * does there.
 */
const MISSION_SUPREMACY = {
  escort: 0.5,
  patrol: 0.75,
  raid: 0.25,
  repair: 0,
  strike: 1,
} satisfies Readonly<Record<Mission, number>>;

/** One task force: its ships, where it is, and what it is doing. */
export interface TaskForce {
  readonly role: FleetRole;
  readonly mission: Mission;
  /** The sea zone it is in, or `UNASSIGNED` while it has no ships. */
  readonly zone: number;
  readonly ships: readonly Ship[];
}

/** The convoys a nation keeps running along one lane. */
export interface Lane {
  /** What the convoys carry. */
  readonly cargo: "supply" | "trade";
  /** The sea zones they cross, from the port they leave to the one they reach. */
  readonly zones: readonly number[];
  /** The convoys on it. */
  readonly convoys: number;
}

/** One nation's navy. */
export interface Navy {
  /** What its dockyards are working on. */
  readonly order: ShipyardOrder;
  /** The production already put into the one being built. */
  readonly progress: number;
  /** The convoys it has afloat, the ones on a lane included. */
  readonly convoys: number;
  /** Its task forces, one for each of `FLEET_ROLES`, in that order. */
  readonly fleets: readonly TaskForce[];
  /** The lanes its convoys ran yesterday. */
  readonly lanes: readonly Lane[];
  /**
   * The share of what its ground cut off from its capital needs that the
   * convoys brought yesterday, from 0 to 1.
   */
  readonly overseas: number;
  /** The share of what it bought over the sea that arrived yesterday, from 0 to 1. */
  readonly traded: number;
}

const emptyFleet = (role: FleetRole): TaskForce => ({
  mission: "patrol",
  role,
  ships: [],
  zone: UNASSIGNED,
});

/** A navy with nothing afloat and its dockyards laying down convoys. */
export const NO_NAVY: Navy = {
  convoys: 0,
  fleets: FLEET_ROLES.map(emptyFleet),
  lanes: [],
  order: "convoy",
  overseas: 1,
  progress: 0,
  traded: 1,
};

/** The task force `navy` keeps in `role`. */
export const fleetOf = (navy: Navy, role: FleetRole): TaskForce =>
  itemAt(navy.fleets, FLEET_ROLES.indexOf(role), emptyFleet(role));

/** How many of `fleet`'s ships are of `shipClass`. */
export const countOf = (fleet: TaskForce, shipClass: ShipClass): number =>
  fleet.ships.filter((ship) => ship.shipClass === shipClass).length;

/** How many screens Hearts of Iron IV wants beside every capital ship. */
const SCREENS_PER_CAPITAL = 3;

const screensOf = (fleet: TaskForce): number =>
  fleet.ships.filter((ship) => hullOf(ship.shipClass).role === "screen").length;

/** Whether a ship of `shipClass` wants screens beside it: a capital ship or a carrier. */
const isScreened = (shipClass: ShipClass): boolean => {
  const { role } = hullOf(shipClass);
  return role === "capital" || role === "carrier";
};

const capitalsOf = (fleet: TaskForce): number =>
  fleet.ships.filter((ship) => isScreened(ship.shipClass)).length;

/**
 * The share of the screens its capital ships want that `fleet` has, from 0 to
 * 1, which is full where it has no capital ship to screen.
 */
export const screeningOf = (fleet: TaskForce): number => {
  const capitals = capitalsOf(fleet);
  if (capitals === 0) {
    return 1;
  }
  return Math.min(1, screensOf(fleet) / (SCREENS_PER_CAPITAL * capitals));
};

/**
 * The task force a new warship of `shipClass` joins: a battleship, a carrier
 * or a cruiser the battle fleet, a submarine the raiders, and a destroyer the battle fleet
 * while its capital ships lack screens and the escorts after that.
 */
const roleFor = (navy: Navy, shipClass: ShipClass): FleetRole => {
  if (shipClass === "submarine") {
    return "raiders";
  }
  const main = fleetOf(navy, "main");
  if (
    shipClass === "destroyer" &&
    screensOf(main) >= SCREENS_PER_CAPITAL * capitalsOf(main)
  ) {
    return "escort";
  }
  return "main";
};

/**
 * Where a task force stands once a ship joins it: where it already is, or at
 * `home` where the ship is its first.
 */
const joinedAt = (fleet: TaskForce, home: number): number => {
  if (fleet.ships.length === 0) {
    return home;
  }
  return fleet.zone;
};

/** The navy with `ship` added to the task force its class joins. */
const commissioned = (navy: Navy, ship: Ship, home: number): Navy => {
  const role = roleFor(navy, ship.shipClass);
  const fleet = fleetOf(navy, role);
  return {
    ...navy,
    fleets: replacedAt(navy.fleets, FLEET_ROLES.indexOf(role), {
      ...fleet,
      ships: [...fleet.ships, ship],
      zone: joinedAt(fleet, home),
    }),
  };
};

/** The navy with one of `order` finished and put to sea at `home`. */
const finished = (navy: Navy, order: ShipyardOrder, home: number): Navy => {
  if (order === "convoy") {
    return { ...navy, convoys: navy.convoys + 1 };
  }
  return commissioned(navy, launched(order), home);
};

/**
 * The navy after its dockyards have put `output` into what they are building,
 * finishing as many as that pays for and carrying the rest into the next. A
 * nation with no port to launch from builds nothing.
 */
export const builtOneDay = (navy: Navy, output: number, home: number): Navy => {
  if (home === UNASSIGNED) {
    return navy;
  }
  const { cost } = orderOf(navy.order);
  let built = { ...navy, progress: navy.progress + output };
  while (built.progress >= cost) {
    built = finished(
      { ...built, progress: built.progress - cost },
      built.order,
      home
    );
  }
  return built;
};

/**
 * The navy with its dockyards turned to `order`. The production already put in
 * carries over, so a nation that changes its mind loses no dockyard-days.
 */
export const withOrder = (navy: Navy, order: ShipyardOrder): Navy => ({
  ...navy,
  order,
});

/**
 * What a nation's navy opens 1936 with for each dockyard it has. Hearts of
 * Iron IV's nations open with their historical fleets, so these are this
 * game's own.
 */
const OPENING_FLEET_PER_DOCKYARD = {
  battleship: 0.25,
  carrier: 0.1,
  cruiser: 0.5,
  destroyer: 2,
  submarine: 1,
} satisfies Readonly<Record<ShipClass, number>>;
const OPENING_CONVOYS_PER_DOCKYARD = 10;

/**
 * The navy a nation with `dockyards` opens the world with, put to sea at
 * `home`: none where it has no port, and otherwise a fleet and convoys in
 * proportion to its yards, its capital ships first so the destroyers go to
 * screen them.
 */
export const openingNavy = (dockyards: number, home: number): Navy => {
  if (home === UNASSIGNED) {
    return NO_NAVY;
  }
  let navy: Navy = {
    ...NO_NAVY,
    convoys: dockyards * OPENING_CONVOYS_PER_DOCKYARD,
  };
  for (const shipClass of SHIP_CLASSES.toSorted(
    (one, other) => Number(!isScreened(one)) - Number(!isScreened(other))
  )) {
    const count = Math.floor(dockyards * OPENING_FLEET_PER_DOCKYARD[shipClass]);
    for (let built = 0; built < count; built += 1) {
      navy = commissioned(navy, launched(shipClass), home);
    }
  }
  return navy;
};

/** The hull share below which a task force breaks off to repair. */
const DAMAGED_HULL = 0.5;
/** The organisation share below which a task force breaks off to repair. */
const SHAKEN_ORGANISATION = 0.3;
/** The shares a repairing task force waits for before it sails again. */
const REPAIRED = 0.9;

/** The average of `share` over the fleet's ships. */
const averageOf = (fleet: TaskForce, share: (ship: Ship) => number): number =>
  fleet.ships.reduce((total, ship) => total + share(ship), 0) /
  Math.max(1, fleet.ships.length);

/**
 * Whether the task force has to be in port: it came out of a battle badly
 * hurt or shaken, or it is still repairing from one. A task force with no
 * ships is neither.
 */
const needsPort = (fleet: TaskForce): boolean => {
  if (fleet.ships.length === 0) {
    return false;
  }
  const hull = averageOf(fleet, hullShare);
  const organisation = averageOf(fleet, organisationShare);
  if (fleet.mission === "repair") {
    return hull < REPAIRED || organisation < REPAIRED;
  }
  return hull < DAMAGED_HULL || organisation < SHAKEN_ORGANISATION;
};

/** Where a nation's task forces are wanted today. */
export interface Station {
  /** The zone its ships put to sea from and repair in. */
  readonly home: number;
  /**
   * The middle zone of the lane its landing crosses, while one is planned,
   * which puts the whole of a short lane within the stretch the fleet covers.
   */
  readonly landing: Option.Option<number>;
  /** Its own lane zone the enemy holds the most weight in, while at war. */
  readonly threatened: Option.Option<number>;
  /** Its own lane zone the most of its convoys cross. */
  readonly busiest: Option.Option<number>;
  /** The enemy lane zone the most of the enemy's convoys cross, while at war. */
  readonly prey: Option.Option<number>;
}

/** What a task force is ordered to do, and where. */
export interface Orders {
  readonly mission: Mission;
  readonly target: number;
}

/** The orders for a task force in `role` that `station` wants somewhere. */
const sentOut = (role: FleetRole, station: Station): Option.Option<Orders> => {
  if (role === "raiders") {
    return station.prey.pipe(
      Option.map((target) => ({ mission: "raid", target }))
    );
  }
  if (role === "escort") {
    return station.busiest.pipe(
      Option.map((target) => ({ mission: "escort", target }))
    );
  }
  return Option.map(
    Option.orElse(station.landing, () => station.threatened),
    (target) => ({
      mission: "strike",
      target,
    })
  );
};

/**
 * The orders a task force takes today: to port where it is hurt, where
 * `station` wants its role, and otherwise to patrol the waters off its port.
 */
export const ordersFor = (fleet: TaskForce, station: Station): Orders => {
  if (needsPort(fleet)) {
    return { mission: "repair", target: station.home };
  }
  return Option.getOrElse(sentOut(fleet.role, station), () => ({
    mission: "patrol",
    target: station.home,
  }));
};

/** The cohesion a ship out of battle recovers in a day, as a share of its own. */
const ORGANISATION_PER_DAY = 0.1;
/** The hull a ship in its home port has repaired in a day, as a share of its own. */
const REPAIR_PER_DAY = 0.02;

/** The ship after a day out of battle, in its home port or away from it. */
const recovered = (ship: Ship, inPort: boolean): Ship => {
  const hull = hullOf(ship.shipClass);
  return {
    ...ship,
    hp: Math.min(hull.hp, ship.hp + hull.hp * REPAIR_PER_DAY * Number(inPort)),
    organisation: Math.min(
      hull.organisation,
      ship.organisation + hull.organisation * ORGANISATION_PER_DAY
    ),
  };
};

/**
 * The task force a day on under `orders`: one zone further toward its target
 * over the sea, which `distance` counts toward, and its ships a day further
 * recovered, their hulls only once it lies in its home port to repair. A task
 * force with no ships stays nowhere.
 */
export const sailed = (
  graph: ProvinceGraph,
  fleet: TaskForce,
  orders: Orders,
  distance: Int32Array
): TaskForce => {
  if (fleet.ships.length === 0) {
    return { ...fleet, mission: orders.mission, zone: UNASSIGNED };
  }
  const zone = stepAtSea(graph, distance, fleet.zone);
  const inPort = zone === orders.target && orders.mission === "repair";
  return {
    ...fleet,
    mission: orders.mission,
    ships: fleet.ships.map((ship) => recovered(ship, inPort)),
    zone,
  };
};

/** What a task force's ships count toward the hold over the sea around it. */
export const weightOf = (fleet: TaskForce): number =>
  fleet.ships.reduce(
    (total, ship) => total + supremacyOf(ship.shipClass) * hullShare(ship),
    0
  ) * MISSION_SUPREMACY[fleet.mission];

/** A nation's ships without the lift of any air superiority. */
const NO_LIFT = new Float32Array(0);

/**
 * The weight each nation's task forces hold over each province, by nation id
 * and then by province id: a task force counts in its own zone and every zone
 * beside it, which is the stretch of sea a mission covers, and its weight
 * grows by the share `lift` gives its nation over the zone it is in, which is
 * what its air superiority adds.
 */
export const watersOf = (
  graph: ProvinceGraph,
  navies: readonly Navy[],
  lift: readonly Float32Array[]
): readonly Float32Array[] =>
  navies.map((navy, nation) => {
    const weights = new Float32Array(graph.adjacency.length);
    const lifted = itemAt(lift, nation, NO_LIFT);
    for (const fleet of navy.fleets) {
      if (fleet.zone === UNASSIGNED) {
        continue;
      }
      const weight = weightOf(fleet) * (1 + valueAt(lifted, fleet.zone));
      for (const zone of aroundZone(graph, fleet.zone)) {
        weights[zone] = valueAt(weights, zone) + weight;
      }
    }
    return weights;
  });

/** The weight every nation holds at sea, and who is fighting whom over it. */
export interface Contest {
  /** Every nation's weight over each zone, by nation id and then province id. */
  readonly waters: readonly Float32Array[];
  readonly diplomacy: Diplomacy;
}

/**
 * The share of the weight at sea in `zone` that `nation`'s enemies hold
 * against its side, from 0 to 1, which is none where no enemy is there. What
 * is left of it is the side's own supremacy there, so water no enemy ship
 * covers counts as fully held: the wiki counts only the ships present, and
 * says nothing of a zone neither side has any in, so leaving an empty sea
 * open is this game's own reading.
 */
export const enemyHoldIn = (
  contest: Contest,
  nation: number,
  zone: number
): number => {
  let own = 0;
  let enemy = 0;
  for (const [other, weights] of contest.waters.entries()) {
    const weight = valueAt(weights, zone);
    if (allied(contest.diplomacy, nation, other)) {
      own += weight;
    }
    if (atWar(contest.diplomacy.wars, nation, other)) {
      enemy += weight;
    }
  }
  return enemy / Math.max(Number.MIN_VALUE, own + enemy);
};

/** What all of `navy`'s warships would count for on a strike. */
export const fleetStrength = (navy: Navy): number =>
  navy.fleets.reduce(
    (total, fleet) =>
      total +
      fleet.ships.reduce((sum, ship) => sum + supremacyOf(ship.shipClass), 0),
    0
  );

/** How many submarines the rules want for each destroyer while at war. */
const SUBMARINES_PER_DESTROYER = 0.5;

/** How many destroyers the rules want for each cruiser among the screens. */
const DESTROYERS_PER_CRUISER = 2;

/**
 * What the rules set a nation's dockyards to: convoys while its lanes or its
 * landings want more than it has, then screens until its capital ships and
 * carriers have three each, then submarines at war until it has one for every
 * two destroyers, and after that a carrier while it has fewer of them than
 * battleships and a battleship once they are even.
 */
export const orderByRules = (
  navy: Navy,
  fighting: boolean,
  convoysWanted: number
): ShipyardOrder => {
  const ships = navy.fleets.flatMap((fleet) => fleet.ships);
  const count = (shipClass: ShipClass) =>
    ships.filter((ship) => ship.shipClass === shipClass).length;
  const screens = count("destroyer") + count("cruiser");
  const capitals = count("battleship") + count("carrier");
  if (navy.convoys < convoysWanted) {
    return "convoy";
  }
  if (screens < SCREENS_PER_CAPITAL * capitals) {
    if (count("destroyer") >= DESTROYERS_PER_CRUISER * count("cruiser")) {
      return "cruiser";
    }
    return "destroyer";
  }
  if (
    fighting &&
    count("submarine") < SUBMARINES_PER_DESTROYER * count("destroyer")
  ) {
    return "submarine";
  }
  if (count("carrier") < count("battleship")) {
    return "carrier";
  }
  return "battleship";
};
