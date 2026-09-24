import { Schema } from "effect";
import type { Compliance } from "./compliance";
import { occupancyOf, reachUnder } from "./compliance";
import type { Terrain } from "./geography/terrain";
import type { World } from "./geography/world";
import { valueAt } from "./grid";
import { holderSums } from "./industry";
import { foldedWith, itemAt } from "./lookup";
import type { Modifiers } from "./modifiers";
import { NO_MODIFIERS } from "./modifiers";
import type { LandProvince, Province } from "./provinces";
import { landProvinces } from "./provinces";
import { randomFromSeed, streamSeed } from "./random";

/**
 * The resources the factories build with, which Hearts of Iron IV docks a
 * production line 5% of its output for each unit it goes without.
 */
const MaterialSchema = Schema.Literals([
  "steel",
  "tungsten",
  "chromium",
  "aluminium",
  "rubber",
]);

const MATERIALS = MaterialSchema.literals;

/**
 * Every resource this world digs: the materials, and the oil its refineries
 * turn into the fuel its aircraft and ships burn, which no factory builds
 * with.
 */
const ResourceSchema = Schema.Literals([...MATERIALS, "oil"]);

export type Resource = typeof ResourceSchema.Type;

export const RESOURCES = ResourceSchema.literals;

/** An amount of each resource, in units a day. */
export interface ResourceNeed {
  readonly steel: number;
  readonly tungsten: number;
  readonly chromium: number;
  readonly aluminium: number;
  readonly rubber: number;
  readonly oil: number;
}

export const NO_RESOURCES: ResourceNeed = {
  aluminium: 0,
  chromium: 0,
  oil: 0,
  rubber: 0,
  steel: 0,
  tungsten: 0,
};

/** Each resource of `one` added to the same resource of `other`. */
export const plus = (one: ResourceNeed, other: ResourceNeed): ResourceNeed => ({
  aluminium: one.aluminium + other.aluminium,
  chromium: one.chromium + other.chromium,
  oil: one.oil + other.oil,
  rubber: one.rubber + other.rubber,
  steel: one.steel + other.steel,
  tungsten: one.tungsten + other.tungsten,
});

/** Every one of `needs` added together, resource by resource. */
export const totalOf = (needs: readonly ResourceNeed[]): ResourceNeed =>
  foldedWith(needs, NO_RESOURCES, plus);

/** Each resource of `need` multiplied by `factor`. */
export const scaled = (need: ResourceNeed, factor: number): ResourceNeed => ({
  aluminium: need.aluminium * factor,
  chromium: need.chromium * factor,
  oil: need.oil * factor,
  rubber: need.rubber * factor,
  steel: need.steel * factor,
  tungsten: need.tungsten * factor,
});

/**
 * What one province of each terrain yields of each resource a day, on
 * average. The mountains and the hills hold the ore and the bauxite, the
 * forests the rubber, and the deserts and the tundra the oil; the open ground
 * holds a little iron and nothing rarer. Hearts of Iron IV gives no typical
 * size for a state's deposits, so these are this game's own, set so the world
 * digs about three times what the factories it opens with take, and not
 * enough for the ones a long war builds.
 */
const TERRAIN_DEPOSITS = {
  desert: {
    aluminium: 0.6,
    chromium: 0.8,
    oil: 2,
    rubber: 0,
    steel: 2,
    tungsten: 0.6,
  },
  forest: {
    aluminium: 0.2,
    chromium: 0,
    oil: 0.1,
    rubber: 1.5,
    steel: 3,
    tungsten: 0.3,
  },
  hills: {
    aluminium: 3,
    chromium: 0.2,
    oil: 0.2,
    rubber: 0,
    steel: 8,
    tungsten: 3,
  },
  mountains: {
    aluminium: 3.5,
    chromium: 1.2,
    oil: 0,
    rubber: 0,
    steel: 10,
    tungsten: 9,
  },
  plains: {
    aluminium: 0.2,
    chromium: 0,
    oil: 0.4,
    rubber: 0.3,
    steel: 2,
    tungsten: 0,
  },
  tundra: {
    aluminium: 1,
    chromium: 0.8,
    oil: 1.2,
    rubber: 0,
    steel: 4,
    tungsten: 1,
  },
} satisfies Readonly<Record<Terrain, ResourceNeed>>;

/** The stream of draws the deposits come from, apart from the world's own. */
const DEPOSIT_STREAM = 7;

/**
 * How far one province's deposit strays from its terrain's average: a draw
 * between none and twice the average.
 */
const DEPOSIT_SPREAD = 2;

/** The stream the oil, the bauxite and the rubber are drawn from, apart from the ore's. */
const FUEL_AND_ALLOY_STREAM = 13;

/** The draws one province's deposits are taken from. */
interface Draws {
  /** The ore, from the stream it has always come from. */
  readonly ore: () => number;
  /** The oil, the bauxite and the rubber, from a stream of their own. */
  readonly rest: () => number;
}

