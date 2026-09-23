import type { Advancement } from "./advancement";
import {
  modifiersOf,
  progressedOneDay,
  START_ADVANCEMENT,
} from "./advancement";
import { openingAirBases } from "./air-bases";
import { supportOf } from "./air-cover";
import type { AirForce } from "./air-force";
import { NO_AIR_FORCE, openingAirForce } from "./air-force";
import { airWarOneDay } from "./air-war";
import {
  armisticesDue,
  noQuiet,
  quietOneDay,
  touchedBetween,
} from "./armistice";
import type { Quiet } from "./armistice";
import { armiesAfterOneDay } from "./army";
import type { Entry, Negotiation } from "./chronicle";
import { BY_RULES, chronicled } from "./chronicle";
import type { Clock } from "./clock";
import { dateOf, advancedOneDay as nextClock, START_CLOCK } from "./clock";
import { commerceOneDay } from "./commerce";
import type { Compliance } from "./compliance";
import { compliedOneDay, reachByNation, startCompliance } from "./compliance";
import type { Diplomacy } from "./diplomacy";
import { openingDiplomacy, standsAlone } from "./diplomacy";
import type { Division } from "./divisions";
import { fieldedBy } from "./divisions";
import type { NationEconomy } from "./economy";
import { burnt, NO_ECONOMY, startEconomies, upkept } from "./economy";
import { valueAt } from "./grid";
import type { World } from "./index";
import type { Invasion } from "./invasion";
import { itemAt } from "./lookup";
import { homeZonesOf, seafaredOneDay } from "./maritime";
import type { Modifiers } from "./modifiers";
import { musteringAt } from "./muster";
import { initialOwners, NO_NATION } from "./nations";
import type { Navy } from "./navy";
import { NO_NAVY, openingNavy } from "./navy";
import { graphOf } from "./provinces";
import { landmassesOf } from "./seas";
import type { Skies } from "./skies";
import { skiesBelow } from "./skies";
import { UNASSIGNED } from "./spread";
import type { Stance } from "./stance";
import { START_STANCE } from "./stance";
import type { Realm } from "./statecraft";
import { conductedOneDay, factionFounders } from "./statecraft";
import type { Lines, SupplyNetwork } from "./supply";
import { supplyNetwork } from "./supply";
import type { Deal } from "./trade";
import { peaceBetween } from "./wars";

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
  /** One navy per nation, by nation id. */
  readonly navies: readonly Navy[];
  /** The landings being prepared, their divisions aboard and out of the field. */
  readonly invasions: readonly Invasion[];
  /** The resources each nation bought from another today. */
  readonly deals: readonly Deal[];
  /** How long each pair of nations at war has gone without touching. */
  readonly quiet: Quiet;
  /** One air force per nation, by nation id. */
  readonly airForces: readonly AirForce[];
  /** The level of the air base in each province, by province id. */
  readonly airBases: Uint8Array;
  /** The air power each nation flew over each region today, by nation id and then region id. */
  readonly airPower: readonly Float32Array[];
  /** What the governments decided and the world carried out, the newest first. */
  readonly chronicle: readonly Entry[];
}

/** The world on its first day, before any of it has run. */
export const startSimulation = (world: World): Simulation => {
  const owners = initialOwners(world.provinces, world.nations);
  const economies = startEconomies(world, owners);
  const homes = homeZonesOf(world, owners);
  return {
    advancements: world.nations.map(() => START_ADVANCEMENT),
    airBases: openingAirBases(world),
    airForces: economies.map((economy, nation) =>
      openingAirForce(
        economy.militaryFactories,
        itemAt(world.nations, nation, NO_NATION).capital
      )
    ),
    airPower: world.nations.map(
      () => new Float32Array(world.airspace.regions.length)
    ),
    chronicle: [],
    clock: START_CLOCK,
    compliance: startCompliance(owners),
    deals: [],
    diplomacy: openingDiplomacy(
      owners,
      world.nations.length,
      factionFounders(economies)
    ),
    divisions: [],
    economies,
    invasions: [],
    navies: economies.map((economy, nation) =>
      openingNavy(economy.dockyards, itemAt(homes, nation, UNASSIGNED))
    ),
    negotiations: [],
    owners,
    quiet: noQuiet(world.nations.length),
    stances: world.nations.map(() => START_STANCE),
  };
};

