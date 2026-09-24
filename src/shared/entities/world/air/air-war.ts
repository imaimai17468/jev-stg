import type { Airspace } from "../airspace";
import { provincesInRangeOf, regionOfProvince, withinRange } from "../airspace";
import type { Armoury } from "../armoury";
import { OPENING_ARMOURY } from "../armoury";
import type { Diplomacy } from "../diplomacy/diplomacy";
import { allied } from "../diplomacy/diplomacy";
import type { NationEconomy } from "../economy/economy";
import { burnt, NO_ECONOMY } from "../economy/economy";
import { fuelShareOf, PLANE_FUEL_PER_DAY, planesKeptWith } from "../fuel";
import type { World } from "../geography/world";
import { valueAt } from "../grid";
import { itemAt, replacedAt } from "../lookup";
import type { Invasion } from "../navy/invasion";
import { afloatAfter } from "../navy/naval-combat";
import type { Navy, TaskForce } from "../navy/navy";
import { NO_NAVY } from "../navy/navy";
import type { Ship, ShipRole } from "../navy/ships";
import { classOf, hullOf, roleOf } from "../navy/ships";
import { isLand, neighboursOf } from "../provinces";
import type { ProvinceGraph } from "../provinces";
import { UNASSIGNED } from "../spread";
import { atWar, enemiesOf } from "../wars";
import type { Basing } from "./air-bases";
import {
  AIR_BASE_COST,
  baseWanted,
  capacityAt,
  crowdingEfficiency,
  MOST_BASE_LEVELS,
  roomiestAmong,
  roomiestBase,
  stationedOf,
} from "./air-bases";
import type { Flight } from "./air-combat";
import { foughtInTheAir } from "./air-combat";
import type { AirForce, AirMission, Wing } from "./air-force";
import { aircraftOf, flyingOf, WING_SIZE } from "./air-force";
import type { Aircraft, AirframeModel, AirframeModels } from "./aircraft";
import { airframeOf } from "./aircraft";

/** Everything in the air, the ships its planes fly from or strike, and what pays for both. */
export interface Hangars {
  readonly airForces: readonly AirForce[];
  /** The level of the air base in each province, by province id. */
  readonly airBases: Uint8Array;
  readonly navies: readonly Navy[];
  readonly economies: readonly NationEconomy[];
  /** What each nation's research arms it with, by nation id, whose newest designs fly from its carriers. */
  readonly armouries: readonly Armoury[];
}

/** What a day in the air reads besides the hangars. */
export interface Airfields {
  readonly world: World;
  readonly graph: ProvinceGraph;
  readonly owners: Int32Array;
  readonly diplomacy: Diplomacy;
  readonly invasions: readonly Invasion[];
  /** The zone off each nation's home port, or `UNASSIGNED`, by nation id. */
  readonly homes: readonly number[];
  /** Where each nation musters, by nation id. */
  readonly musters: readonly number[];
  /** The air power every nation flew over each region yesterday, by nation id and then region id. */
  readonly flown: readonly Float32Array[];
}

/** A day in the air, and the air power every nation flew in it. */
export interface AirDay extends Omit<Hangars, "armouries"> {
  /** Each nation's air power over each region, by nation id and then region id. */
  readonly power: readonly Float32Array[];
  /** The close air support planes each nation flies over each region, by nation id and then region id. */
  readonly support: readonly Float32Array[];
  /** The ground attack those planes carry between them, by nation id and then region id. */
  readonly supportAttack: readonly Float32Array[];
}

/** The mission each kind of plane flies. */
const MISSION_OF = {
  "close-support": "close-support",
  fighter: "superiority",
  "naval-bomber": "naval-strike",
  transport: "standby",
} satisfies Readonly<Record<Aircraft, AirMission>>;

/** What a nation has at stake over each region, by region id. */
interface Stakes {
  /** The provinces on either side of its front with an enemy. */
  readonly front: Float64Array;
  /** Its task forces at sea and the landings it is preparing. */
  readonly fleet: Float64Array;
  /** The enemy warships at sea. */
  readonly prey: Float64Array;
  /** The air power its enemies flew yesterday. */
  readonly enemyAir: Float64Array;
}

