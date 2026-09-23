import { Option } from "effect";
import type { Diplomacy } from "./diplomacy";
import type { Division } from "./divisions";
import { valueAt } from "./grid";
import type { World } from "./index";
import type { Invasion, Muster } from "./invasion";
import { invasionOutcome, invasionPlanned } from "./invasion";
import { itemAt } from "./lookup";
import { musteringAt, sentToMuster } from "./muster";
import type { NationPair } from "./nations";
import { neighbouringNations } from "./nations";
import { foughtAtSea } from "./naval-combat";
import type { Navy, Station } from "./navy";
import {
  FLEET_ROLES,
  fleetOf,
  fleetStrength,
  ordersFor,
  sailed,
  enemyHoldIn,
  watersOf,
} from "./navy";
import type { ProvinceGraph } from "./provinces";
import { graphOf, isLand, neighboursOf } from "./provinces";
import type { HomePort } from "./seas";
import {
  homePortOf,
  overlandBetween,
  seaDistanceFrom,
  zonesOffshore,
} from "./seas";
import type { Sailings, Voyage, Waters } from "./shipping";
import { idleConvoys, shippedOneDay } from "./shipping";
import { UNASSIGNED } from "./spread";
import type { Lines, SupplyReach } from "./supply";
import { reachOf } from "./supply";
import type { Deal } from "./trade";
import { atWar } from "./wars";

/** Everything at sea, and the divisions a landing takes aboard or puts ashore. */
export interface Seas {
  readonly navies: readonly Navy[];
  readonly invasions: readonly Invasion[];
  readonly divisions: readonly Division[];
}

/** What a day at sea reads besides the seas themselves. */
export interface Coasts {
  readonly world: World;
  readonly graph: ProvinceGraph;
  readonly owners: Int32Array;
  readonly diplomacy: Diplomacy;
  /** The trade struck today. */
  readonly deals: readonly Deal[];
  /** The supply lines as the day began, which is what the convoys sail for. */
  readonly lines: Lines;
  /** Days since the start date. */
  readonly day: number;
  /** The zone off each nation's home port, or `UNASSIGNED`, by nation id. */
  readonly homes: readonly number[];
  /** Which piece of land each province is on, by province id. */
  readonly landmasses: Int32Array;
  /** Where each nation musters, by nation id. */
  readonly musters: readonly number[];
}

/** A day at sea, and the landings that went ashore on it. */
export interface Seafaring extends Seas {
  /** The landings on an enemy coast that went ashore today, transfers left out. */
  readonly landings: readonly Invasion[];
}

/** Where each nation's home port is today, by nation id. */
const homePortsOf = (
  world: World,
  graph: ProvinceGraph,
  owners: Int32Array
): readonly Option.Option<HomePort>[] =>
  world.nations.map((nation) =>
    homePortOf(world, graph, owners, nation, musteringAt(world, owners, nation))
  );

/** The zone off a home port, or `UNASSIGNED` where the nation has none. */
const zoneOf = (port: Option.Option<HomePort>): number =>
  Option.match(port, {
    onNone: () => UNASSIGNED,
    onSome: (found) => found.zone,
  });

/** The zone off each nation's home port, or `UNASSIGNED`, by nation id. */
export const homeZonesOf = (
  world: World,
  owners: Int32Array
): readonly number[] =>
  homePortsOf(world, graphOf(world.provinces), owners).map(zoneOf);

/** The convoys each zone saw yesterday on the lanes of the nations `counts` accepts. */
const trafficOf = (
  navies: readonly Navy[],
  counts: (nation: number) => boolean
): ReadonlyMap<number, number> => {
  const traffic = new Map<number, number>();
  const lanes = navies.flatMap((navy, nation) => {
    if (!counts(nation)) {
      return [];
    }
    return navy.lanes;
  });
  for (const lane of lanes) {
    for (const zone of lane.zones) {
      traffic.set(zone, (traffic.get(zone) ?? 0) + lane.convoys);
    }
  }
  return traffic;
};

