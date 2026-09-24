import { Schema } from "effect";
import type { ResourceNeed } from "./resources";
import { NO_RESOURCES } from "./resources";
import { newestPicker } from "./techs";

/** Every kind of plane the factories turn out. */
const AircraftSchema = Schema.Literals([
  "fighter",
  "close-support",
  "naval-bomber",
  "transport",
]);

export type Aircraft = typeof AircraftSchema.Type;

export const AIRCRAFT = AircraftSchema.literals;

/** What one plane design is, what it costs and what it can do. */
export interface Airframe {
  readonly aircraft: Aircraft;
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

/** Every plane design, named by the technology that unlocks it, in the order the tree lists them. */
const AirframeModelSchema = Schema.Literals([
  "interwar-fighter",
  "fighter-1",
  "fighter-2",
  "fighter-3",
  "close-air-support-1",
  "close-air-support-2",
  "close-air-support-3",
  "naval-bomber-1",
  "naval-bomber-2",
  "naval-bomber-3",
  "transport-plane-1",
]);

export type AirframeModel = typeof AirframeModelSchema.Type;

export const AIRFRAME_MODELS = AirframeModelSchema.literals;

/**
 * The planes of Hearts of Iron IV without By Blood Alone, from the inter-war
 * fighter to the 1944 models: their cost, their air attack, air defence,
 * agility and speed, their ground and naval attack, their fuel, and the
 * aluminium and rubber they take. The transport plane is its 1.12 files' one,
 * which every nation can build from the start without a technology.
 */
const AIRFRAMES = {
  "close-air-support-1": {
    agility: 35,
    airAttack: 6,
    airDefence: 14,
    aircraft: "close-support",
    cost: 22,
    fuel: 0.26,
    groundAttack: 8,
    navalAttack: 3,
    resources: { ...NO_RESOURCES, aluminium: 2, rubber: 1 },
    speed: 390,
  },
  "close-air-support-2": {
    agility: 39,
    airAttack: 10,
    airDefence: 16,
    aircraft: "close-support",
    cost: 24,
    fuel: 0.26,
    groundAttack: 13,
    navalAttack: 5,
    resources: { ...NO_RESOURCES, aluminium: 3, rubber: 1 },
    speed: 450,
  },
  "close-air-support-3": {
    agility: 44,
    airAttack: 14,
    airDefence: 20,
    aircraft: "close-support",
    cost: 26,
    fuel: 0.26,
    groundAttack: 18,
    navalAttack: 10,
    resources: { ...NO_RESOURCES, aluminium: 3, rubber: 1 },
    speed: 550,
  },
  "fighter-1": {
    agility: 50,
    airAttack: 18,
    airDefence: 10,
    aircraft: "fighter",
    cost: 24,
    fuel: 0.21,
    groundAttack: 0,
    navalAttack: 2,
    resources: { ...NO_RESOURCES, aluminium: 3, rubber: 1 },
    speed: 500,
  },
  "fighter-2": {
    agility: 65,
    airAttack: 27,
    airDefence: 12,
    aircraft: "fighter",
    cost: 26,
    fuel: 0.21,
    groundAttack: 0,
    navalAttack: 4,
    resources: { ...NO_RESOURCES, aluminium: 3, rubber: 1 },
    speed: 650,
  },
  "fighter-3": {
    agility: 80,
    airAttack: 32,
    airDefence: 14,
    aircraft: "fighter",
    cost: 28,
    fuel: 0.21,
    groundAttack: 0,
    navalAttack: 6,
    resources: { ...NO_RESOURCES, aluminium: 4, rubber: 1 },
    speed: 720,
  },
  "interwar-fighter": {
    agility: 45,
    airAttack: 9,
    airDefence: 8,
    aircraft: "fighter",
    cost: 22,
    fuel: 0.21,
    groundAttack: 0,
    navalAttack: 1,
    resources: { ...NO_RESOURCES, aluminium: 2, rubber: 1 },
    speed: 330,
  },
  "naval-bomber-1": {
    agility: 30,
    airAttack: 6,
    airDefence: 12,
    aircraft: "naval-bomber",
    cost: 26,
    fuel: 0.28,
    groundAttack: 0,
    navalAttack: 15,
    resources: { ...NO_RESOURCES, aluminium: 2, rubber: 1 },
    speed: 230,
  },
  "naval-bomber-2": {
    agility: 35,
    airAttack: 10,
    airDefence: 14,
    aircraft: "naval-bomber",
    cost: 28,
    fuel: 0.28,
    groundAttack: 0,
    navalAttack: 20,
    resources: { ...NO_RESOURCES, aluminium: 3, rubber: 1 },
    speed: 300,
  },
  "naval-bomber-3": {
    agility: 40,
    airAttack: 14,
    airDefence: 16,
    aircraft: "naval-bomber",
    cost: 30,
    fuel: 0.28,
    groundAttack: 0,
    navalAttack: 25,
    resources: { ...NO_RESOURCES, aluminium: 3, rubber: 1 },
    speed: 400,
  },
  "transport-plane-1": {
    agility: 10,
    airAttack: 0,
    airDefence: 20,
    aircraft: "transport",
    cost: 4,
    fuel: 1,
    groundAttack: 0,
    navalAttack: 0,
    resources: { ...NO_RESOURCES, aluminium: 3, rubber: 2 },
    speed: 300,
  },
} satisfies Readonly<Record<AirframeModel, Airframe>>;

export const airframeOf = (model: AirframeModel): Airframe => AIRFRAMES[model];

/** The kind of plane `model` is. */
const modelKind = (model: AirframeModel): Aircraft => AIRFRAMES[model].aircraft;

/** The design a nation's factories build for each kind of plane. */
export const AirframeModelsSchema = Schema.Struct({
  "close-support": AirframeModelSchema,
  fighter: AirframeModelSchema,
  "naval-bomber": AirframeModelSchema,
  transport: AirframeModelSchema,
});

export type AirframeModels = typeof AirframeModelsSchema.Type;

/** The first design of each kind, which a factory builds where nothing newer is researched. */
const FIRST_MODELS = {
  "close-support": "close-air-support-1",
  fighter: "interwar-fighter",
  "naval-bomber": "naval-bomber-1",
  transport: "transport-plane-1",
} satisfies AirframeModels;

/** The newest researched design of one kind. */
const newest = newestPicker(AIRFRAME_MODELS, modelKind, FIRST_MODELS);

/**
 * The newest design of each kind among `researched`, in the tree's order,
 * and the first where none of a kind is.
 */
export const airframeModelsOf = (
  researched: ReadonlySet<string>
): AirframeModels => ({
  "close-support": newest(researched, "close-support"),
  fighter: newest(researched, "fighter"),
  "naval-bomber": newest(researched, "naval-bomber"),
  transport: newest(researched, "transport"),
});

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
