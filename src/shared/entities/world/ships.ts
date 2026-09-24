import { Schema } from "effect";
import type { ResourceNeed } from "./economy/resources";
import { NO_RESOURCES } from "./economy/resources";
import { newestPicker } from "./techs";

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

/** Where each class of warship stands in a battle line. */
const ROLES = {
  battleship: "capital",
  carrier: "carrier",
  cruiser: "screen",
  destroyer: "screen",
  submarine: "submarine",
} satisfies Readonly<Record<ShipClass, ShipRole>>;

export const roleOf = (shipClass: ShipClass): ShipRole => ROLES[shipClass];

/** Every warship design, named by the technology that unlocks it, in the order the tree lists them. */
const ShipDesignSchema = Schema.Literals([
  "destroyer-1",
  "destroyer-2",
  "destroyer-3",
  "destroyer-4",
  "light-cruiser-1",
  "light-cruiser-2",
  "light-cruiser-3",
  "light-cruiser-4",
  "battleship-1",
  "battleship-2",
  "battleship-3",
  "battleship-4",
  "carrier-1",
  "carrier-2",
  "carrier-3",
  "carrier-4",
  "submarine-1",
  "submarine-2",
  "submarine-3",
  "submarine-4",
]);

export type ShipDesign = typeof ShipDesignSchema.Type;

export const SHIP_DESIGNS = ShipDesignSchema.literals;

