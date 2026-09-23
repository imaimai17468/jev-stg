import { Schema } from "effect";
import type { ResourceNeed } from "./resources";
import { NO_RESOURCES } from "./resources";

/** Every class of warship a dockyard lays down. */
const ShipClassSchema = Schema.Literals([
  "destroyer",
  "cruiser",
  "battleship",
  "carrier",
  "submarine",
]);

export type ShipClass = typeof ShipClassSchema.Type;

export const SHIP_CLASSES = ShipClassSchema.literals;

/** What a nation's dockyards work on: one class of warship, or convoys. */
const ShipyardOrderSchema = Schema.Literals(["convoy", ...SHIP_CLASSES]);

export type ShipyardOrder = typeof ShipyardOrderSchema.Type;

export const SHIPYARD_ORDERS = ShipyardOrderSchema.literals;

/**
 * Where a warship stands in a battle line: a screen that shields the heavy
 * ships, a capital ship the screens shield, a carrier the screens shield as
 * they do a capital ship and that fights with its planes, or a submarine that
 * fights unseen.
 */
export type ShipRole = "screen" | "capital" | "carrier" | "submarine";

/** What one class of warship costs and what it can do. */
interface Hull {
  readonly role: ShipRole;
  /** The production a dockyard puts into one, in Hearts of Iron IV's units. */
  readonly cost: number;
  /** The damage it takes before it sinks. */
  readonly hp: number;
  /** The cohesion it starts a battle with and leaves it without. */
  readonly organisation: number;
  /** What an hour of its guns does to a ship on the surface when they hit. */
  readonly guns: number;
  /** What an hour of its torpedoes does to a ship on the surface when they hit. */
  readonly torpedoes: number;
  /** What an hour of its depth charges does to a submarine when they hit. */
  readonly depthCharges: number;
  /** How easily an enemy picks it out to fire at. */
  readonly visibility: number;
  /** What each dockyard building it takes out of the stockpiles every day. */
  readonly resources: ResourceNeed;
  /** The fuel usage its design shows, which Hearts of Iron IV multiplies into what it burns a day. */
  readonly fuel: number;
  /** The planes its hangars hold. */
  readonly deck: number;
}

/**
 * The 1936 hulls of Hearts of Iron IV's ship designer: their cost, hull
 * points, organisation, surface visibility, resources and fuel, and the 18
 * torpedo attack of its first torpedo launcher. The guns and the depth
 * charges of the default designs are not on the wiki, so those are this
 * game's own, and so is the fuel the engine of each default design adds to
 * its hull's, which the wiki gives for its later engines alone. A carrier
 * holds one hangar's 20 planes, since the wiki gives the hangar's deck size
 * and not how many hangars the 1936 design carries.
 */
const HULLS = {
  battleship: {
    cost: 3000,
    deck: 0,
    depthCharges: 0,
    fuel: 92,
    guns: 42,
    hp: 370,
    organisation: 50,
    resources: { ...NO_RESOURCES, chromium: 1, steel: 1 },
    role: "capital",
    torpedoes: 0,
    visibility: 20,
  },
  carrier: {
    cost: 2094,
    deck: 20,
    depthCharges: 0,
    fuel: 112,
    guns: 0,
    hp: 250,
    organisation: 40,
    resources: { ...NO_RESOURCES, chromium: 1, steel: 3 },
    role: "carrier",
    torpedoes: 0,
    visibility: 30,
  },
  cruiser: {
    cost: 1900,
    deck: 0,
    depthCharges: 0,
    fuel: 36,
    guns: 12,
    hp: 110,
    organisation: 40,
    resources: { ...NO_RESOURCES, steel: 2 },
    role: "screen",
    torpedoes: 0,
    visibility: 15,
  },
  destroyer: {
    cost: 500,
    deck: 0,
    depthCharges: 10,
    fuel: 8,
    guns: 5,
    hp: 40,
    organisation: 35,
    resources: { ...NO_RESOURCES, steel: 2 },
    role: "screen",
    torpedoes: 18,
    visibility: 10,
  },
  submarine: {
    cost: 350,
    deck: 0,
    depthCharges: 0,
    fuel: 5,
    guns: 0,
    hp: 20,
    organisation: 30,
    resources: { ...NO_RESOURCES, steel: 2 },
    role: "submarine",
    torpedoes: 18,
    visibility: 1,
  },
} satisfies Readonly<Record<ShipClass, Hull>>;

export const hullOf = (shipClass: ShipClass): Hull => HULLS[shipClass];

/**
 * What one convoy costs a dockyard and what each dockyard building convoys
 * takes out of the stockpiles. Neither is on the wiki, so both are this
 * game's own.
 */
const CONVOY = {
  cost: 100,
  resources: { ...NO_RESOURCES, steel: 2 },
} satisfies Pick<Hull, "cost" | "resources">;

/**
 * What one of `order` costs its dockyards to finish, and what each dockyard
 * working on it takes out of the stockpiles in a day.
 */
export const orderOf = (
  order: ShipyardOrder
): Pick<Hull, "cost" | "resources"> => {
  if (order === "convoy") {
    return CONVOY;
  }
  return HULLS[order];
};

/**
 * What one warship adds to its side's hold over a sea zone. The wiki says it
 * scales with the ship's production cost and gives an early battleship about
 * 356 and a destroyer about 117. Every reader of the weight sets one side's
 * against another's, so the cost raised to this power keeps that three to one
 * between them without matching either number.
 */
const SUPREMACY_EXPONENT = 0.62;

export const supremacyOf = (shipClass: ShipClass): number =>
  HULLS[shipClass].cost ** SUPREMACY_EXPONENT;

/** One warship: its class and what is left of it. */
export interface Ship {
  readonly shipClass: ShipClass;
  readonly hp: number;
  readonly organisation: number;
  /** The planes aboard, which only a carrier has room for. */
  readonly planes: number;
}

/**
 * A warship fresh from the dockyard, a carrier with its hangars full. Hearts
 * of Iron IV builds a carrier's planes on a line of their own, and this game
 * counts them into the hull.
 */
export const launched = (shipClass: ShipClass): Ship => {
  const { deck, hp, organisation } = HULLS[shipClass];
  return { hp, organisation, planes: deck, shipClass };
};

/** How much of its hull points the ship still has, from 0 to 1. */
export const hullShare = (ship: Ship): number =>
  ship.hp / HULLS[ship.shipClass].hp;

/** How much of its cohesion the ship still has, from 0 to 1. */
export const organisationShare = (ship: Ship): number =>
  ship.organisation / HULLS[ship.shipClass].organisation;
