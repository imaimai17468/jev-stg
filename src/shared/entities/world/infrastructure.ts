import { valueAt } from "./grid";
import { landProvinces } from "./provinces";
import type { Terrain } from "./terrain";
import type { World } from "./world";

/** The most levels a province's infrastructure is built to, after Hearts of Iron IV. */
export const MOST_INFRASTRUCTURE = 5;

/** What one level of infrastructure costs, in construction, after Hearts of Iron IV. */
export const INFRASTRUCTURE_COST = 6000;

/** The level at which a province lets through all the supply reaching it, which plains open with. */
export const FULL_SUPPLY_LEVEL = 3;

/**
 * The infrastructure each terrain opens 1936 with. Hearts of Iron IV's states
 * open with their historical roads and railways, so these are this game's own:
 * the ground that carries a city carries the roads to it.
 */
const OPENING_BY_TERRAIN = {
  desert: 1,
  forest: 2,
  hills: 2,
  mountains: 1,
  plains: FULL_SUPPLY_LEVEL,
  tundra: 1,
} satisfies Readonly<Record<Terrain, number>>;

/** The level of the infrastructure in each province, by province id, as the world opens. */
export const openingInfrastructure = (world: World): Uint8Array => {
  const levels = new Uint8Array(world.provinces.length);
  for (const province of landProvinces(world.provinces)) {
    levels[province.id] = OPENING_BY_TERRAIN[province.terrain];
  }
  for (const nation of world.nations) {
    levels[nation.capital] = MOST_INFRASTRUCTURE;
  }
  return levels;
};

/** What each level of infrastructure above `FULL_SUPPLY_LEVEL` adds to the supply, and each level below it takes off. */
const SUPPLY_PER_LEVEL = 0.1;

/**
 * The share of the supply reaching a province that its infrastructure at
 * `level` lets through: 0.7 with none, all of it at `FULL_SUPPLY_LEVEL`, and
 * 1.2 at level 5.
 */
export const infrastructureSupply = (level: number): number =>
  1 + SUPPLY_PER_LEVEL * (level - FULL_SUPPLY_LEVEL);

/** The mean level of the infrastructure over the provinces `nation` holds, or zero where it holds none. */
export const meanInfrastructureOf = (
  levels: Uint8Array,
  owners: Int32Array,
  nation: number
): number => {
  let held = 0;
  let total = 0;
  for (const [province, owner] of owners.entries()) {
    if (owner !== nation) {
      continue;
    }
    held += 1;
    total += valueAt(levels, province);
  }
  return total / Math.max(1, held);
};

/** What each level of infrastructure adds to the speed of building in its province, after Hearts of Iron IV. */
const CONSTRUCTION_SPEED_PER_LEVEL = 0.2;

/**
 * How much faster than on bare ground anything is built in a province whose
 * infrastructure stands at `level`: twice as fast at level 5.
 */
export const constructionSpeedAt = (level: number): number =>
  1 + CONSTRUCTION_SPEED_PER_LEVEL * level;