/** The air power every nation flew today, and who is fighting whom under it. */
export const skiesOf = (simulation: Simulation): Skies => ({
  diplomacy: simulation.diplomacy,
  power: simulation.airPower,
});

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

/** Each nation's modifiers, by nation id. */
const modifiersOfAll = (simulation: Simulation): readonly Modifiers[] =>
  simulation.advancements.map((advancement, nation) =>
    modifiersOf(advancement, itemAt(simulation.economies, nation, NO_ECONOMY))
  );

/** Everything a supply network reads off `simulation`. */
const linesOf = (world: World, simulation: Simulation): Lines => ({
  diplomacy: simulation.diplomacy,
  divisions: simulation.divisions,
  graph: graphOf(world.provinces),
  modifiers: modifiersOfAll(simulation),
  owners: simulation.owners,
  shipped: simulation.navies.map((navy) => navy.overseas),
  upkeepMet: simulation.economies.map((economy) => economy.upkeepMet),
  world,
});

/**
 * What every nation's supply can do in the world `simulation` describes: its
 * ground, its alliances, where its divisions stand, what it has researched,
 * and how much of its upkeep its depots met.
 */
export const supplyOf = (world: World, simulation: Simulation): SupplyNetwork =>
  supplyNetwork(linesOf(world, simulation));

/** Each nation's entry of `items`, and `lost` for every nation annexed. */
const keptWhileStanding = <T>(
  items: readonly T[],
  diplomacy: Diplomacy,
  lost: T
): readonly T[] =>
  items.map((item, nation) => {
    if (standsAlone(diplomacy, nation)) {
      return item;
    }
    return lost;
  });

/**
 * The world once the nations annexed today have lost their navies and their
 * air forces with the rest of what they held, and every pair at war that has not touched in long
 * enough has signed a white peace.
 */
const settledAtSea = (
  world: World,
  simulation: Simulation,
  day: number
): Simulation => {
  const { diplomacy } = simulation;
  const quiet = quietOneDay(
    simulation.quiet,
    diplomacy.wars,
    touchedBetween(world, simulation.owners, simulation.divisions)
  );
  let { chronicle } = simulation;
  let { wars } = diplomacy;
  for (const pair of armisticesDue(quiet, world.nations.length)) {
    wars = peaceBetween(wars, pair);
    chronicle = chronicled(chronicle, {
      day,
      ruling: {
        decision: { kind: "white-peace", one: pair.one, other: pair.other },
        source: BY_RULES,
      },
    });
  }
  return {
    ...simulation,
    airForces: keptWhileStanding(simulation.airForces, diplomacy, NO_AIR_FORCE),
    chronicle,
    diplomacy: { ...diplomacy, wars },
    navies: keptWhileStanding(simulation.navies, diplomacy, NO_NAVY),
    quiet,
  };
};

/** The chronicle with every landing that went ashore today in it. */
const landingsChronicled = (
  chronicle: readonly Entry[],
  landings: readonly Invasion[],
  owners: Int32Array,
  day: number
): readonly Entry[] => {
  let entries = chronicle;
  for (const landing of landings) {
    entries = chronicled(entries, {
      day,
      ruling: {
        decision: {
          defender: valueAt(owners, landing.target),
          kind: "landing",
          nation: landing.nation,
          target: landing.target,
        },
        source: BY_RULES,
      },
    });
  }
  return entries;
};

/**
 * The whole simulation one day on: the market and the economies, drawing on
 * occupied ground as far as its compliance lets them, the dockyards and the
 * factories on planes; the upkeep the depots pay the army; then the air
 * wings, their battles and their strikes on the enemy's ships; then the fleets, the battles at sea, the
 * landings and the convoys; then the supply those convoys leave; then the
 * armies; then the research and the national focuses; then the diplomacy;
 * then the white peaces between nations that no longer touch; and last each
 * province's compliance with whoever holds it once all that is done. So a
 * nation surrenders the day its homeland falls, and a month's declarations
 * read the armies as that day left them. The economies and the armies work
 * with what the nation had researched when the day began, and the ships and
 * the divisions under the air superiority the day's air battles left.
 */
