import type {
  Aircraft,
  AirframeModel,
  AirframeModels,
  Aviation,
} from "./aircraft";
import { AIRCRAFT, airframeOf } from "./aircraft";
import { UNASSIGNED } from "./spread";

/**
 * What an air wing is doing: fighting for the sky over a region, striking the
 * divisions fighting below it, striking the ships at sea in it, or waiting at
 * its base, which is where transport planes wait to drop paratroopers.
 */
export type AirMission =
  | "superiority"
  | "close-support"
  | "naval-strike"
  | "standby";

/** One air wing: its planes, where it is based, and what it is doing. */
export interface Wing {
  readonly model: AirframeModel;
  /** The planes left in it, which a day's fighting leaves in fractions. */
  readonly planes: number;
  /** The province of the air base it flies from. */
  readonly base: number;
  readonly mission: AirMission;
  /** The region it is flying over, or `UNASSIGNED` while it waits at its base. */
  readonly region: number;
}

/** One nation's air force. */
export interface AirForce {
  /** The kind of plane its factories are building. */
  readonly order: Aircraft;
  /** How much of its military factories it puts on planes. */
  readonly aviation: Aviation;
  /** The production already put into the plane being built. */
  readonly progress: number;
  readonly wings: readonly Wing[];
}

/** An air force with no planes, building fighters on none of its factories. */
export const NO_AIR_FORCE: AirForce = {
  aviation: "none",
  order: "fighter",
  progress: 0,
  wings: [],
};

/** The planes one land-based wing holds at most, after Hearts of Iron IV. */
export const WING_SIZE = 100;

/** The kind of plane `wing` flies. */
export const aircraftOf = (wing: Wing): Aircraft =>
  airframeOf(wing.model).aircraft;

/** A wing of `planes` of `model` waiting at `base`. */
const wingAt = (model: AirframeModel, planes: number, base: number): Wing => ({
  base,
  mission: "standby",
  model,
  planes,
  region: UNASSIGNED,
});

/**
 * The air force with `planes` more of `model` at `base`: into the wings of
 * that design based there while they have room, and into new ones after
 * that.
 */
const reinforced = (
  airForce: AirForce,
  model: AirframeModel,
  planes: number,
  base: number
): AirForce => {
  let left = planes;
  const wings = airForce.wings.map((wing) => {
    if (wing.model !== model || wing.base !== base) {
      return wing;
    }
    const added = Math.min(left, WING_SIZE - wing.planes);
    left -= added;
    return { ...wing, planes: wing.planes + added };
  });
  while (left > 0) {
    const size = Math.min(left, WING_SIZE);
    wings.push(wingAt(model, size, base));
    left -= size;
  }
  return { ...airForce, wings };
};

/**
 * The air force after its factories have put `output` into the plane they
 * are building, the design `models` has for the kind it orders, finishing as
 * many as that pays for at `base` and carrying the rest into the next. A
 * nation with no air base to send them to builds nothing.
 */
export const planesBuiltOneDay = (
  airForce: AirForce,
  output: number,
  base: number,
  models: AirframeModels
): AirForce => {
  if (base === UNASSIGNED) {
    return airForce;
  }
  const model = models[airForce.order];
  const { cost } = airframeOf(model);
  const progress = airForce.progress + output;
  const finished = Math.floor(progress / cost);
  return reinforced(
    { ...airForce, progress: progress - finished * cost },
    model,
    finished,
    base
  );
};

/**
 * The planes of each kind a nation opens 1936 with for each military factory
 * it has. Hearts of Iron IV's nations open with their historical air forces,
 * so these are this game's own.
 */
const OPENING_PLANES_PER_FACTORY = {
  "close-support": 3,
  fighter: 6,
  "naval-bomber": 1,
  transport: 0,
} satisfies Readonly<Record<Aircraft, number>>;

/**
 * The air force a nation with `militaryFactories` opens the world with, all
 * of it the designs `models` has and at `base`: none where it has no air
 * base.
 */
export const openingAirForce = (
  militaryFactories: number,
  base: number,
  models: AirframeModels
): AirForce => {
  if (base === UNASSIGNED) {
    return NO_AIR_FORCE;
  }
  let airForce = NO_AIR_FORCE;
  for (const aircraft of AIRCRAFT) {
    airForce = reinforced(
      airForce,
      models[aircraft],
      militaryFactories * OPENING_PLANES_PER_FACTORY[aircraft],
      base
    );
  }
  return airForce;
};

/** What a government decides for its air force: the plane its factories build, or how many of them do. */
export type AirOrders = Pick<AirForce, "order"> | Pick<AirForce, "aviation">;

/**
 * The air force under `orders`. A change of plane carries the production
 * already put in over to the new one.
 */
export const airForceUnder = (
  airForce: AirForce,
  orders: AirOrders
): AirForce => ({ ...airForce, ...orders });

/** The wings flying a mission today, the ones waiting at their bases left out. */
export const flyingOf = (airForce: AirForce): readonly Wing[] =>
  airForce.wings.filter((wing) => wing.mission !== "standby");

/** How many planes of `aircraft` the air force has. */
export const planesOf = (airForce: AirForce, aircraft: Aircraft): number =>
  airForce.wings
    .filter((wing) => aircraftOf(wing) === aircraft)
    .reduce((total, wing) => total + wing.planes, 0);

/** How many planes the air force has that can fight, its unarmed transports left out. */
export const combatPlanesOf = (airForce: AirForce): number =>
  airForce.wings
    .filter((wing) => aircraftOf(wing) !== "transport")
    .reduce((total, wing) => total + wing.planes, 0);
