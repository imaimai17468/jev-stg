import { armiesAfterOneDay } from "./army";
import type { Entry, Negotiation } from "./chronicle";
import type { Clock } from "./clock";
import { advancedOneDay as nextClock, START_CLOCK } from "./clock";
import type { Diplomacy } from "./diplomacy";
import { openingDiplomacy } from "./diplomacy";
import type { Division } from "./divisions";
import type { NationEconomy } from "./economy";
import { producedOneDay, startEconomies } from "./economy";
import type { World } from "./index";
import { initialOwners } from "./nations";
import type { Stance } from "./stance";
import { START_STANCE } from "./stance";
import type { Realm } from "./statecraft";
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
  /** How boldly each nation's army attacks, by nation id. */
  readonly stances: readonly Stance[];
  /** Surrendered nations waiting to hear their terms. */
  readonly negotiations: readonly Negotiation[];
  /** What the governments decided and the world carried out, the newest first. */
  readonly chronicle: readonly Entry[];
}

/** The world on its first day, before any of it has run. */
export const startSimulation = (world: World): Simulation => {
  const owners = initialOwners(world.provinces, world.nations);
  const economies = startEconomies(world, owners);
  return {
    chronicle: [],
    clock: START_CLOCK,
    diplomacy: openingDiplomacy(
      owners,
      world.nations.length,
      factionFounders(economies)
    ),
    divisions: [],
    economies,
    negotiations: [],
    owners,
    stances: world.nations.map(() => START_STANCE),
  };
};

/** The parts of the simulation statecraft reads and writes. */
export const realmOf = (simulation: Simulation): Realm => ({
  armies: {
    divisions: simulation.divisions,
    economies: simulation.economies,
    owners: simulation.owners,
  },
  chronicle: simulation.chronicle,
  diplomacy: simulation.diplomacy,
  negotiations: simulation.negotiations,
});

/** The simulation fields a realm carries, ready to spread over a simulation. */
export const fromRealm = (realm: Realm) => ({
  chronicle: realm.chronicle,
  diplomacy: realm.diplomacy,
  divisions: realm.armies.divisions,
  economies: realm.armies.economies,
  negotiations: realm.negotiations,
  owners: realm.armies.owners,
});

/**
 * The whole simulation one day on: the economies, then the armies, then the
 * diplomacy, so a nation surrenders the day its homeland falls and a month's
 * declarations read the armies as that day left them.
 */
export const ranOneDay = (world: World, simulation: Simulation): Simulation => {
  const clock = nextClock(simulation.clock);
  const armies = armiesAfterOneDay(
    world,
    { stances: simulation.stances, wars: simulation.diplomacy.wars },
    {
      divisions: simulation.divisions,
      economies: simulation.economies.map(producedOneDay),
      owners: simulation.owners,
    }
  );
  return {
    ...simulation,
    ...fromRealm(
      conductedOneDay(world, clock, { ...realmOf(simulation), armies })
    ),
    clock,
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