/**
 * How every nation stands to `nation`, by nation id: 1 on its side, -1 at war
 * with it, and 0 for neither.
 */
const standingsOf = (fields: Airfields, nation: number): Int8Array =>
  Int8Array.from(
    fields.world.nations,
    (other) =>
      Number(allied(fields.diplomacy, nation, other.id)) -
      Number(atWar(fields.diplomacy.wars, nation, other.id))
  );

/**
 * Whether land province `province` lies on the front between a nation's side
 * and its enemies, read off how every nation stands to it: held by one side
 * and touching land the other side holds.
 */
const onTheFront = (
  fields: Airfields,
  standings: Int8Array,
  province: number
): boolean => {
  const { graph, owners } = fields;
  const holder = valueAt(standings, valueAt(owners, province));
  return (
    holder !== 0 &&
    neighboursOf(graph, province).some(
      (beside) =>
        isLand(graph, beside) &&
        valueAt(standings, valueAt(owners, beside)) === -holder
    )
  );
};

/** Every task force of `navy` at sea and fit to fight. */
const atSea = (navy: Navy): readonly TaskForce[] =>
  navy.fleets.filter(
    (fleet) =>
      fleet.zone !== UNASSIGNED &&
      fleet.mission !== "repair" &&
      fleet.ships.length > 0
  );

/** What `nation` has at stake over each region today. */
const stakesOf = (
  fields: Airfields,
  navies: readonly Navy[],
  nation: number
): Stakes => {
  const { airspace } = fields.world;
  const regions = airspace.regions.length;
  const stakes: Stakes = {
    enemyAir: new Float64Array(regions),
    fleet: new Float64Array(regions),
    front: new Float64Array(regions),
    prey: new Float64Array(regions),
  };
  const add = (into: Float64Array, province: number, amount: number) => {
    const region = regionOfProvince(airspace, province);
    into[region] = valueAt(into, region) + amount;
  };
  const standings = standingsOf(fields, nation);
  for (const province of fields.world.provinces) {
    if (
      province.kind === "land" &&
      onTheFront(fields, standings, province.id)
    ) {
      add(stakes.front, province.id, 1);
    }
  }
  for (const fleet of atSea(itemAt(navies, nation, NO_NAVY))) {
    add(stakes.fleet, fleet.zone, 1);
  }
  for (const invasion of fields.invasions) {
    if (invasion.nation === nation) {
      for (const zone of invasion.lane) {
        add(stakes.fleet, zone, 1);
      }
    }
  }
  for (const enemy of enemiesOf(fields.diplomacy.wars, nation)) {
    for (const fleet of atSea(itemAt(navies, enemy, NO_NAVY))) {
      add(stakes.prey, fleet.zone, fleet.ships.length);
    }
    const flown = itemAt(fields.flown, enemy, new Float32Array(0));
    for (const [region, power] of flown.entries()) {
      stakes.enemyAir[region] = valueAt(stakes.enemyAir, region) + power;
    }
  }
  return stakes;
};

/**
 * What a fighter's task force counts for against one front province, and the
 * air power it counts one front province for. The rules weigh these, and
 * they are this game's own.
 */
const FLEET_STAKE = 2;
const ENEMY_AIR_PER_STAKE = 10;

/**
 * How much a wing of `aircraft` is wanted over `region`: nowhere for a
 * transport, which waits at its base for a drop.
 */
const scoreOf = (
  aircraft: Aircraft,
  stakes: Stakes,
  region: number
): number => {
  if (aircraft === "transport") {
    return 0;
  }
  if (aircraft === "naval-bomber") {
    return valueAt(stakes.prey, region);
  }
  if (aircraft === "close-support") {
    return valueAt(stakes.front, region);
  }
  return (
    valueAt(stakes.front, region) +
    FLEET_STAKE * valueAt(stakes.fleet, region) +
    valueAt(stakes.enemyAir, region) / ENEMY_AIR_PER_STAKE
  );
};

