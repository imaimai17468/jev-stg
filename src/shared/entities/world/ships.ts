import { Schema } from "effect";
import type { ResourceNeed } from "./resources";

/** Every class of warship a dockyard lays down. */
const ShipClassSchema = Schema.Literals([
  "destroyer",
  "cruiser",
  "battleship",
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
 * ships, a capital ship the screens shield, or a submarine that fights unseen.
 */
type ShipRole = "screen" | "capital" | "submarine";

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
}

/**
 * The 1936 hulls of Hearts of Iron IV's ship designer: their cost, hull
 * points, organisation, surface visibility and resources, and the 18 torpedo
 * attack of its first torpedo launcher. The guns and the depth charges of the
 * default designs are not on the wiki, so those are this game's own.
 */
const HULLS = {
  battleship: {
    cost: 3000,
    depthCharges: 0,
    guns: 42,
    hp: 370,
    organisation: 50,
    resources: { chromium: 1, steel: 1, tungsten: 0 },
    role: "capital",
    torpedoes: 0,
    visibility: 20,
  },
  cruiser: {
    cost: 1900,
    depthCharges: 0,
    guns: 12,
    hp: 110,
    organisation: 40,
    resources: { chromium: 0, steel: 2, tungsten: 0 },
    role: "screen",
    torpedoes: 0,
    visibility: 15,
  },
  destroyer: {
    cost: 500,
    depthCharges: 10,
    guns: 5,
    hp: 40,
    organisation: 35,
    resources: { chromium: 0, steel: 2, tungsten: 0 },
    role: "screen",
    torpedoes: 18,
    visibility: 10,
  },
  submarine: {
    cost: 350,
    depthCharges: 0,
    guns: 0,
    hp: 20,
    organisation: 30,
    resources: { chromium: 0, steel: 2, tungsten: 0 },
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
  resources: { chromium: 0, steel: 2, tungsten: 0 },
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
}

/** A warship fresh from the dockyard. */
export const launched = (shipClass: ShipClass): Ship => {
  const { hp, organisation } = HULLS[shipClass];
  return { hp, organisation, shipClass };
};

/** How much of its hull points the ship still has, from 0 to 1. */
export const hullShare = (ship: Ship): number =>
  ship.hp / HULLS[ship.shipClass].hp;

/** How much of its cohesion the ship still has, from 0 to 1. */
export const organisationShare = (ship: Ship): number =>
  ship.organisation / HULLS[ship.shipClass].organisation;
