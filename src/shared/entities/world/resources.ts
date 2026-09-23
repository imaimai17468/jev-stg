import { Schema } from "effect";
import type { Compliance } from "./compliance";
import { occupancyOf, reachUnder } from "./compliance";
import { valueAt } from "./grid";
import type { World } from "./index";
import { holderSums } from "./industry";
import { foldedWith, itemAt } from "./lookup";
import type { LandProvince, Province } from "./provinces";
import { landProvinces } from "./provinces";
import { randomFromSeed, streamSeed } from "./random";
import type { Terrain } from "./terrain";

/**
 * The resources the factories of this world draw on. Hearts of Iron IV also
 * has oil, aluminium and rubber, which its aircraft and motor pools burn, and
 * those arrive with the air forces.
 */
const ResourceSchema = Schema.Literals(["steel", "tungsten", "chromium"]);

export type Resource = typeof ResourceSchema.Type;

export const RESOURCES = ResourceSchema.literals;

/** An amount of each resource, in units a day. */
export interface ResourceNeed {
  readonly steel: number;
  readonly tungsten: number;
  readonly chromium: number;
}

export const NO_RESOURCES: ResourceNeed = {
  chromium: 0,
  steel: 0,
  tungsten: 0,
};

/** Each resource of `one` added to the same resource of `other`. */
export const plus = (one: ResourceNeed, other: ResourceNeed): ResourceNeed => ({
  chromium: one.chromium + other.chromium,
  steel: one.steel + other.steel,
  tungsten: one.tungsten + other.tungsten,
});

/** Every one of `needs` added together, resource by resource. */
export const totalOf = (needs: readonly ResourceNeed[]): ResourceNeed =>
  foldedWith(needs, NO_RESOURCES, plus);

/** Each resource of `need` multiplied by `factor`. */
export const scaled = (need: ResourceNeed, factor: number): ResourceNeed => ({
  chromium: need.chromium * factor,
  steel: need.steel * factor,
  tungsten: need.tungsten * factor,
});

/**
 * What one province of each terrain yields of each resource a day, on
 * average. The mountains and the hills hold the ore; the open ground holds a
 * little iron and nothing rarer. Hearts of Iron IV gives no typical size for a
 * state's deposits, so these are this game's own, set so the world digs
 * about three times what the factories it opens with take, and not enough
 * for the ones a long war builds.
 */
const TERRAIN_DEPOSITS = {
  desert: { chromium: 0.8, steel: 2, tungsten: 0.6 },
  forest: { chromium: 0, steel: 3, tungsten: 0.3 },
  hills: { chromium: 0.2, steel: 8, tungsten: 3 },
  mountains: { chromium: 1.2, steel: 10, tungsten: 9 },
  plains: { chromium: 0, steel: 2, tungsten: 0 },
  tundra: { chromium: 0.8, steel: 4, tungsten: 1 },
} satisfies Readonly<Record<Terrain, ResourceNeed>>;

/** The stream of draws the deposits come from, apart from the world's own. */
const DEPOSIT_STREAM = 7;

/**
 * How far one province's deposit strays from its terrain's average: a draw
 * between none and twice the average.
 */
const DEPOSIT_SPREAD = 2;

/** One province's deposits, drawn around its terrain's average. */
const depositOf = (
  province: LandProvince,
  draw: () => number
): ResourceNeed => {
  const average = TERRAIN_DEPOSITS[province.terrain];
  return {
    chromium: Math.round(average.chromium * DEPOSIT_SPREAD * draw()),
    steel: Math.round(average.steel * DEPOSIT_SPREAD * draw()),
    tungsten: Math.round(average.tungsten * DEPOSIT_SPREAD * draw()),
  };
};

/**
 * What each province yields a day, by province id, and none at sea. The draws
 * come from a stream of their own, so the ground and the borders the world's
 * seed drew stay where they were.
 */
export const depositsOf = (
  provinces: readonly Province[],
  seed: number
): readonly ResourceNeed[] => {
  const random = randomFromSeed(streamSeed(seed, DEPOSIT_STREAM));
  const deposits = provinces.map(() => NO_RESOURCES);
  for (const province of landProvinces(provinces)) {
    deposits[province.id] = depositOf(province, random.unit);
  }
  return deposits;
};

/**
 * What each nation digs out a day, by nation id: every province it holds, an
 * occupied one only as far as its compliance lets it work the mines.
 */
export const extractedBy = (
  world: World,
  owners: Int32Array,
  compliance: Compliance
): readonly ResourceNeed[] => {
  const summed = holderSums(world.provinces, owners, world.nations.length);
  const dug = (resource: Resource) =>
    summed(
      (province, holder) =>
        itemAt(world.deposits, province.id, NO_RESOURCES)[resource] *
        reachUnder(occupancyOf(compliance, holder, province.id)).factories
    );
  const steel = dug("steel");
  const tungsten = dug("tungsten");
  const chromium = dug("chromium");
  return world.nations.map((nation) => ({
    chromium: valueAt(chromium, nation.id),
    steel: valueAt(steel, nation.id),
    tungsten: valueAt(tungsten, nation.id),
  }));
};

/**
 * What one military factory takes a day: the two steel of Hearts of Iron IV's
 * first infantry equipment, and half the tungsten of its first artillery,
 * since about half the lines turn out guns.
 */
export const MILITARY_FACTORY_NEED: ResourceNeed = {
  chromium: 0,
  steel: 2,
  tungsten: 0.5,
};

/**
 * The factories one production line holds, which is what Hearts of Iron IV's
 * 5% a missing unit is taken from. The wiki gives the penalty per line, and
 * the lines of this world are not modelled one by one.
 */
const FACTORIES_PER_LINE = 10;

/** The share of a line's output each unit it goes without takes away. */
const PENALTY_PER_UNIT = 0.05;

/**
 * The share of its output a group of `factories` keeps when it goes `missing`
 * units a day short: each missing unit takes 5% off one line of factories,
 * and nothing is left once every line has lost everything.
 */
export const outputShareWhenShort = (
  factories: number,
  missing: ResourceNeed
): number => {
  let units = 0;
  for (const resource of RESOURCES) {
    units += Math.max(0, missing[resource]);
  }
  const lost = units * PENALTY_PER_UNIT * FACTORIES_PER_LINE;
  return Math.max(0, 1 - lost / Math.max(1, factories));
};

/** How far `held` falls short of `need`, resource by resource. */
export const shortfall = (
  need: ResourceNeed,
  held: ResourceNeed
): ResourceNeed => ({
  chromium: Math.max(0, need.chromium - held.chromium),
  steel: Math.max(0, need.steel - held.steel),
  tungsten: Math.max(0, need.tungsten - held.tungsten),
});
