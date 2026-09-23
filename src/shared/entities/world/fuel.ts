/** The fuel one unit of oil a day refines into, after Hearts of Iron IV. */
const FUEL_PER_OIL = 48;

/**
 * The fuel a nation can store, after Hearts of Iron IV's base capacity. Its
 * infrastructure and its fuel silos add to it there, and this world has
 * neither.
 */
export const FUEL_CAPACITY = 50_000;

/**
 * What a plane on a mission and a ship on the move burn a day, as multiples of
 * the fuel usage their design shows, after Hearts of Iron IV; a ship in a
 * battle burns twice that, and one holding its position or lying in port
 * burns none.
 */
export const PLANE_FUEL_PER_DAY = 8.4;
export const SHIP_FUEL_PER_DAY = 2.4;
export const COMBAT_FUEL_MULTIPLE = 2;

/** A stockpile of `fuel` with `oil` units of oil refined into it, never holding more than it can store. */
export const refined = (fuel: number, oil: number): number =>
  Math.min(FUEL_CAPACITY, fuel + Math.max(0, oil) * FUEL_PER_OIL);

/** The oil a nation buys a day to cover the `burned` fuel it burned yesterday. */
export const oilWanted = (burned: number): number => burned / FUEL_PER_OIL;

/** The share of `demand` a stockpile of `fuel` covers, from 0 to 1. */
export const fuelShareOf = (fuel: number, demand: number): number =>
  Math.min(1, (fuel + Number.MIN_VALUE) / (demand + Number.MIN_VALUE));

/**
 * The share of what they could do that planes, a ship's guns and a ship's
 * engines keep with `share` of the fuel they want, after Hearts of Iron IV's
 * 0.25 times the mission efficiency, half the attack and a quarter of the
 * speed with none at all.
 */
const PLANES_WITHOUT_FUEL = 0.25;
const GUNS_WITHOUT_FUEL = 0.5;
const ENGINES_WITHOUT_FUEL = 0.25;

const keptWith = (without: number, share: number): number =>
  without + (1 - without) * share;

export const planesKeptWith = (share: number): number =>
  keptWith(PLANES_WITHOUT_FUEL, share);

export const gunsKeptWith = (share: number): number =>
  keptWith(GUNS_WITHOUT_FUEL, share);

export const enginesKeptWith = (share: number): number =>
  keptWith(ENGINES_WITHOUT_FUEL, share);

/**
 * Whether a ship whose engines keep `share` of their speed makes way on day
 * `day`: on that share of the days, spread evenly over them.
 */
export const makesWayOn = (day: number, share: number): boolean =>
  Math.floor(day * share) > Math.floor((day - 1) * share);