/** The zone `score` puts highest, the lowest id first where two tie, where any scores. */
const heaviest = (scores: ReadonlyMap<number, number>): Option.Option<number> =>
  Option.map(
    Option.fromIterable(
      [...scores]
        .filter(([, score]) => score > 0)
        .toSorted(([one, left], [other, right]) => right - left || one - other)
    ),
    ([zone]) => zone
  );

/** Where `nation`'s task forces are wanted today. */
const stationOf = (
  seas: Seas,
  coasts: Coasts,
  waters: readonly Float32Array[],
  nation: number,
  home: number
): Station => {
  const own = trafficOf(seas.navies, (other) => other === nation);
  const enemy = trafficOf(seas.navies, (other) =>
    atWar(coasts.diplomacy.wars, nation, other)
  );
  const landing = seas.invasions.find((invasion) => invasion.nation === nation);
  return {
    busiest: heaviest(own),
    home,
    landing: Option.map(Option.fromUndefinedOr(landing), (invasion) =>
      itemAt(invasion.lane, Math.floor(invasion.lane.length / 2), home)
    ),
    prey: heaviest(enemy),
    threatened: heaviest(
      new Map(
        [...own.keys()].map((zone) => [
          zone,
          enemyHoldIn({ diplomacy: coasts.diplomacy, waters }, nation, zone),
        ])
      )
    ),
  };
};

/** Every navy after its task forces have taken their orders and sailed one zone. */
const sailedEverywhere = (
  seas: Seas,
  coasts: Coasts,
  homes: readonly number[]
): readonly Navy[] => {
  const waters = watersOf(coasts.graph, seas.navies);
  return seas.navies.map((navy, nation) => {
    const station = stationOf(
      seas,
      coasts,
      waters,
      nation,
      itemAt(homes, nation, UNASSIGNED)
    );
    return {
      ...navy,
      fleets: navy.fleets.map((fleet) => {
        const orders = ordersFor(fleet, station);
        return sailed(
          coasts.graph,
          fleet,
          orders,
          seaDistanceFrom(coasts.graph, [orders.target])
        );
      }),
    };
  });
};

/** The provinces `nation` holds that its capital reaches over land. */
const homeGround = (
  owners: Int32Array,
  reach: SupplyReach,
  nation: number
): readonly number[] =>
  [...owners.entries()].flatMap(([province, owner]) => {
    if (owner !== nation || valueAt(reach.overland, province) === UNASSIGNED) {
      return [];
    }
    return [province];
  });

/** The divisions of `nation` standing on `ground`, which a crossing can take. */
const spareOf = (
  divisions: readonly Division[],
  ground: ReadonlySet<number>,
  nation: number
): readonly Division[] =>
  divisions.filter(
    (division) => division.nation === nation && ground.has(division.province)
  );

const NO_REACH: SupplyReach = {
  cutOff: [],
  overland: new Int32Array(0),
  overseas: new Int32Array(0),
  ports: [],
};

/** The landings once today's have gone in or been called off, and the new ones planned. */
interface Landings {
  readonly invasions: readonly Invasion[];
  readonly divisions: readonly Division[];
  readonly landed: readonly Invasion[];
}