/** What one warship design is, what it costs and what it can do. */
interface Hull {
  readonly shipClass: ShipClass;
  /** The production a dockyard puts into one, in Hearts of Iron IV's units. */
  readonly cost: number;
  /** The damage it takes before it sinks. */
  readonly hp: number;
  /** The cohesion it starts a battle with and leaves it without. */
  readonly organisation: number;
  /** What an hour of its light batteries does to a ship on the surface when they hit. */
  readonly light: number;
  /** What an hour of its heavy batteries does to a ship on the surface when they hit. */
  readonly heavy: number;
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
 * The warships of Hearts of Iron IV without Man the Guns, the light cruisers
 * standing for this world's cruisers: their cost, hull points, light and
 * heavy attack, torpedo attack, depth charges, surface visibility, fuel,
 * resources and deck size. That page lists no organisation, so each class
 * keeps the one Man the Guns gives its 1936 hull.
 */
const HULLS = {
  "battleship-1": {
    cost: 12_246,
    deck: 0,
    depthCharges: 0,
    fuel: 87,
    heavy: 28,
    hp: 367.5,
    light: 7,
    organisation: 50,
    resources: { ...NO_RESOURCES, chromium: 1, steel: 3 },
    shipClass: "battleship",
    torpedoes: 0,
    visibility: 30,
  },
  "battleship-2": {
    cost: 12_960,
    deck: 0,
    depthCharges: 0,
    fuel: 92,
    heavy: 36,
    hp: 495,
    light: 7,
    organisation: 50,
    resources: { ...NO_RESOURCES, chromium: 1, steel: 4 },
    shipClass: "battleship",
    torpedoes: 0,
    visibility: 30,
  },
  "battleship-3": {
    cost: 13_650,
    deck: 0,
    depthCharges: 0,
    fuel: 97,
    heavy: 44,
    hp: 575,
    light: 8,
    organisation: 50,
    resources: { ...NO_RESOURCES, chromium: 2, steel: 4 },
    shipClass: "battleship",
    torpedoes: 0,
    visibility: 30,
  },
  "battleship-4": {
    cost: 15_489.75,
    deck: 0,
    depthCharges: 0,
    fuel: 102,
    heavy: 52,
    hp: 632.5,
    light: 9,
    organisation: 50,
    resources: { ...NO_RESOURCES, chromium: 3, steel: 5 },
    shipClass: "battleship",
    torpedoes: 0,
    visibility: 30,
  },
  "carrier-1": {
    cost: 7964,
    deck: 8,
    depthCharges: 0,
    fuel: 99,
    heavy: 0,
    hp: 250,
    light: 3,
    organisation: 40,
    resources: { ...NO_RESOURCES, chromium: 1, steel: 3 },
    shipClass: "carrier",
    torpedoes: 0,
    visibility: 30,
  },
  "carrier-2": {
    cost: 8822,
    deck: 10,
    depthCharges: 0,
    fuel: 99,
    heavy: 0,
    hp: 325,
    light: 3,
    organisation: 40,
    resources: { ...NO_RESOURCES, chromium: 1, steel: 4 },
    shipClass: "carrier",
    torpedoes: 0,
    visibility: 30,
  },
  "carrier-3": {
    cost: 11_110,
    deck: 14,
    depthCharges: 0,
    fuel: 99,
    heavy: 0,
    hp: 350,
    light: 3,
    organisation: 40,
    resources: { ...NO_RESOURCES, chromium: 2, steel: 4 },
    shipClass: "carrier",
    torpedoes: 0,
    visibility: 30,
  },
  "carrier-4": {
    cost: 11_935,
    deck: 16,
    depthCharges: 0,
    fuel: 99,
    heavy: 0,
    hp: 350,
    light: 3,
    organisation: 40,
    resources: { ...NO_RESOURCES, chromium: 2, steel: 5 },
    shipClass: "carrier",
    torpedoes: 0,
    visibility: 30,
  },
  "destroyer-1": {
    cost: 911.25,
    deck: 0,
    depthCharges: 9,
    fuel: 14,
    heavy: 0,
    hp: 25,
    light: 1,
    organisation: 35,
    resources: { ...NO_RESOURCES, steel: 2 },
    shipClass: "destroyer",
    torpedoes: 18,
    visibility: 10,
  },
  "destroyer-2": {
    cost: 1184.5,
    deck: 0,
    depthCharges: 14,
    fuel: 8,
    heavy: 0,
    hp: 40,
    light: 1.5,
    organisation: 35,
    resources: { ...NO_RESOURCES, steel: 2 },
    shipClass: "destroyer",
    torpedoes: 24,
    visibility: 10,
  },
  "destroyer-3": {
    cost: 1351.25,
    deck: 0,
    depthCharges: 18,
    fuel: 10,
    heavy: 0,
    hp: 50,
    light: 2,
    organisation: 35,
    resources: { ...NO_RESOURCES, steel: 3 },
    shipClass: "destroyer",
    torpedoes: 30,
    visibility: 10,
  },
  "destroyer-4": {
    cost: 1518,
    deck: 0,
    depthCharges: 23,
    fuel: 10,
    heavy: 0,
    hp: 60,
    light: 3,
    organisation: 35,
    resources: { ...NO_RESOURCES, chromium: 1, steel: 4 },
    shipClass: "destroyer",
    torpedoes: 36,
    visibility: 10,
  },
  "light-cruiser-1": {
    cost: 3116.5,
    deck: 0,
    depthCharges: 0,
    fuel: 32,
    heavy: 0,
    hp: 120,
    light: 8,
    organisation: 40,
    resources: { ...NO_RESOURCES, steel: 2 },
    shipClass: "cruiser",
    torpedoes: 20,
    visibility: 15,
  },
  "light-cruiser-2": {
    cost: 3301.75,
    deck: 0,
    depthCharges: 5,
    fuel: 36,
    heavy: 0,
    hp: 140,
    light: 10,
    organisation: 40,
    resources: { ...NO_RESOURCES, steel: 3 },
    shipClass: "cruiser",
    torpedoes: 26,
    visibility: 15,
  },
  "light-cruiser-3": {
    cost: 3528,
    deck: 0,
    depthCharges: 6,
    fuel: 40,
    heavy: 0,
    hp: 160,
    light: 12,
    organisation: 40,
    resources: { ...NO_RESOURCES, steel: 3 },
    shipClass: "cruiser",
    torpedoes: 32,
    visibility: 15,
  },
  "light-cruiser-4": {
    cost: 4116,
    deck: 0,
    depthCharges: 8,
    fuel: 40,
    heavy: 0,
    hp: 180,
    light: 15,
    organisation: 40,
    resources: { ...NO_RESOURCES, chromium: 1, steel: 4 },
    shipClass: "cruiser",
    torpedoes: 38,
    visibility: 15,
  },
  "submarine-1": {
    cost: 363,
    deck: 0,
    depthCharges: 0,
    fuel: 8,
    heavy: 0,
    hp: 10,
    light: 0,
    organisation: 30,
    resources: { ...NO_RESOURCES, steel: 1 },
    shipClass: "submarine",
    torpedoes: 15,
    visibility: 1,
  },
  "submarine-2": {
    cost: 451,
    deck: 0,
    depthCharges: 0,
    fuel: 8,
    heavy: 0,
    hp: 20,
    light: 0,
    organisation: 30,
    resources: { ...NO_RESOURCES, steel: 2 },
    shipClass: "submarine",
    torpedoes: 26,
    visibility: 1,
  },
  "submarine-3": {
    cost: 583,
    deck: 0,
    depthCharges: 0,
    fuel: 8,
    heavy: 0,
    hp: 30,
    light: 0,
    organisation: 30,
    resources: { ...NO_RESOURCES, steel: 2 },
    shipClass: "submarine",
    torpedoes: 42,
    visibility: 1,
  },
  "submarine-4": {
    cost: 660,
    deck: 0,
    depthCharges: 0,
    fuel: 8,
    heavy: 0,
    hp: 35,
    light: 0,
    organisation: 30,
    resources: { ...NO_RESOURCES, chromium: 1, steel: 3 },
    shipClass: "submarine",
    torpedoes: 54,
    visibility: 1,
  },
} satisfies Readonly<Record<ShipDesign, Hull>>;

export const hullOf = (design: ShipDesign): Hull => HULLS[design];

/** The class of warship `design` builds. */
const designClass = (design: ShipDesign): ShipClass => HULLS[design].shipClass;

/**
 * What one convoy costs a dockyard and what each dockyard building convoys
 * takes out of the stockpiles. Neither is on the wiki, so both are this
 * game's own.
 */
const CONVOY = {
  cost: 100,
  resources: { ...NO_RESOURCES, steel: 2 },
} satisfies Pick<Hull, "cost" | "resources">;

/** The design a nation's dockyards lay down for each class of warship. */
export const ShipDesignsSchema = Schema.Struct({
  battleship: ShipDesignSchema,
  carrier: ShipDesignSchema,
  cruiser: ShipDesignSchema,
  destroyer: ShipDesignSchema,
  submarine: ShipDesignSchema,
});

export type ShipDesigns = typeof ShipDesignsSchema.Type;

/** The first design of each class, which a dockyard lays down where nothing newer is researched. */
const FIRST_DESIGNS = {
  battleship: "battleship-1",
  carrier: "carrier-1",
  cruiser: "light-cruiser-1",
  destroyer: "destroyer-1",
  submarine: "submarine-1",
} satisfies ShipDesigns;

/** The newest researched design of one kind. */
const newest = newestPicker(SHIP_DESIGNS, designClass, FIRST_DESIGNS);

/**
 * The newest design of each class among `researched`, in the tree's order,
 * and the first where none of a class is.
 */
export const shipDesignsOf = (
  researched: ReadonlySet<string>
): ShipDesigns => ({
  battleship: newest(researched, "battleship"),
  carrier: newest(researched, "carrier"),
  cruiser: newest(researched, "cruiser"),
  destroyer: newest(researched, "destroyer"),
  submarine: newest(researched, "submarine"),
});

/**
 * What one of `order` costs its dockyards to finish, and what each dockyard
 * working on it takes out of the stockpiles in a day, a warship being the
 * design `designs` lays down for its class.
 */
export const orderOf = (
  order: ShipyardOrder,
  designs: ShipDesigns
): Pick<Hull, "cost" | "resources"> => {
  if (order === "convoy") {
    return CONVOY;
  }
  return HULLS[designs[order]];
};

/**
 * What one warship adds to its side's hold over a sea zone. The wiki says it
 * scales with the ship's production cost and gives an early battleship about
 * 356 and a destroyer about 117. Every reader of the weight sets one side's
 * against another's, so the cost raised to this power keeps that three to one
 * between the first battleship and the first destroyer without matching
 * either number.
 */
const SUPREMACY_EXPONENT = 0.43;

export const supremacyOf = (design: ShipDesign): number =>
  HULLS[design].cost ** SUPREMACY_EXPONENT;

/** One warship: its design and what is left of it. */
export interface Ship {
  readonly design: ShipDesign;
  readonly hp: number;
  readonly organisation: number;
  /** The planes aboard, which only a carrier has room for. */
  readonly planes: number;
}

/** The class of warship `ship` is. */
export const classOf = (ship: Ship): ShipClass => designClass(ship.design);

/**
 * A warship fresh from the dockyard, a carrier with its hangars full. Hearts
 * of Iron IV builds a carrier's planes on a line of their own, and this game
 * counts them into the hull.
 */
export const launched = (design: ShipDesign): Ship => {
  const { deck, hp, organisation } = HULLS[design];
  return { design, hp, organisation, planes: deck };
};

/** How much of its hull points the ship still has, from 0 to 1. */
export const hullShare = (ship: Ship): number =>
  ship.hp / HULLS[ship.design].hp;

/** How much of its cohesion the ship still has, from 0 to 1. */
export const organisationShare = (ship: Ship): number =>
  ship.organisation / HULLS[ship.design].organisation;