/** The region of `regions` `score` puts highest, the first where two tie, or `UNASSIGNED` where none scores. */
const bestOf = (
  regions: readonly number[],
  score: (region: number) => number
): number => {
  let best = UNASSIGNED;
  let bestScore = 0;
  for (const region of regions) {
    const value = score(region);
    if (value > bestScore) {
      best = region;
      bestScore = value;
    }
  }
  return best;
};

/** Every region of `airspace`, by id. */
const everyRegion = (airspace: Airspace): readonly number[] =>
  airspace.regions.map((region) => region.id);

/** The wing waiting at its base. */
const standingBy = (wing: Wing): Wing => ({
  ...wing,
  mission: "standby",
  region: UNASSIGNED,
});

/** What the rules want of one kind of a nation's planes today. */
interface Tasking {
  /** How much a wing of the kind is wanted over each region. */
  readonly score: (region: number) => number;
  /** The planes of the kind already sent over each region, by region id. */
  readonly sent: Float64Array;
  /**
   * The provinces within range of the region the kind is wanted most
   * anywhere, lowest first, and none where it is wanted nowhere.
   */
  readonly refuges: readonly number[];
}

const taskingOf = (
  aircraft: Aircraft,
  stakes: Stakes,
  airspace: Airspace
): Tasking => {
  const score = (region: number) => scoreOf(aircraft, stakes, region);
  const wanted = bestOf(everyRegion(airspace), score);
  return {
    refuges: provincesInRangeOf(airspace, wanted),
    score,
    sent: new Float64Array(airspace.regions.length),
  };
};

/** `wing` moved to the base at `refuge`, its planes counted there in `stationed` and no longer at its old one. */
const movedTo = (wing: Wing, refuge: number, stationed: Float64Array): Wing => {
  stationed[wing.base] = valueAt(stationed, wing.base) - wing.planes;
  stationed[refuge] = valueAt(stationed, refuge) + wing.planes;
  return { ...standingBy(wing), base: refuge };
};

/**
 * The wing sent where the rules want it: over the region within its range its
 * kind is wanted most, counting the planes of that kind already sent there,
 * and otherwise moved to the air base with the most room within range of the
 * region its kind is wanted most anywhere, to wait there a day. A wing wanted
 * nowhere, or with no base in range of where it is wanted, waits where it
 * is. `tasking.sent` and `basing.stationed` are written in place, since each
 * wing reads where the ones before it were sent and moved.
 */
const orderedWing = (
  wing: Wing,
  airspace: Airspace,
  tasking: Tasking,
  basing: Basing
): Wing => {
  const { sent } = tasking;
  const over = bestOf(
    withinRange(airspace, regionOfProvince(airspace, wing.base)),
    (region) => tasking.score(region) / (1 + valueAt(sent, region) / WING_SIZE)
  );
  if (over !== UNASSIGNED) {
    sent[over] = valueAt(sent, over) + wing.planes;
    return { ...wing, mission: MISSION_OF[aircraftOf(wing)], region: over };
  }
  const refuge = roomiestAmong(basing, tasking.refuges);
  if (refuge === UNASSIGNED) {
    return standingBy(wing);
  }
  return movedTo(wing, refuge, basing.stationed);
};

/** One nation's air force as the day in the air reads it. */
interface Squadrons {
  readonly nation: number;
  readonly airForce: AirForce;
  readonly basing: Basing;
}

/** An air force after its wings on fallen bases have moved, and the wings that moved. */
interface Rebased {
  readonly airForce: AirForce;
  /** The wings that moved today, which wait at their new bases until tomorrow. */
  readonly moved: ReadonlySet<Wing>;
}

/**
 * The air force with every wing whose base has fallen to another nation
 * moved to the base with the most room its nation still holds, each counting
 * the ones moved before it, and lost where it holds none.
 */