/** Every landing's day: the ones under way go in, wait, or come home, and new ones start. */
const landedEverywhere = (
  seas: Seas,
  coasts: Coasts,
  waters: readonly Float32Array[],
  homes: readonly number[],
  reaches: readonly SupplyReach[]
): Landings => {
  const { diplomacy, owners, world } = coasts;
  const kept: Invasion[] = [];
  const landed: Invasion[] = [];
  const ended = new Set<number>();
  let divisions = [...seas.divisions];
  for (const invasion of seas.invasions) {
    const outcome = invasionOutcome(
      invasion,
      owners,
      diplomacy,
      coasts.day,
      (zone) => 1 - enemyHoldIn({ diplomacy, waters }, invasion.nation, zone)
    );
    if (outcome.kind === "waiting") {
      kept.push(invasion);
      continue;
    }
    ended.add(invasion.nation);
    if (outcome.kind === "landed") {
      landed.push(
        ...[invasion].filter((crossing) => crossing.crossing === "landing")
      );
      divisions.push(...outcome.divisions);
      continue;
    }
    divisions.push(
      ...invasion.divisions.flatMap((division) =>
        sentToMuster(world, owners, division)
      )
    );
  }
  const garrisons = new Map<number, number>();
  for (const division of divisions) {
    garrisons.set(
      division.province,
      (garrisons.get(division.province) ?? 0) + division.strength
    );
  }
  for (const [nation, navy] of seas.navies.entries()) {
    if (
      ended.has(nation) ||
      kept.some((invasion) => invasion.nation === nation)
    ) {
      continue;
    }
    const reach = itemAt(reaches, nation, NO_REACH);
    const home = homeGround(owners, reach, nation);
    const facingEnemy = (province: number) =>
      neighboursOf(coasts.graph, province).some(
        (beside) =>
          isLand(coasts.graph, beside) &&
          atWar(diplomacy.wars, nation, valueAt(owners, beside))
      );
    const muster: Muster = {
      beachheads: reach.cutOff.filter(
        (coast) => valueAt(owners, coast) === nation && facingEnemy(coast)
      ),
      facesEnemy: home.some(facingEnemy),
      hasFleet: fleetOf(navy, "main").ships.length > 0,
      home: itemAt(homes, nation, UNASSIGNED),
      idleConvoys: idleConvoys(navy, 0),
      nation,
      spare: spareOf(divisions, new Set(home), nation),
    };
    for (const invasion of Option.toArray(
      invasionPlanned(
        { diplomacy, garrisons, graph: coasts.graph, owners },
        muster,
        coasts.day
      )
    )) {
      const aboard = new Set(invasion.divisions);
      divisions = divisions.filter((division) => !aboard.has(division));
      kept.push(invasion);
    }
  }
  return { divisions, invasions: kept, landed };
};

/** The convoys a cut-off division needs to be kept supplied over the sea. */
const CONVOYS_PER_SUPPLIED_DIVISION = 1;

/**
 * The units of a resource one convoy carries. A search snippet of the wiki
 * gives ten, and the page it came from was not found again.
 */
const UNITS_PER_CONVOY = 10;

/**
 * A trade lane for each deal `nation` bought that does not pass overland,
 * from the exporter's home port to its own.
 */
const tradeVoyages = (coasts: Coasts, nation: number): readonly Voyage[] => {
  const { homes } = coasts;
  return coasts.deals.flatMap((deal): readonly Voyage[] => {
    const from = itemAt(homes, deal.exporter, UNASSIGNED);
    const to = itemAt(homes, nation, UNASSIGNED);
    if (
      deal.importer !== nation ||
      from === UNASSIGNED ||
      to === UNASSIGNED ||
      overlandBetween(coasts.landmasses, coasts.musters, deal.exporter, nation)
    ) {
      return [];
    }
    return [
      {
        cargo: "trade",
        from: [from],
        need: Math.ceil(deal.units / UNITS_PER_CONVOY),
        to: [to],
      },
    ];
  });
};

/**
 * What `nation`'s convoys are asked to do today: a supply lane to each piece
 * of land its own cut-off coasts stand on, asked for a convoy for each of its
 * divisions standing there beyond the reach of the land walk and left out
 * where none does, and its trade lanes.
 */
const sailingsOf = (
  coasts: Coasts,
  seas: Seas,
  reach: SupplyReach,
  nation: number
): Sailings => {
  const own = reach.cutOff.filter(
    (coast) => valueAt(coasts.owners, coast) === nation
  );
  const pockets = [
    ...new Set(own.map((coast) => valueAt(coasts.landmasses, coast))),
  ];
  const supply = pockets.flatMap((pocket): readonly Voyage[] => {
    const standing = seas.divisions.filter(
      (division) =>
        division.nation === nation &&
        valueAt(coasts.landmasses, division.province) === pocket &&
        valueAt(reach.overland, division.province) === UNASSIGNED &&
        valueAt(reach.overseas, division.province) !== UNASSIGNED
    ).length;
    if (standing === 0) {
      return [];
    }
    return [
      {
        cargo: "supply",
        from: zonesOffshore(coasts.graph, reach.ports),
        need: standing * CONVOYS_PER_SUPPLIED_DIVISION,
        to: zonesOffshore(
          coasts.graph,
          own.filter((coast) => valueAt(coasts.landmasses, coast) === pocket)
        ),
      },
    ];
  });
  return {
    reserved: seas.invasions
      .filter((invasion) => invasion.nation === nation)
      .reduce((total, invasion) => total + invasion.convoys, 0),
    voyages: [...supply, ...tradeVoyages(coasts, nation)],
  };
};

