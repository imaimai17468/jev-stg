import type { Advancement } from "./advancement";
import {
  modifiersOf,
  openingAdvancementOf,
  progressedOneDay,
  START_ADVANCEMENT,
} from "./advancement";
import { factoriesTiedUp } from "./agency";
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
import type { Armoury } from "./armoury";
import { armouryOf, OPENING_ARMOURY } from "./armoury";
import { armiesAfterOneDay } from "./army";
import { daysFromCivil } from "./calendar";
import type { Decision, Entry, Negotiation } from "./chronicle";
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
import type { Service } from "./espionage";
import {
  heldCaptives,
  openingServices,
  plottedOneDay,
  serviceFor,
} from "./espionage";
import { valueAt } from "./grid";
import type { World } from "./index";
import { openingInfrastructure } from "./infrastructure";
import type { Espial } from "./insight";
import { insightOf, intelOf } from "./insight";
import type { Gleaned } from "./intel";
import {
  clashesOf,
  extractedOneDay,
  foughtOneDay as gleanedFromFighting,
  noGleaned,
} from "./intel";
import type { Invasion } from "./invasion";
import { itemAt } from "./lookup";
import { homeZonesOf, seafaredOneDay } from "./maritime";
import type { Modifiers } from "./modifiers";
import { musteredBy, musteringAt } from "./muster";
import { initialOwners, NO_NATION } from "./nations";
import type { Navy } from "./navy";
import { NO_NAVY, openingNavy } from "./navy";
import type { Networks } from "./networks";
import { noNetworks } from "./networks";
import { groundOf, openingLevyIn } from "./opening-army";
import type { Plants } from "./plants";
import { countedFrom, openingPlants, placedGains } from "./plants";
import type { ProvinceGraph } from "./provinces";
import { graphOf } from "./provinces";
import { randomFromSeed, streamSeed } from "./random";
import { roadsBuiltOneDay } from "./roadworks";
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
import type { Stirred, Unrest } from "./unrest";
import { stirredBy } from "./unrest";
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
  /** The level of the infrastructure in each province, by province id. */
  readonly infrastructure: Uint8Array;
  /**
   * The factories and the dockyards standing in each province, which each
   * nation's economy counts at the end of every day over the ground it holds.
   */
  readonly plants: Plants;
  /** The building slots focuses have added to each province, by province id. */
  readonly grantedSlots: Uint8Array;
  /** The air power each nation flew over each region today, by nation id and then region id. */
  readonly airPower: readonly Float32Array[];
  /** One intelligence service per nation, by nation id. */
  readonly services: readonly Service[];
  /** How strong each nation's intelligence network is in each province, by nation id and then province id. */
  readonly networks: Networks;
  /** The intelligence fighting and captured operatives have given. */
  readonly gleaned: Gleaned;
  /** The resistance work every nation's operatives have running. */
  readonly unrest: readonly Unrest[];
  /** What the governments decided and the world carried out, the newest first. */
  readonly chronicle: readonly Entry[];
}