const rebased = ({ airForce, basing, nation }: Squadrons): Rebased => {
  const held = (wing: Wing) => valueAt(basing.owners, wing.base) === nation;
  const stationed = stationedOf(
    airForce.wings.filter(held),
    basing.bases.length
  );
  const moved = new Set<Wing>();
  const wings = airForce.wings.flatMap((wing) => {
    if (held(wing)) {
      return [wing];
    }
    const refuge = roomiestBase({ ...basing, stationed });
    if (refuge === UNASSIGNED) {
      return [];
    }
    const arrived = movedTo(wing, refuge, stationed);
    moved.add(arrived);
    return [arrived];
  });
  return { airForce: { ...airForce, wings }, moved };
};

/**
 * The air force with every wing given its orders for the day: at war, sent
 * where the rules want it, and at peace, or on the day it moved to a new
 * base, waiting at its base.
 */
const ordered = (
  squadrons: Squadrons,
  fields: Airfields,
  navies: readonly Navy[],
  moved: ReadonlySet<Wing>
): AirForce => {
  const { airForce, basing, nation } = squadrons;
  if (enemiesOf(fields.diplomacy.wars, nation).length === 0) {
    return { ...airForce, wings: airForce.wings.map(standingBy) };
  }
  const stakes = stakesOf(fields, navies, nation);
  const { airspace } = fields.world;
  const tasked = (aircraft: Aircraft) => taskingOf(aircraft, stakes, airspace);
  const taskings = {
    "close-support": tasked("close-support"),
    fighter: tasked("fighter"),
    "naval-bomber": tasked("naval-bomber"),
    transport: tasked("transport"),
  } satisfies Readonly<Record<Aircraft, Tasking>>;
  return {
    ...airForce,
    wings: airForce.wings.map((wing) => {
      if (moved.has(wing)) {
        return wing;
      }
      return orderedWing(wing, airspace, taskings[aircraftOf(wing)], basing);
    }),
  };
};

/** Where a flight's planes come from, so what the battle leaves of it goes back there. */
type Source =
  | { readonly kind: "wing"; readonly nation: number; readonly wing: number }
  | {
      readonly kind: "deck";
      readonly nation: number;
      readonly fleet: number;
      readonly ship: number;
    };

/** One flight in the sky over one region, and where its planes come from. */
interface Sortie {
  readonly region: number;
  readonly mission: AirMission;
  readonly flight: Flight;
  readonly source: Source;
}

/**
 * The fuel every wing sent out today burns, which Hearts of Iron IV counts
 * for the planes on a mission and not for the ones waiting at their base.
 */
const fuelDemandOf = (airForce: AirForce): number =>
  flyingOf(airForce).reduce(
    (total, wing) =>
      total + wing.planes * airframeOf(wing.model).fuel * PLANE_FUEL_PER_DAY,
    0
  );

/**
 * The fuel the planes aboard `navy`'s carriers at sea burn today, half of
 * them fighters and half naval bombers of the designs `models` has, which fly
 * only while the nation is `fighting` a war.
 */
const deckFuelDemandOf = (
  navy: Navy,
  fighting: boolean,
  models: AirframeModels
): number => {
  const perPlane =
    ((airframeOf(models.fighter).fuel +
      airframeOf(models["naval-bomber"]).fuel) /
      2) *
    PLANE_FUEL_PER_DAY;
  let demand = 0;
  for (const force of navy.fleets) {
    if (!fighting || force.zone === UNASSIGNED || force.mission === "repair") {
      continue;
    }
    for (const ship of force.ships) {
      demand += ship.planes * perPlane;
    }
  }
  return demand;
};

/** Every wing sent out today as a flight over the region it was sent to. */
const wingSorties = (
  airForce: AirForce,
  nation: number,
  bases: Uint8Array,
  fuel: number
): readonly Sortie[] => {
  const stationed = stationedOf(airForce.wings, bases.length);
  return [...airForce.wings.entries()].flatMap(([index, wing]) => {
    if (wing.mission === "standby") {
      return [];
    }
    return [
      {
        flight: {
          efficiency:
            fuel *
            crowdingEfficiency(
              valueAt(stationed, wing.base),
              capacityAt(bases, wing.base)
            ),
          model: wing.model,
          nation,
          planes: wing.planes,
        },
        mission: wing.mission,
        region: wing.region,
        source: { kind: "wing", nation, wing: index },
      },
    ];
  });
};