/**
 * One day at sea: every task force takes its orders and sails, every battle
 * at sea is fought, every landing goes in, waits or comes home and new ones
 * are planned, and last the convoys run their lanes past whatever the enemy
 * holds of the sea that day.
 */
export const seafaredOneDay = (seas: Seas, coasts: Coasts): Seafaring => {
  const { homes } = coasts;
  const sailedNavies = sailedEverywhere(seas, coasts, homes);
  const battles = foughtAtSea(
    sailedNavies,
    coasts.diplomacy.wars,
    FLEET_ROLES.length
  );
  const waters: Waters = {
    all: watersOf(coasts.graph, battles.navies),
    diplomacy: coasts.diplomacy,
    graph: coasts.graph,
    raiders: watersOf(
      coasts.graph,
      battles.navies.map((navy) => ({
        ...navy,
        fleets: navy.fleets.filter((fleet) => fleet.mission === "raid"),
      }))
    ),
  };
  const reaches = coasts.world.nations.map((nation) =>
    reachOf(coasts.lines, nation.id)
  );
  const landings = landedEverywhere(
    { ...seas, navies: battles.navies },
    coasts,
    waters.all,
    homes,
    reaches
  );
  const after: Seas = {
    divisions: landings.divisions,
    invasions: landings.invasions,
    navies: battles.navies,
  };
  return {
    ...after,
    landings: landings.landed,
    navies: shippedOneDay(
      waters,
      battles.navies,
      battles.navies.map((_, nation) =>
        sailingsOf(coasts, after, itemAt(reaches, nation, NO_REACH), nation)
      )
    ),
  };
};

/**
 * How much stronger at sea a nation's fleet has to be than its target's
 * before it carries a war across the water, as a side on land has to be
 * before it counts its neighbour a prey.
 */
const MENACE_AT_SEA = 1.5;

/**
 * Every pair of nations whose land does not touch where the first can carry
 * a war across the sea to the second: both have a port, and the first has a
 * battle fleet half again as strong as the second's whole navy.
 */
export const overseasRivals = (
  world: World,
  simulation: Pick<Seas, "navies"> & { readonly owners: Int32Array }
): readonly NationPair[] => {
  const homes = homeZonesOf(world, simulation.owners);
  const touching = new Set(
    neighbouringNations(world, simulation.owners).map(
      (pair) => pair.one * world.nations.length + pair.other
    )
  );
  const strength = simulation.navies.map(fleetStrength);
  const battleFleet = simulation.navies.map((navy) =>
    fleetStrength({ ...navy, fleets: [fleetOf(navy, "main")] })
  );
  return world.nations.flatMap((one) =>
    world.nations.flatMap((other): readonly NationPair[] => {
      const pair = {
        one: Math.min(one.id, other.id),
        other: Math.max(one.id, other.id),
      };
      if (
        one.id === other.id ||
        itemAt(homes, one.id, UNASSIGNED) === UNASSIGNED ||
        itemAt(homes, other.id, UNASSIGNED) === UNASSIGNED ||
        touching.has(pair.one * world.nations.length + pair.other) ||
        itemAt(battleFleet, one.id, 0) === 0 ||
        itemAt(battleFleet, one.id, 0) <
          MENACE_AT_SEA * itemAt(strength, other.id, 0)
      ) {
        return [];
      }
      return [{ one: one.id, other: other.id }];
    })
  );
};
