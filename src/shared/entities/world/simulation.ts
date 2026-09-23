import type { Clock } from "./clock";
import { advancedOneDay as nextClock, START_CLOCK } from "./clock";
import type { NationEconomy } from "./economy";
import { producedOneDay, startEconomies } from "./economy";
import type { World } from "./index";

/** Everything about a world that the calendar moves. */
export interface Simulation {
  readonly clock: Clock;
  /** One economy per nation, by nation id. */
  readonly economies: readonly NationEconomy[];
}

/** The world on its first day, before any of it has run. */
export const startSimulation = (world: World): Simulation => ({
  clock: START_CLOCK,
  economies: startEconomies(world),
});

/** The whole simulation one day on. */
export const ranOneDay = (simulation: Simulation): Simulation => ({
  clock: nextClock(simulation.clock),
  economies: simulation.economies.map(producedOneDay),
});

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