/**
 * The planes aboard `nation`'s carriers at sea as flights over the region
 * each one's zone lies in: half of each deck fighters and half naval
 * bombers, which is this game's own, since the wiki leaves a carrier's mix of
 * planes to its designer, both of the designs `models` has, since a deck is
 * counted in planes and not in designs.
 */
const deckSorties = (
  navy: Navy,
  nation: number,
  airspace: Airspace,
  fuel: number,
  models: AirframeModels
): readonly Sortie[] =>
  [...navy.fleets.entries()].flatMap(([fleet, force]) => {
    if (force.zone === UNASSIGNED || force.mission === "repair") {
      return [];
    }
    return [...force.ships.entries()].flatMap(([ship, aboard]) => {
      if (aboard.planes <= 0) {
        return [];
      }
      const half = (model: AirframeModel, mission: AirMission): Sortie => ({
        flight: {
          efficiency: fuel,
          model,
          nation,
          planes: aboard.planes / 2,
        },
        mission,
        region: regionOfProvince(airspace, force.zone),
        source: { fleet, kind: "deck", nation, ship },
      });
      return [
        half(models.fighter, "superiority"),
        half(models["naval-bomber"], "naval-strike"),
      ];
    });
  });

/** Every sortie after a day of air battles over the region it flies in. */
const foughtOverEveryRegion = (
  sorties: readonly Sortie[],
  diplomacy: Diplomacy
): readonly Sortie[] => {
  const byRegion = new Map<number, Sortie[]>();
  for (const sortie of sorties) {
    const here = byRegion.get(sortie.region) ?? [];
    here.push(sortie);
    byRegion.set(sortie.region, here);
  }
  return [...byRegion.values()].flatMap((here) => {
    const after = foughtInTheAir(
      here.map((sortie) => sortie.flight),
      diplomacy.wars
    );
    return here.map((sortie, index) => ({
      ...sortie,
      flight: itemAt(after, index, sortie.flight),
    }));
  });
};

/**
 * What each nation flew over each region, by nation id and then region id:
 * every flight's planes that fly, each counted for its `worth`.
 */
const powerOf = (
  sorties: readonly Sortie[],
  nations: number,
  regions: number,
  worth: (flight: Flight) => number
): readonly Float32Array[] => {
  const power = Array.from(
    { length: nations },
    () => new Float32Array(regions)
  );
  for (const { flight, region } of sorties) {
    const flown = itemAt(power, flight.nation, new Float32Array(0));
    flown[region] =
      valueAt(flown, region) +
      flight.planes * flight.efficiency * worth(flight);
  }
  return power;
};

/** A wing worn down to less than this many planes has broken up. */
const LEAST_WING = 0.5;

/** `wing` with `planes` left, or nothing where so few are left it has broken up. */
const withPlanes = (wing: Wing, planes: number): readonly Wing[] => {
  if (planes < LEAST_WING) {
    return [];
  }
  return [{ ...wing, planes }];
};

/** The air forces with what the air battles left of every wing, and the wings broken up gone. */
const woundAirForces = (
  airForces: readonly AirForce[],
  sorties: readonly Sortie[]
): readonly AirForce[] => {
  const left = new Map<string, number>();
  for (const { flight, source } of sorties) {
    if (source.kind === "wing") {
      left.set(`${source.nation}:${source.wing}`, flight.planes);
    }
  }
  return airForces.map((airForce, nation) => ({
    ...airForce,
    wings: [...airForce.wings.entries()].flatMap(([index, wing]) =>
      withPlanes(wing, left.get(`${nation}:${index}`) ?? wing.planes)
    ),
  }));
};

