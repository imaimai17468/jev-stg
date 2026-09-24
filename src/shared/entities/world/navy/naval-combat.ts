import { airframeOf } from "../aircraft";
import type { Armoury } from "../armoury";
import { OPENING_ARMOURY } from "../armoury";
import { valueAt } from "../grid";
import { itemAt } from "../lookup";
import { UNASSIGNED } from "../spread";
import type { Wars } from "../wars";
import { atWar } from "../wars";
import type { Navy, TaskForce } from "./navy";
import { screeningOf } from "./navy";
import type { Ship } from "./ships";
import { classOf, hullOf, organisationShare, roleOf } from "./ships";

/**
 * Hearts of Iron IV's naval hit chance: 10% at base, never below 2%, 40% more
 * for a fleet whose capital ships are fully screened, and up to half off for
 * a ship that has lost its cohesion.
 */
const BASE_HIT = 0.1;
const LEAST_HIT = 0.02;
const SCREENED_BONUS = 0.4;
const DISORGANISED_PENALTY = 0.5;

/**
 * The rounds of fire a day of battle holds. Hearts of Iron IV resolves a
 * battle hour by hour, and this game counts a day's hours as that many rounds
 * of the same hit chance.
 */
const ROUNDS_PER_DAY = 24;

/**
 * The share of a hit's damage that comes off the hull, after Hearts of Iron
 * IV's 60%; the whole of it comes off cohesion.
 */
const HULL_SHARE_OF_DAMAGE = 0.6;

/**
 * What a carrier's planes put into a battle its carrier fights in. Half of
 * its deck is naval bombers, which is this game's own, since the wiki leaves
 * a carrier's planes to its designer. After Hearts of Iron IV, they sortie
 * three times a day, a carrier sends half its planes on each, and they do ten
 * times their damage in their own carrier's battle.
 */
const BOMBERS_PER_DECK = 0.5;
const CARRIER_SORTIES_PER_DAY = 3;
const SORTIE_EFFICIENCY = 0.5;
const OWN_BATTLE_DAMAGE = 10;

/**
 * One task force as a battle sees it: whose it is, where in the navies, how
 * much of its fire its fuel leaves it, and what its nation's research arms it
 * with.
 */
interface Engaged {
  readonly nation: number;
  readonly fleet: number;
  readonly force: TaskForce;
  readonly guns: number;
  readonly armoury: Armoury;
}

/** The chance a ship of `force` hits with one round of fire. */
const hitChanceOf = (force: TaskForce, ship: Ship): number =>
  Math.max(
    LEAST_HIT,
    BASE_HIT *
      (1 + SCREENED_BONUS * screeningOf(force)) *
      (1 - DISORGANISED_PENALTY * (1 - organisationShare(ship)))
  );

/** What the ships of `force` put onto the surface and under it in a day. */
interface Fire {
  readonly surface: number;
  readonly submerged: number;
}

/**
 * What the ships of `engaged` put out in a day: every ship's batteries and
 * torpedoes on every round, raised by what its nation's research adds to its
 * class's weapons, and every carrier's naval bombers, of the nation's newest
 * design, on every sortie they fly, all of it cut by what their fuel leaves
 * them.
 */
const fireOf = ({ armoury, force, guns }: Engaged): Fire => {
  let surface = 0;
  let submerged = 0;
  for (const ship of force.ships) {
    const hull = hullOf(ship.design);
    const weapons = armoury.weapons[classOf(ship)];
    const hitChance = hitChanceOf(force, ship);
    const strikes =
      ship.planes *
      BOMBERS_PER_DECK *
      airframeOf(armoury.planes["naval-bomber"]).navalAttack *
      hitChance *
      CARRIER_SORTIES_PER_DAY *
      SORTIE_EFFICIENCY *
      OWN_BATTLE_DAMAGE;
    const shot =
      hull.light * (1 + weapons.light) +
      hull.heavy * (1 + weapons.heavy) +
      hull.torpedoes * (1 + weapons.torpedo);
    surface += (shot * hitChance * ROUNDS_PER_DAY + strikes) * guns;
    submerged += hull.depthCharges * hitChance * ROUNDS_PER_DAY * guns;
  }
  return { submerged, surface };
};

const isSubmarine = (ship: Ship): boolean =>
  roleOf(classOf(ship)) === "submarine";

/** The fire of `fire` aimed at ships of `ship`'s kind. */
const aimedAt = (fire: Fire, ship: Ship): number => {
  if (isSubmarine(ship)) {
    return fire.submerged;
  }
  return fire.surface;
};

/**
 * How easily `ship` is picked out among `targets`: a ship on the surface by
 * how visible it is against every ship on the surface there, and a submarine
 * as one of the submarines there.
 */
