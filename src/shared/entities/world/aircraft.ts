import { Schema } from "effect";
import type { ResourceNeed } from "./resources";
import { NO_RESOURCES } from "./resources";

/** Every kind of plane the factories turn out. */
const AircraftSchema = Schema.Literals([
  "fighter",
  "close-support",
  "naval-bomber",
]);

export type Aircraft = typeof AircraftSchema.Type;

export const AIRCRAFT = AircraftSchema.literals;

/** What one kind of plane costs and what it can do. */
export interface Airframe {
  /** The production a military factory puts into one, in Hearts of Iron IV's units. */
  readonly cost: number;
  /** What it fires at other planes. */
  readonly airAttack: number;
  /** How much fire it takes to bring it down. */
  readonly airDefence: number;
  /** How hard it is to get on its tail. */
  readonly agility: number;
  /** In kilometres an hour. */
  readonly speed: number;
  /** What it does to a division when it strikes one. */
  readonly groundAttack: number;
  /** What it does to a ship when it strikes one. */
  readonly navalAttack: number;
  /** The fuel usage its wing shows, which Hearts of Iron IV multiplies into what one burns a day. */
  readonly fuel: number;
  /** What each military factory building it takes out of the stockpiles every day. */
  readonly resources: ResourceNeed;
}

/**
 * The 1936 planes of Hearts of Iron IV: their cost, their air attack, air
 * defence, agility and speed, their ground and naval attack, their fuel, and
 * the aluminium and rubber they take.
 */
const AIRFRAMES = {
  "close-support": {
    agility: 35,
    airAttack: 6,
    airDefence: 14,
    cost: 22,
    fuel: 0.26,
    groundAttack: 8,
    navalAttack: 0,
    resources: { ...NO_RESOURCES, aluminium: 2, rubber: 1 },
    speed: 390,
  },
  fighter: {
    agility: 50,
    airAttack: 18,
    airDefence: 10,
    cost: 24,
    fuel: 0.21,
    groundAttack: 0,
    navalAttack: 0,
    resources: { ...NO_RESOURCES, aluminium: 3, rubber: 1 },
    speed: 500,
  },
  "naval-bomber": {
    agility: 30,
    airAttack: 6,
    airDefence: 12,
    cost: 26,
    fuel: 0.28,
    groundAttack: 0,
    navalAttack: 15,
    resources: { ...NO_RESOURCES, aluminium: 2, rubber: 1 },
    speed: 230,
  },
} satisfies Readonly<Record<Aircraft, Airframe>>;

export const airframeOf = (aircraft: Aircraft): Airframe => AIRFRAMES[aircraft];

/** How much of its military factories a nation puts on planes. */
const AviationSchema = Schema.Literals(["none", "light", "heavy"]);

export type Aviation = typeof AviationSchema.Type;

export const AVIATIONS = AviationSchema.literals;

/**
 * The share of its military factories each weight of aviation puts on
 * planes. Hearts of Iron IV leaves the lines to the player, so these are
 * this game's own.
 */
const AVIATION_SHARES = {
  heavy: 0.4,
  light: 0.2,
  none: 0,
} satisfies Readonly<Record<Aviation, number>>;

export const aviationShareOf = (aviation: Aviation): number =>
  AVIATION_SHARES[aviation];