/** The world on its first day, before any of it has run. */
export const startSimulation = (world: World): Simulation => {
  const owners = initialOwners(world.provinces, world.nations);
  const opening = startEconomies(world, owners);
  const armies = musteredBy(
    world,
    owners,
    opening,
    openingLevyIn(groundOf(world, owners, opening))
  );
  const { economies } = armies;
  const homes = homeZonesOf(world, owners);
  const advancements = world.nations.map((nation) =>
    openingAdvancementOf(nation.leaning)
  );
  const armouries = advancements.map((advancement) =>
    armouryOf(advancement.research)
  );
  return {
    advancements,
    airBases: openingAirBases(world),
    airForces: economies.map((economy, nation) =>
      openingAirForce(
        economy.militaryFactories,
        itemAt(world.nations, nation, NO_NATION).capital,
        itemAt(armouries, nation, OPENING_ARMOURY).planes
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
    divisions: armies.divisions,
    economies,
    gleaned: noGleaned(world.nations.length),
    grantedSlots: new Uint8Array(world.provinces.length),
    infrastructure: openingInfrastructure(world),
    invasions: [],
    navies: economies.map((economy, nation) =>
      openingNavy(
        economy.dockyards,
        itemAt(homes, nation, UNASSIGNED),
        itemAt(armouries, nation, OPENING_ARMOURY).ships
      )
    ),
    negotiations: [],
    networks: noNetworks(world.nations.length, world.provinces.length),
    owners,
    plants: openingPlants({ owners, world }, economies),
    quiet: noQuiet(world.nations.length),
    services: openingServices(world.nations.length),
    stances: world.nations.map(() => START_STANCE),
    unrest: [],
  };
};

/** What the resistance work every nation's operatives have running does to each province in `simulation`. */
export const stirredIn = (simulation: Simulation): Stirred =>
  stirredBy(
    simulation.unrest,
    simulation.networks,
    simulation.owners,
    simulation.compliance
  );

/** What every nation's intelligence on the others is read from in `simulation`. */
export const espialOf = (
  simulation: Simulation,
  graph: ProvinceGraph
): Espial => ({
  diplomacy: simulation.diplomacy,
  economies: simulation.economies,
  gleaned: simulation.gleaned,
  graph,
  networks: simulation.networks,
  owners: simulation.owners,
  services: simulation.services,
  unrest: simulation.unrest,
});

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
  today: number
): Advanced => {
  const days = economies.map((economy, nation) => {
    const advancement = itemAt(advancements, nation, START_ADVANCEMENT);
    if (!standsAlone(diplomacy, nation)) {
      return { advancement, economy };
    }
    return progressedOneDay(advancement, economy, today);
  });
  return {
    advancements: days.map((day) => day.advancement),
    economies: days.map((day) => day.economy),
  };
};

/** Each nation's modifiers, by nation id. */
export const modifiersOfAll = (simulation: Simulation): readonly Modifiers[] =>
  simulation.advancements.map((advancement, nation) =>
    modifiersOf(advancement, itemAt(simulation.economies, nation, NO_ECONOMY))
  );

/** What each nation's research arms it with, by nation id. */
export const armouriesOf = (simulation: Simulation): readonly Armoury[] =>
  simulation.advancements.map((advancement) => armouryOf(advancement.research));

/** Everything a supply network reads off `simulation`. */
const linesOf = (world: World, simulation: Simulation): Lines => ({
  diplomacy: simulation.diplomacy,
  divisions: simulation.divisions,
  graph: graphOf(world.provinces),
  infrastructure: simulation.infrastructure,
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
 * The intelligence work once the nations annexed today are gone from it: their
 * services start over, their networks and their resistance work end with
 * them, and the operatives they held captive are nobody's any more, so the
 * nations that lost them stop counting them as caught. Those operatives stay
 * lost, since they were taken off their service when they were caught.
 */
const intrigueSettled = (
  world: World,
  simulation: Simulation,
  diplomacy: Diplomacy
): Pick<Simulation, "services" | "networks" | "unrest"> => ({
  networks: keptWhileStanding(
    simulation.networks,
    diplomacy,
    new Float32Array(world.provinces.length)
  ),
  services: keptWhileStanding(
    simulation.services,
    diplomacy,
    serviceFor(world.nations.length)
  ).map((service) => ({
    ...service,
    captured: service.captured.filter((captor) =>
      standsAlone(diplomacy, captor)
    ),
  })),
  unrest: simulation.unrest.filter((work) => standsAlone(diplomacy, work.spy)),
});

/**
 * The world once the nations annexed today have lost their navies, their
 * air forces and their intelligence services with the rest of what they held, and every pair at war that has not touched in long
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
    ...intrigueSettled(world, simulation, diplomacy),
  };
};

/**
 * The streams the day's intelligence work and the day's interrogations draw
 * from, apart from each other and from the council's.
 */
const ESPIONAGE_STREAM = 17;
const EXTRACTION_STREAM = 19;

/** The chronicle with what the day's intelligence work did in it. */
const eventsChronicled = (
  chronicle: readonly Entry[],
  events: readonly Decision[],
  day: number
): readonly Entry[] => {
  let entries = chronicle;
  for (const decision of events) {
    entries = chronicled(entries, {
      day,
      ruling: { decision, source: BY_RULES },
    });
  }
  return entries;
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
 * landings and the convoys; then the supply those convoys leave, and the
 * infrastructure each nation builds where its divisions go shortest of supply;
 * then the armies; then the research and the national focuses; then the diplomacy,
 * and each nation's factories and dockyards counted again over the ground it
 * then holds; then the agencies, the operatives and the codebreakers, and what the day's
 * fighting and the captured operatives told each nation; then the white
 * peaces between nations that no longer touch; and last each province's
 * compliance with whoever holds it once all that is done. A factory finished or handed over by a focus is put in a province the moment
 * it comes, so a province taken that day takes it along. So a nation
 * surrenders the day its homeland falls, and a month's declarations read the
 * armies as that day left them. The economies and the armies work with what
 * the nation had researched and what it knew of its enemies when the day
 * began, the ships and the divisions under the air superiority the day's air
 * battles left, and the occupied ground under the resistance and the sabotage
 * the operatives had stirred by then.
 */
export const ranOneDay = (world: World, simulation: Simulation): Simulation => {
  const clock = nextClock(simulation.clock);
  const graph = graphOf(world.provinces);
  const modifiers = modifiersOfAll(simulation);
  const armouries = armouriesOf(simulation);
  const intel = intelOf(espialOf(simulation, graph));
  const stirred = stirredIn(simulation);
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
    armouries,
    compliance: simulation.compliance,
    diplomacy: simulation.diplomacy,
    economies: simulation.economies,
    grantedSlots: simulation.grantedSlots,
    homes,
    infrastructure: simulation.infrastructure,
    landmasses,
    modifiers,
    musters,
    navies: simulation.navies,
    owners: simulation.owners,
    plants: simulation.plants,
    reach: reachByNation(
      world.provinces,
      simulation.owners,
      simulation.compliance,
      {
        nations: world.nations.length,
        plants: simulation.plants,
        sabotage: stirred.sabotage,
      }
    ),
    tiedUp: simulation.services.map((service) =>
      factoriesTiedUp(service.agency)
    ),
    world,
  });
  const built = placedGains(
    {
      grantedSlots: simulation.grantedSlots,
      infrastructure: simulation.infrastructure,
      modifiers,
      owners: simulation.owners,
      plants: simulation.plants,
      world,
    },
    "built",
    { after: exchange.economies, before: simulation.economies }
  );
  const aloft = airWarOneDay(
    {
      airBases: simulation.airBases,
      airForces: exchange.airForces,
      armouries,
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
      armouries,
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
  const supply = supplyOf(world, afloat);
  const roadworks = roadsBuiltOneDay(
    {
      infrastructure: simulation.infrastructure,
      network: supply,
      owners: simulation.owners,
    },
    economies
  );
  const armies = armiesAfterOneDay(
    world,
    {
      air: {
        enemy: below.enemy,
        ...supportOf(
          {
            airspace: world.airspace,
            divisions: afloat.divisions,
            owners: simulation.owners,
            wars: simulation.diplomacy.wars,
          },
          aloft,
          provinces
        ),
      },
      armouries,
      insight: insightOf(intel, simulation.services, simulation.networks),
      modifiers,
      stances: simulation.stances,
      supply,
      wars: simulation.diplomacy.wars,
    },
    {
      divisions: afloat.divisions,
      economies: roadworks.economies,
      owners: simulation.owners,
    }
  );
  const advanced = advancedEverywhere(
    simulation.diplomacy,
    simulation.advancements,
    armies.economies,
    daysFromCivil(dateOf(clock))
  );
  const granted = placedGains(
    {
      grantedSlots: built.grantedSlots,
      infrastructure: roadworks.infrastructure,
      modifiers,
      owners: armies.owners,
      plants: built.plants,
      world,
    },
    "granted",
    { after: advanced.economies, before: armies.economies }
  );
  const settled = fromRealm(
    conductedOneDay(world, clock, {
      ...realmOf(afloat),
      armies: { ...armies, economies: advanced.economies },
    })
  );
  const conducted = {
    ...settled,
    economies: countedFrom(
      granted.plants,
      { owners: settled.owners, world },
      settled.economies
    ),
  };
  const plotted = plottedOneDay(
    {
      networks: simulation.networks,
      services: simulation.services,
      unrest: simulation.unrest,
    },
    {
      capitals: world.nations.map((nation) => nation.capital),
      compliance: simulation.compliance,
      day: clock.days,
      diplomacy: conducted.diplomacy,
      economies: conducted.economies,
      graph,
      owners: conducted.owners,
      random: randomFromSeed(
        streamSeed(streamSeed(world.seed, ESPIONAGE_STREAM), clock.days)
      ),
    },
    advanced.advancements
  );
  const fought = gleanedFromFighting(
    simulation.gleaned,
    clashesOf({
      divisions: afloat.divisions,
      nations: world.nations.length,
      navies: seafaring.navies,
      power: aloft.power,
      wars: simulation.diplomacy.wars,
    })
  );
  const done = settledAtSea(
    world,
    {
      ...afloat,
      ...conducted,
      advancements: plotted.advancements,
      chronicle: eventsChronicled(
        landingsChronicled(
          conducted.chronicle,
          seafaring.landings,
          simulation.owners,
          clock.days
        ),
        plotted.events,
        clock.days
      ),
      clock,
      gleaned: extractedOneDay(
        fought,
        {
          agencies: plotted.intrigue.services.map((service) => service.agency),
          held: heldCaptives(plotted.intrigue.services),
        },
        randomFromSeed(
          streamSeed(streamSeed(world.seed, EXTRACTION_STREAM), clock.days)
        )
      ),
      infrastructure: roadworks.infrastructure,
      networks: plotted.intrigue.networks,
      services: plotted.intrigue.services,
      unrest: plotted.intrigue.unrest,
    },
    clock.days
  );
  return {
    ...done,
    compliance: compliedOneDay(
      simulation.compliance,
      done.owners,
      stirred.resistance
    ),
    grantedSlots: granted.grantedSlots,
    plants: granted.plants,
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