export const ranOneDay = (world: World, simulation: Simulation): Simulation => {
  const clock = nextClock(simulation.clock);
  const graph = graphOf(world.provinces);
  const modifiers = modifiersOfAll(simulation);
  const musters = world.nations.map((nation) =>
    musteringAt(world, simulation.owners, nation)
  );
  const homes = homeZonesOf(world, simulation.owners);
  const landmasses = landmassesOf(graph);
  const fielded = fieldedBy(
    [
      ...simulation.divisions,
      ...simulation.invasions.flatMap((invasion) => invasion.divisions),
    ],
    world.nations.length
  );
  const exchange = commerceOneDay({
    airBases: simulation.airBases,
    airForces: simulation.airForces,
    compliance: simulation.compliance,
    diplomacy: simulation.diplomacy,
    economies: simulation.economies,
    homes,
    landmasses,
    modifiers,
    musters,
    navies: simulation.navies,
    owners: simulation.owners,
    reach: reachByNation(
      world.provinces,
      simulation.owners,
      simulation.compliance,
      world.nations.length
    ),
    world,
  });
  const aloft = airWarOneDay(
    {
      airBases: simulation.airBases,
      airForces: exchange.airForces,
      economies: exchange.economies.map((economy, nation) =>
        upkept(economy, itemAt(fielded, nation, 0))
      ),
      navies: exchange.navies,
    },
    {
      diplomacy: simulation.diplomacy,
      flown: simulation.airPower,
      graph,
      homes,
      invasions: simulation.invasions,
      musters,
      owners: simulation.owners,
      world,
    }
  );
  const skies: Skies = {
    diplomacy: simulation.diplomacy,
    power: aloft.power,
  };
  const provinces = world.provinces.length;
  const below = skiesBelow(skies, world.airspace, provinces);
  const seafaring = seafaredOneDay(
    {
      divisions: simulation.divisions,
      invasions: simulation.invasions,
      navies: aloft.navies,
    },
    {
      day: clock.days,
      deals: exchange.deals,
      diplomacy: simulation.diplomacy,
      fuel: aloft.economies.map((economy) => economy.fuel),
      graph,
      homes,
      landmasses,
      lift: below.lift,
      lines: linesOf(world, simulation),
      musters,
      owners: simulation.owners,
      world,
    }
  );
  const economies = aloft.economies.map((economy, nation) =>
    burnt(economy, itemAt(seafaring.burned, nation, 0))
  );
  const afloat: Simulation = {
    ...simulation,
    airBases: aloft.airBases,
    airForces: aloft.airForces,
    airPower: aloft.power,
    deals: exchange.deals,
    divisions: seafaring.divisions,
    economies,
    invasions: seafaring.invasions,
    navies: seafaring.navies,
  };
  const armies = armiesAfterOneDay(
    world,
    {
      air: {
        enemy: below.enemy,
        support: supportOf(
          {
            airspace: world.airspace,
            divisions: afloat.divisions,
            owners: simulation.owners,
            wars: simulation.diplomacy.wars,
          },
          aloft.support,
          provinces
        ),
      },
      modifiers,
      stances: simulation.stances,
      supply: supplyOf(world, afloat),
      wars: simulation.diplomacy.wars,
    },
    { divisions: afloat.divisions, economies, owners: simulation.owners }
  );
  const advanced = advancedEverywhere(
    simulation.diplomacy,
    simulation.advancements,
    armies.economies,
    dateOf(clock).year
  );
  const conducted = fromRealm(
    conductedOneDay(world, clock, {
      ...realmOf(afloat),
      armies: { ...armies, economies: advanced.economies },
    })
  );
  const done = settledAtSea(
    world,
    {
      ...afloat,
      ...conducted,
      advancements: advanced.advancements,
      chronicle: landingsChronicled(
        conducted.chronicle,
        seafaring.landings,
        simulation.owners,
        clock.days
      ),
      clock,
    },
    clock.days
  );
  return {
    ...done,
    compliance: compliedOneDay(simulation.compliance, done.owners),
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