/** The navies with what the air battles left aboard every carrier. */
const woundDecks = (
  navies: readonly Navy[],
  sorties: readonly Sortie[]
): readonly Navy[] => {
  const left = new Map<string, number>();
  for (const { flight, source } of sorties) {
    if (source.kind === "deck") {
      const key = `${source.nation}:${source.fleet}:${source.ship}`;
      left.set(key, (left.get(key) ?? 0) + flight.planes);
    }
  }
  return navies.map((navy, nation) => ({
    ...navy,
    fleets: navy.fleets.map((force, fleet) => ({
      ...force,
      ships: force.ships.map((ship, index) => ({
        ...ship,
        planes: left.get(`${nation}:${fleet}:${index}`) ?? ship.planes,
      })),
    })),
  }));
};

/**
 * How much more each kind of warship draws the planes striking a fleet than
 * its hull points alone would, after Hearts of Iron IV's targeting weights.
 */
const STRIKE_WEIGHT = {
  capital: 50,
  carrier: 200,
  screen: 10,
  submarine: 10,
} satisfies Readonly<Record<ShipRole, number>>;

/**
 * Hearts of Iron IV's naval strike: at least 20 planes join an attack on a
 * fleet, and otherwise a twentieth of the hull points it has left; a plane
 * that finds it attacks on each of the day's three sorties; and its 4% chance
 * an hour of finding the fleet is what a day's sorties are counted down by.
 * The share of attacks that hit is not on the wiki, and this game takes the
 * 10% its warships hit with.
 */
const LEAST_STRIKERS = 20;
const STRIKERS_PER_HULL_POINT = 0.05;
const SORTIES_PER_DAY = 3;
const FOUND_PER_HOUR = 0.04;
const HOURS_PER_DAY = 24;
const FOUND_PER_DAY = 1 - (1 - FOUND_PER_HOUR) ** HOURS_PER_DAY;
const STRIKE_HIT = 0.1;

/** How strongly `ship` draws the planes striking its fleet. */
const strikeWeightOf = (ship: Ship): number =>
  hullOf(ship.design).hp * STRIKE_WEIGHT[roleOf(classOf(ship))];

/** One task force of the navies, by nation and place. */
interface Placed {
  readonly nation: number;
  readonly fleet: number;
  readonly force: TaskForce;
}

/**
 * The navies after `bombers` of `nation`'s naval bombers, carrying `attack`
 * naval attack between them, have struck every task force at sea in `region`
 * of a nation it is at war with: the damage spread over their ships by how
 * strongly each draws the attack, and every ship whose hull is gone sunk.
 */
const struckFromTheAir = (
  navies: readonly Navy[],
  fields: Airfields,
  strike: {
    readonly nation: number;
    readonly region: number;
    readonly bombers: number;
    readonly attack: number;
  }
): readonly Navy[] => {
  const { airspace } = fields.world;
  const targets: Placed[] = [...navies.entries()].flatMap(([enemy, navy]) => {
    if (!atWar(fields.diplomacy.wars, strike.nation, enemy)) {
      return [];
    }
    return [...navy.fleets.entries()].flatMap(([fleet, force]) => {
      if (
        force.zone === UNASSIGNED ||
        force.mission === "repair" ||
        regionOfProvince(airspace, force.zone) !== strike.region
      ) {
        return [];
      }
      return [{ fleet, force, nation: enemy }];
    });
  });
  const ships = targets.flatMap((target) => target.force.ships);
  const hull = ships.reduce((total, ship) => total + ship.hp, 0);
  const weight = ships.reduce((total, ship) => total + strikeWeightOf(ship), 0);
  const strikers = Math.min(
    strike.bombers,
    Math.max(LEAST_STRIKERS, hull * STRIKERS_PER_HULL_POINT)
  );
  const damage =
    ((strikers * strike.attack) / strike.bombers) *
    STRIKE_HIT *
    SORTIES_PER_DAY *
    FOUND_PER_DAY;
  let struck = navies;
  for (const target of targets) {
    const navy = itemAt(struck, target.nation, NO_NAVY);
    struck = replacedAt(struck, target.nation, {
      ...navy,
      fleets: replacedAt(navy.fleets, target.fleet, {
        ...target.force,
        ships: target.force.ships.flatMap((ship) =>
          afloatAfter(ship, (damage * strikeWeightOf(ship)) / weight)
        ),
      }),
    });
  }
  return struck;
};