const exposureOf = (ship: Ship, targets: readonly Engaged[]): number => {
  const seen = targets
    .flatMap((target) =>
      target.force.ships.filter(
        (other) => isSubmarine(other) === isSubmarine(ship)
      )
    )
    .reduce((total, other) => total + hullOf(other.design).visibility, 0);
  return hullOf(ship.design).visibility / seen;
};

/** The ship with `damage` taken off its hull and its cohesion. */
const hit = (ship: Ship, damage: number): Ship => ({
  ...ship,
  hp: ship.hp - damage * HULL_SHARE_OF_DAMAGE,
  organisation: Math.max(0, ship.organisation - damage),
});

/** `ship` with `damage` taken off, or nothing where it sinks under it. */
export const afloatAfter = (ship: Ship, damage: number): readonly Ship[] => {
  const after = hit(ship, damage);
  if (after.hp <= 0) {
    return [];
  }
  return [after];
};

/** Whether `one`'s nation and `other`'s are at war. */
const hostile = (wars: Wars, one: Engaged, other: Engaged): boolean =>
  atWar(wars, one.nation, other.nation);

/**
 * The task force after a day under the fire of every enemy in its zone, its
 * sunk ships gone. Each enemy spreads its fire over every ship it is at war
 * with there, so two allies in one zone share what it puts out.
 */
const struckBy = (
  wars: Wars,
  engaged: Engaged,
  present: readonly Engaged[]
): TaskForce => {
  const enemies = present.filter((other) => hostile(wars, engaged, other));
  const salvoes = enemies.map((enemy) => ({
    fire: fireOf(enemy),
    targets: present.filter((other) => hostile(wars, enemy, other)),
  }));
  return {
    ...engaged.force,
    ships: engaged.force.ships.flatMap((ship) => {
      let damage = 0;
      for (const salvo of salvoes) {
        damage += aimedAt(salvo.fire, ship) * exposureOf(ship, salvo.targets);
      }
      return afloatAfter(ship, damage);
    }),
  };
};

/** Every task force at sea and fit to fight, grouped by the zone it is in. */
const byZone = (
  navies: readonly Navy[],
  guns: readonly number[],
  armouries: readonly Armoury[]
): ReadonlyMap<number, Engaged[]> => {
  const zones = new Map<number, Engaged[]>();
  for (const [nation, navy] of navies.entries()) {
    for (const [fleet, force] of navy.fleets.entries()) {
      if (force.zone === UNASSIGNED || force.mission === "repair") {
        continue;
      }
      const here = zones.get(force.zone) ?? [];
      here.push({
        armoury: itemAt(armouries, nation, OPENING_ARMOURY),
        fleet,
        force,
        guns: itemAt(guns, nation, 1),
        nation,
      });
      zones.set(force.zone, here);
    }
  }
  return zones;
};

/** What a day of battle at sea left behind. */
export interface SeaBattles {
  readonly navies: readonly Navy[];
  /** The zones a battle was fought in today. */
  readonly zones: ReadonlySet<number>;
  /** 1 where the task force at that nation's and fleet's place fought, by `nation * roles + fleet`. */
  readonly fought: Uint8Array;
}

/**
 * One day of every battle at sea: in each zone, every task force fires on the
 * task forces there of the nations its own is at war with, keeping the share
 * of its fire `guns` gives its nation and armed as `armouries` has its
 * nation, and a ship whose hull is gone sinks. A task force making for port
 * to repair slips past.
 */
export const foughtAtSea = (
  navies: readonly Navy[],
  wars: Wars,
  roles: number,
  guns: readonly number[],
  armouries: readonly Armoury[]
): SeaBattles => {
  const fought = new Uint8Array(navies.length * roles);
  const zones = new Set<number>();
  const struck = new Map<number, TaskForce>();
  for (const [zone, present] of byZone(navies, guns, armouries)) {
    for (const engaged of present) {
      if (!present.some((other) => hostile(wars, engaged, other))) {
        continue;
      }
      zones.add(zone);
      const key = engaged.nation * roles + engaged.fleet;
      fought[key] = 1;
      struck.set(key, struckBy(wars, engaged, present));
    }
  }
  return {
    fought,
    navies: navies.map((navy, nation) => ({
      ...navy,
      fleets: navy.fleets.map(
        (force, fleet) => struck.get(nation * roles + fleet) ?? force
      ),
    })),
    zones,
  };
};

/** Whether the task force at `nation`'s place `fleet` fought today. */
export const foughtToday = (
  battles: SeaBattles,
  roles: number,
  nation: number,
  fleet: number
): boolean => valueAt(battles.fought, nation * roles + fleet) === 1;
