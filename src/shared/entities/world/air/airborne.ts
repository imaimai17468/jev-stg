import { Option } from "effect";
import type { Airspace } from "../airspace";
import { provincesInRangeOf, regionOfProvince } from "../airspace";
import type { Division } from "../army/divisions";
import { dropWornOff, paradropped } from "../army/divisions";
import { enemyNeighbours } from "../army/front";
import { valueAt } from "../grid";
import type { ProvinceGraph } from "../provinces";
import { isLand } from "../provinces";
import type { Wars } from "../wars";
import { atWar, enemiesOf } from "../wars";
import type { AirForce } from "./air-force";
import { aircraftOf } from "./air-force";

/**
 * The transport planes a paradrop takes for each division in it, and the
 * fewest any drop takes, after Hearts of Iron IV's
 * `BASE_UNIT_WEIGHT_IN_TRANSPORT_PLANES` and `MIN_PLANE_COUNT_PARADROP`.
 */
export const TRANSPORTS_PER_DIVISION = 45;
const FEWEST_TRANSPORTS = 50;

/** The transport planes it takes to drop `divisions` paratrooper divisions at once, none for none. */
export const transportsFor = (divisions: number): number =>
  Math.max(
    FEWEST_TRANSPORTS * Number(divisions > 0),
    TRANSPORTS_PER_DIVISION * divisions
  );

/**
 * The share of the sky over a drop's base and its target a nation's side has
 * to hold, after Hearts of Iron IV's `PARADROP_AIR_SUPERIORITY_RATIO`.
 */
export const DROP_SUPERIORITY = 0.7;

/** A paradrop that went in today: whose, from which air base, onto where, and with whom. */
export interface Drop {
  readonly nation: number;
  readonly base: number;
  readonly target: number;
  readonly divisions: readonly Division[];
}

/** What a paradrop reads of the world on the day it goes in. */
export interface DropZone {
  readonly graph: ProvinceGraph;
  readonly airspace: Airspace;
  readonly owners: Int32Array;
  readonly wars: Wars;
  /** The share of the sky over each province `nation`'s enemies hold, from 0 to 1. */
  readonly enemySky: (nation: number, province: number) => number;
}

/** The divisions after the day's paradrops, and the drops that went in. */
export interface Airborne {
  readonly divisions: readonly Division[];
  readonly drops: readonly Drop[];
}

/** Whether `nation`'s side holds enough of the sky over `province` for a paradrop to fly there. */
const skyOpen = (zone: DropZone, nation: number, province: number): boolean =>
  zone.enemySky(nation, province) <= 1 - DROP_SUPERIORITY;

/**
 * The paratroopers among `nation`'s `own` divisions free to drop: answering
 * to the line rather than regrouping or garrisoning, standing on its own
 * ground out of reach of its enemies, over the penalties of their last drop.
 */
const readyToDrop = (
  zone: DropZone,
  nation: number,
  own: readonly Division[]
): readonly Division[] =>
  own.filter(
    (division) =>
      division.kind === "paratroopers" &&
      division.task === "line" &&
      division.dropped === 0 &&
      valueAt(zone.owners, division.province) === nation &&
      enemyNeighbours(
        zone.graph,
        zone.owners,
        zone.wars,
        nation,
        division.province
      ).length === 0
  );

/** The transport planes `airForce` has at each air base, by province id. */
const transportsByBase = (airForce: AirForce): ReadonlyMap<number, number> => {
  const byBase = new Map<number, number>();
  for (const wing of airForce.wings) {
    if (aircraftOf(wing) !== "transport") {
      continue;
    }
    byBase.set(wing.base, (byBase.get(wing.base) ?? 0) + wing.planes);
  }
  return byBase;
};

/** The most paratrooper divisions `planes` transport planes drop at once. */
const carriedBy = (planes: number): number =>
  Math.max(
    0,
    Math.floor(planes / TRANSPORTS_PER_DIVISION) -
      Number(planes < FEWEST_TRANSPORTS)
  );

/** The men standing in each province, of any nation, by province id. */
const guardedBy = (
  divisions: readonly Division[]
): ReadonlyMap<number, number> => {
  const guarded = new Map<number, number>();
  for (const division of divisions) {
    guarded.set(
      division.province,
      (guarded.get(division.province) ?? 0) + division.strength
    );
  }
  return guarded;
};

/**
 * The enemy province `nation` drops onto from `base`: of the land its enemies
 * hold within the base's range under a sky its side holds enough of, the one
 * with the fewest men standing on it, then the lowest id.
 */
export const dropTargetFor = (
  zone: DropZone,
  guarded: ReadonlyMap<number, number>,
  nation: number,
  base: number
): Option.Option<number> =>
  Option.fromIterable(
    provincesInRangeOf(zone.airspace, regionOfProvince(zone.airspace, base))
      .filter(
        (province) =>
          isLand(zone.graph, province) &&
          atWar(zone.wars, nation, valueAt(zone.owners, province)) &&
          skyOpen(zone, nation, province)
      )
      .toSorted(
        (one, other) =>
          (guarded.get(one) ?? 0) - (guarded.get(other) ?? 0) || one - other
      )
  );

/**
 * One day of paradrops. Every division is first a day further from its last
 * drop. Then each nation at war drops from each of its air bases, lowest
 * first, whose sky its side holds enough of: as many of its paratroopers
 * ready to drop as the transport planes there carry, onto the target
 * `dropTargetFor` picks, each paratrooper dropping at most once. Hearts of
 * Iron IV asks that the paratroopers wait at the air base; this world's
 * divisions never march to one, so any of the nation's ready paratroopers go.
 */
export const paradropsOneDay = (
  zone: DropZone,
  airForces: readonly AirForce[],
  divisions: readonly Division[]
): Airborne => {
  const rested = divisions.map(dropWornOff);
  const guarded = guardedBy(rested);
  const flown = new Map<Division, number>();
  const drops: Drop[] = [];
  for (const [nation, airForce] of airForces.entries()) {
    if (enemiesOf(zone.wars, nation).length === 0) {
      continue;
    }
    let ready = readyToDrop(
      zone,
      nation,
      rested.filter((division) => division.nation === nation)
    );
    const bases = [...transportsByBase(airForce)].toSorted(
      ([one], [other]) => one - other
    );
    for (const [base, planes] of bases) {
      const count = Math.min(ready.length, carriedBy(planes));
      const target = dropTargetFor(zone, guarded, nation, base);
      if (
        count === 0 ||
        !skyOpen(zone, nation, base) ||
        Option.isNone(target)
      ) {
        continue;
      }
      const aboard = ready.slice(0, count);
      ready = ready.slice(count);
      for (const division of aboard) {
        flown.set(division, target.value);
      }
      drops.push({ base, divisions: aboard, nation, target: target.value });
    }
  }
  return {
    divisions: rested.map((division) =>
      Option.match(Option.fromUndefinedOr(flown.get(division)), {
        onNone: () => division,
        onSome: (target) => paradropped(division, target),
      })
    ),
    drops,
  };
};