/** Every plane counted as one. */
const asPlanes = (): number => 1;

/** A plane counted for its design's ground attack. */
const asGroundAttack = (flight: Flight): number =>
  airframeOf(flight.model).groundAttack;

/** A plane counted for its design's naval attack. */
const asNavalAttack = (flight: Flight): number =>
  airframeOf(flight.model).navalAttack;

/**
 * What each nation's wings on `mission` still send out over each region, by
 * nation id and then region id, every plane counted for its `worth`.
 */
const sentOn = (
  sorties: readonly Sortie[],
  mission: AirMission,
  size: { readonly nations: number; readonly regions: number },
  worth: (flight: Flight) => number
): readonly Float32Array[] =>
  powerOf(
    sorties.filter(
      (sortie) => sortie.source.kind === "wing" && sortie.mission === mission
    ),
    size.nations,
    size.regions,
    worth
  );

/** One nation's air force and navy. */
interface Arms {
  readonly airForce: AirForce;
  readonly navy: Navy;
}

/**
 * The air force and the navy once every carrier lying in its home port has
 * taken aboard what its hangars have room for from the nation's fighter and
 * naval bomber wings, the fullest first.
 */
const decksRefilled = (airForce: AirForce, navy: Navy, home: number): Arms => {
  const pool = new Float64Array(airForce.wings.length);
  for (const [index, wing] of airForce.wings.entries()) {
    pool[index] = wing.planes * Number(aircraftOf(wing) !== "close-support");
  }
  const order = [...pool.keys()].toSorted(
    (one, other) => valueAt(pool, other) - valueAt(pool, one)
  );
  const fleets = navy.fleets.map((force) => {
    if (force.mission !== "repair" || force.zone !== home) {
      return force;
    }
    return {
      ...force,
      ships: force.ships.map((ship) => {
        let room = hullOf(ship.design).deck - ship.planes;
        for (const index of order) {
          const taken = Math.min(room, valueAt(pool, index));
          pool[index] = valueAt(pool, index) - taken;
          room -= taken;
        }
        return { ...ship, planes: hullOf(ship.design).deck - room };
      }),
    };
  });
  return {
    airForce: {
      ...airForce,
      wings: airForce.wings.flatMap((wing, index) => {
        if (aircraftOf(wing) === "close-support") {
          return [wing];
        }
        return withPlanes(wing, valueAt(pool, index));
      }),
    },
    navy: { ...navy, fleets },
  };
};

/** The bases, and the economy that paid for the one built today. */
interface Construction {
  readonly bases: Uint8Array;
  readonly economy: NationEconomy;
}

/**
 * The air bases once `basing`'s nation has put a level on the base it wants
 * one at, where its construction has gone far enough to pay for one, and the
 * economy with that construction taken off. A base already built up all the
 * way, or one on ground the nation no longer holds, gets none.
 */
const baseBuilt = (
  basing: Basing,
  economy: NationEconomy,
  muster: number
): Construction => {
  const wanted = baseWanted(basing, muster);
  if (
    wanted === UNASSIGNED ||
    economy.construction < AIR_BASE_COST ||
    valueAt(basing.bases, wanted) >= MOST_BASE_LEVELS ||
    valueAt(basing.owners, wanted) !== basing.nation
  ) {
    return { bases: basing.bases, economy };
  }
  const bases = Uint8Array.from(basing.bases);
  bases[wanted] = valueAt(bases, wanted) + 1;
  return {
    bases,
    economy: { ...economy, construction: economy.construction - AIR_BASE_COST },
  };
};

/** Where `nation`'s planes can be based, with the wings of `airForce` counted in. */
const basingOf = (
  bases: Uint8Array,
  owners: Int32Array,
  airForce: AirForce,
  nation: number
): Basing => ({
  bases,
  nation,
  owners,
  stationed: stationedOf(airForce.wings, bases.length),
});

