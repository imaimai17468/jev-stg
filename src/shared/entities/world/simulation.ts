import { armiesAfterOneDay } from "./army";
import type { Clock } from "./clock";
import { advancedOneDay as nextClock, START_CLOCK } from "./clock";
import type { Diplomacy } from "./diplomacy";
import { openingDiplomacy } from "./diplomacy";
import type { Division } from "./divisions";
import type { NationEconomy } from "./economy";
import { producedOneDay, startEconomies } from "./economy";
import type { World } from "./index";
import { initialOwners } from "./nations";
import { conductedOneDay, factionFounders } from "./statecraft";

/** Everything about a world that the calendar moves. */
export interface Simulation {
  readonly clock: Clock;
  /** One economy per nation, by nation id. */
  readonly economies: readonly NationEconomy[];
  /** Who holds each province now, by province id. */
  readonly owners: Int32Array;
  readonly diplomacy: Diplomacy;
  readonly divisions: readonly Division[];
}

/** The world on its first day, before any of it has run. */
export const startSimulation = (world: World): Simulation => {
  const owners = initialOwners(world.provinces, world.nations);
  const economies = startEconomies(world, owners);
  return {
    clock: START_CLOCK,
    diplomacy: openingDiplomacy(
      owners,
      world.nations.length,
      factionFounders(economies)
    ),
    divisions: [],
    economies,
    owners,
  };
};

/**
 * The whole simulation one day on: the economies, then the armies, then the
 * diplomacy, so a nation surrenders the day its homeland falls and a month's
 * declarations read the armies as that day left them.
 */
export const ranOneDay = (world: World, simulation: Simulation): Simulation => {
  const clock = nextClock(simulation.clock);
  const armies = armiesAfterOneDay(world, simulation.diplomacy.wars, {
    divisions: simulation.divisions,
    economies: simulation.economies.map(producedOneDay),
    owners: simulation.owners,
  });
  const after = conductedOneDay(world, clock, {
    armies,
    diplomacy: simulation.diplomacy,
  });
  return {
    clock,
    diplomacy: after.diplomacy,
    divisions: after.armies.divisions,
    economies: after.armies.economies,
    owners: after.armies.owners,
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
