import { armiesAfterOneDay } from "./army";
import type { Clock } from "./clock";
import { advancedOneDay as nextClock, START_CLOCK } from "./clock";
import type { Division } from "./divisions";
import type { NationEconomy } from "./economy";
import { producedOneDay, startEconomies } from "./economy";
import type { World } from "./index";
import { initialOwners } from "./nations";
import { randomFromSeed } from "./random";
import type { Wars } from "./wars";
import { startWars } from "./wars";

/** Everything about a world that the calendar moves. */
export interface Simulation {
  readonly clock: Clock;
  /** One economy per nation, by nation id. */
  readonly economies: readonly NationEconomy[];
  /** Who holds each province now, by province id. */
  readonly owners: Int32Array;
  readonly wars: Wars;
  readonly divisions: readonly Division[];
}

/**
 * How far the war draw sits from the seed that drew the map, so the wars come
 * from a stream of their own rather than one opened at the map's seed.
 */
const WAR_SEED_OFFSET = 104_729;

/** The world on its first day, before any of it has run. */
export const startSimulation = (world: World): Simulation => {
  const owners = initialOwners(world.provinces, world.nations);
  return {
    clock: START_CLOCK,
    divisions: [],
    economies: startEconomies(world, owners),
    owners,
    wars: startWars(
      world,
      owners,
      randomFromSeed(world.seed + WAR_SEED_OFFSET)
    ),
  };
};

/** The whole simulation one day on: the economies, then the armies. */
export const ranOneDay = (world: World, simulation: Simulation): Simulation => {
  const armies = armiesAfterOneDay(world, simulation.wars, {
    divisions: simulation.divisions,
    economies: simulation.economies.map(producedOneDay),
    owners: simulation.owners,
  });
  return {
    ...simulation,
    clock: nextClock(simulation.clock),
    divisions: armies.divisions,
    economies: armies.economies,
    owners: armies.owners,
  };
};

/**
 * The simulation reading `clock`.
 *
 * Pausing and choosing a speed change the calendar alone, and they go through
 * here so the rest of the simulation stays the one object the day step folds.
 */
export const withClock = (
  simulation: Simulation,
  clock: Clock
): Simulation => ({
  ...simulation,
  clock,
});