/**
 * One day in the air. Every wing whose base has fallen moves to one its
 * nation still holds, and every wing takes its orders; the planes sent out
 * burn their fuel, flying at a quarter of their worth where there is none;
 * the air battles over every region are fought, the planes of the carriers
 * at sea of every nation at war among them; the naval bombers strike the enemy's ships in the regions they were
 * sent over; the carriers in their home ports take on planes; and each nation
 * puts its construction into an air base where it needs one.
 */
export const airWarOneDay = (hangars: Hangars, fields: Airfields): AirDay => {
  const { airspace } = fields.world;
  const nations = fields.world.nations.length;
  const regions = airspace.regions.length;
  const orderedForces = hangars.airForces.map((airForce, nation) => {
    const moved = rebased({
      airForce,
      basing: basingOf(hangars.airBases, fields.owners, airForce, nation),
      nation,
    });
    return ordered(
      {
        airForce: moved.airForce,
        basing: basingOf(
          hangars.airBases,
          fields.owners,
          moved.airForce,
          nation
        ),
        nation,
      },
      fields,
      hangars.navies,
      moved.moved
    );
  });
  const modelsOf = (nation: number): AirframeModels =>
    itemAt(hangars.armouries, nation, OPENING_ARMOURY).planes;
  const demands = orderedForces.map(
    (airForce, nation) =>
      fuelDemandOf(airForce) +
      deckFuelDemandOf(
        itemAt(hangars.navies, nation, NO_NAVY),
        enemiesOf(fields.diplomacy.wars, nation).length > 0,
        modelsOf(nation)
      )
  );
  const fuelShares = hangars.economies.map((economy, nation) =>
    planesKeptWith(fuelShareOf(economy.fuel, valueAt(demands, nation)))
  );
  const sorties = foughtOverEveryRegion(
    [
      ...orderedForces.flatMap((airForce, nation) =>
        wingSorties(
          airForce,
          nation,
          hangars.airBases,
          valueAt(fuelShares, nation)
        )
      ),
      ...hangars.navies.flatMap((navy, nation) => {
        if (enemiesOf(fields.diplomacy.wars, nation).length === 0) {
          return [];
        }
        return deckSorties(
          navy,
          nation,
          airspace,
          valueAt(fuelShares, nation),
          modelsOf(nation)
        );
      }),
    ],
    fields.diplomacy
  );
  const wounded = woundAirForces(orderedForces, sorties);
  let navies = woundDecks(hangars.navies, sorties);
  const size = { nations, regions };
  const attacks = sentOn(sorties, "naval-strike", size, asNavalAttack);
  for (const [nation, bombers] of sentOn(
    sorties,
    "naval-strike",
    size,
    asPlanes
  ).entries()) {
    for (const [region, planes] of bombers.entries()) {
      if (planes > 0) {
        navies = struckFromTheAir(navies, fields, {
          attack: valueAt(itemAt(attacks, nation, bombers), region),
          bombers: planes,
          nation,
          region,
        });
      }
    }
  }
  let bases = hangars.airBases;
  const days = wounded.map((airForce, nation) => {
    const refilled = decksRefilled(
      airForce,
      itemAt(navies, nation, NO_NAVY),
      itemAt(fields.homes, nation, UNASSIGNED)
    );
    const built = baseBuilt(
      basingOf(bases, fields.owners, refilled.airForce, nation),
      burnt(
        itemAt(hangars.economies, nation, NO_ECONOMY),
        valueAt(demands, nation)
      ),
      itemAt(fields.musters, nation, UNASSIGNED)
    );
    ({ bases } = built);
    return { ...refilled, economy: built.economy };
  });
  return {
    airBases: bases,
    airForces: days.map((day) => day.airForce),
    economies: days.map((day) => day.economy),
    navies: days.map((day) => day.navy),
    power: powerOf(sorties, nations, regions, asPlanes),
    support: sentOn(sorties, "close-support", size, asPlanes),
    supportAttack: sentOn(sorties, "close-support", size, asGroundAttack),
  };
};