/**
 * One province's deposits, drawn around its terrain's average. The ore comes
 * from its own stream, three draws a province as before the oil, the bauxite
 * and the rubber came into the world, so every seed lays its ore where it
 * always did.
 */
const depositOf = (province: LandProvince, draws: Draws): ResourceNeed => {
  const average = TERRAIN_DEPOSITS[province.terrain];
  const around = (resource: Resource, draw: () => number) =>
    Math.round(average[resource] * DEPOSIT_SPREAD * draw());
  const chromium = around("chromium", draws.ore);
  const steel = around("steel", draws.ore);
  const tungsten = around("tungsten", draws.ore);
  const aluminium = around("aluminium", draws.rest);
  const rubber = around("rubber", draws.rest);
  const oil = around("oil", draws.rest);
  return { aluminium, chromium, oil, rubber, steel, tungsten };
};

/**
 * What each province yields a day, by province id, and none at sea. The draws
 * come from streams of their own, so the ground and the borders the world's
 * seed drew stay where they were.
 */
export const depositsOf = (
  provinces: readonly Province[],
  seed: number
): readonly ResourceNeed[] => {
  const draws: Draws = {
    ore: randomFromSeed(streamSeed(seed, DEPOSIT_STREAM)).unit,
    rest: randomFromSeed(streamSeed(seed, FUEL_AND_ALLOY_STREAM)).unit,
  };
  const deposits = provinces.map(() => NO_RESOURCES);
  for (const province of landProvinces(provinces)) {
    deposits[province.id] = depositOf(province, draws);
  }
  return deposits;
};

/**
 * What each nation digs out a day, by nation id: every province it holds, an
 * occupied one only as far as its compliance lets it work the mines, and all
 * of it raised by the extraction its `modifiers` add.
 */
export const extractedBy = (
  world: World,
  owners: Int32Array,
  compliance: Compliance,
  modifiers: readonly Modifiers[]
): readonly ResourceNeed[] => {
  const summed = holderSums(world.provinces, owners, world.nations.length);
  const dug = (resource: Resource) =>
    summed(
      (province, holder) =>
        itemAt(world.deposits, province.id, NO_RESOURCES)[resource] *
        reachUnder(occupancyOf(compliance, holder, province.id)).factories
    );
  const aluminium = dug("aluminium");
  const chromium = dug("chromium");
  const oil = dug("oil");
  const rubber = dug("rubber");
  const steel = dug("steel");
  const tungsten = dug("tungsten");
  return world.nations.map((nation) =>
    scaled(
      {
        aluminium: valueAt(aluminium, nation.id),
        chromium: valueAt(chromium, nation.id),
        oil: valueAt(oil, nation.id),
        rubber: valueAt(rubber, nation.id),
        steel: valueAt(steel, nation.id),
        tungsten: valueAt(tungsten, nation.id),
      },
      1 + itemAt(modifiers, nation.id, NO_MODIFIERS).extraction
    )
  );
};

/**
 * What one military factory takes a day: the two steel of Hearts of Iron IV's
 * first infantry equipment, and half the tungsten of its first artillery,
 * since about half the lines turn out guns.
 */
export const MILITARY_FACTORY_NEED: ResourceNeed = {
  ...NO_RESOURCES,
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
 * units a day short: each missing unit of a material takes 5% off one line of
 * factories, and nothing is left once every line has lost everything. Oil
 * goes to the refineries rather than the lines, so going without it costs the
 * factories nothing.
 */
export const outputShareWhenShort = (
  factories: number,
  missing: ResourceNeed
): number => {
  let units = 0;
  for (const resource of MATERIALS) {
    units += Math.max(0, missing[resource]);
  }
  const lost = units * PENALTY_PER_UNIT * FACTORIES_PER_LINE;
  return Math.max(0, 1 - lost / Math.max(1, factories));
};

/** `need` split into what the lines on planes build with and what every other line does. */
export interface SplitNeed {
  readonly aircraft: ResourceNeed;
  readonly arms: ResourceNeed;
}

/**
 * `need` split by the lines that build with it: aluminium and rubber, which
 * only the planes take here, and the rest. Hearts of Iron IV takes a missing
 * resource off the lines that use it, so a shortage of one side's materials
 * leaves the other side's lines working.
 */
export const splitByLine = (need: ResourceNeed): SplitNeed => ({
  aircraft: {
    ...NO_RESOURCES,
    aluminium: need.aluminium,
    rubber: need.rubber,
  },
  arms: { ...need, aluminium: 0, rubber: 0 },
});

/** How far `held` falls short of `need`, resource by resource. */
export const shortfall = (
  need: ResourceNeed,
  held: ResourceNeed
): ResourceNeed => ({
  aluminium: Math.max(0, need.aluminium - held.aluminium),
  chromium: Math.max(0, need.chromium - held.chromium),
  oil: Math.max(0, need.oil - held.oil),
  rubber: Math.max(0, need.rubber - held.rubber),
  steel: Math.max(0, need.steel - held.steel),
  tungsten: Math.max(0, need.tungsten - held.tungsten),
});
