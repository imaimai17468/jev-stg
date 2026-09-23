import type { Advancement } from "./advancement";
import {
  modifiersOf,
  progressedOneDay,
  START_ADVANCEMENT,
} from "./advancement";
import { armiesAfterOneDay } from "./army";
import type { Entry, Negotiation } from "./chronicle";
import type { Clock } from "./clock";
import { dateOf, advancedOneDay as nextClock, START_CLOCK } from "./clock";
import type { Compliance } from "./compliance";
import {
  compliedOneDay,
  FULL_REACH,
  reachByNation,
  startCompliance,
} from "./compliance";
import type { Diplomacy } from "./diplomacy";
import { openingDiplomacy, standsAlone } from "./diplomacy";
import type { Division } from "./divisions";
import { fieldedBy } from "./divisions";
import type { NationEconomy } from "./economy";
import { producedOneDay, startEconomies, upkept } from "./economy";
import type { World } from "./index";
import { itemAt } from "./lookup";
import { NO_MODIFIERS } from "./modifiers";
import { initialOwners } from "./nations";
import { graphOf } from "./provinces";
import type { Stance } from "./stance";
import { START_STANCE } from "./stance";
import type { Realm } from "./statecraft";
import { conductedOneDay, factionFounders } from "./statecraft";
import type { SupplyNetwork } from "./supply";
import { supplyNetwork } from "./supply";

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
  /** How far the people of each province go along with whoever holds it. */
  readonly compliance: Compliance;
  /** What each nation has researched and how far along its focus tree it is, by nation id. */
  readonly advancements: readonly Advancement[];
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
    advancements: world.nations.map(() => START_ADVANCEMENT),
    chronicle: [],
    clock: START_CLOCK,
    compliance: startCompliance(owners),
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

/** Every nation's research and focus one day on, and the economies they handed something to. */
interface Advanced {
  readonly advancements: readonly Advancement[];
  readonly economies: readonly NationEconomy[];
}

/**
 * An annexed nation's tree stops where it stood, so a focus it had under way
 * hands nothing to a nation that no longer holds any ground.
 */
const advancedEverywhere = (
  diplomacy: Diplomacy,
  advancements: readonly Advancement[],
  economies: readonly NationEconomy[],
  year: number
): Advanced => {
  const days = economies.map((economy, nation) => {
    const advancement = itemAt(advancements, nation, START_ADVANCEMENT);
    if (!standsAlone(diplomacy, nation)) {
      return { advancement, economy };
    }
    return progressedOneDay(advancement, economy, year);
  });
  return {
    advancements: days.map((day) => day.advancement),
    economies: days.map((day) => day.economy),
  };
};

/**
 * What every nation's supply can do in the world `simulation` describes: its
 * ground, its alliances, where its divisions stand, what it has researched,
 * and how much of its upkeep its depots met.
 */
export const supplyOf = (world: World, simulation: Simulation): SupplyNetwork =>
  supplyNetwork({
    diplomacy: simulation.diplomacy,
    divisions: simulation.divisions,
    graph: graphOf(world.provinces),
    modifiers: simulation.advancements.map(modifiersOf),
    owners: simulation.owners,
    upkeepMet: simulation.economies.map((economy) => economy.upkeepMet),
    world,
  });

/**
 * The whole simulation one day on: the economies, drawing on occupied ground
 * as far as its compliance lets them, and the upkeep the depots pay the army;
 * then the supply that upkeep leaves; then the armies; then the research and
 * the national focuses; then the diplomacy; and last each province's
 * compliance with whoever holds it once all that is done. So a nation
 * surrenders the day its homeland falls, and a month's declarations read the
 * armies as that day left them. The economies and the armies work with what
 * the nation had researched when the day began.
 */
export const ranOneDay = (world: World, simulation: Simulation): Simulation => {
  const clock = nextClock(simulation.clock);
  const modifiers = simulation.advancements.map(modifiersOf);
  const fielded = fieldedBy(simulation.divisions, world.nations.length);
  const reach = reachByNation(
    world.provinces,
    simulation.owners,
    simulation.compliance,
    world.nations.length
  );
  const economies = simulation.economies.map((economy, nation) =>
    upkept(
      producedOneDay(economy, {
        modifiers: itemAt(modifiers, nation, NO_MODIFIERS),
        reach: itemAt(reach, nation, FULL_REACH),
      }),
      itemAt(fielded, nation, 0)
    )
  );
  const armies = armiesAfterOneDay(
    world,
    {
      modifiers,
      stances: simulation.stances,
      supply: supplyOf(world, { ...simulation, economies }),
      wars: simulation.diplomacy.wars,
    },
    { divisions: simulation.divisions, economies, owners: simulation.owners }
  );
  const advanced = advancedEverywhere(
    simulation.diplomacy,
    simulation.advancements,
    armies.economies,
    dateOf(clock).year
  );
  const conducted = fromRealm(
    conductedOneDay(world, clock, {
      ...realmOf(simulation),
      armies: { ...armies, economies: advanced.economies },
    })
  );
  return {
    ...simulation,
    ...conducted,
    advancements: advanced.advancements,
    clock,
    compliance: compliedOneDay(simulation.compliance, conducted.owners),
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
