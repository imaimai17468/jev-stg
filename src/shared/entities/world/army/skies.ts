import type { Airspace } from "../airspace";
import { regionOfProvince } from "../airspace";
import type { Diplomacy } from "../diplomacy/diplomacy";
import { allied } from "../diplomacy/diplomacy";
import { valueAt } from "../grid";
import { atWar } from "../wars";

/** The air power every nation flies over each region, and who is fighting whom there. */
export interface Skies {
  /** Each nation's air power over each region, by nation id and then region id. */
  readonly power: readonly Float32Array[];
  readonly diplomacy: Diplomacy;
}

/**
 * How the sky over each region divides for one nation, by region id: the
 * share of the air power there its side holds, which is its air superiority,
 * and the share its enemies hold. A side alone in a sky holds all of it and a
 * side with nothing in the air none of it. The wiki compares the two sides'
 * air power and gives no formula for the ratio, so the plain share is this
 * game's own reading.
 */
export interface Superiority {
  readonly own: Float32Array;
  readonly enemy: Float32Array;
}

/** `power` added into `side`, region by region. */
const addInto = (side: Float32Array, power: Float32Array): void => {
  for (const [region, flown] of power.entries()) {
    side[region] = valueAt(side, region) + flown;
  }
};

/** The share `held` is of it and `other` together, none where both are nothing. */
const shareOf = (held: number, other: number): number =>
  held / Math.max(Number.MIN_VALUE, held + other);

/** How the sky over every region divides for `nation`. */
export const superiorityOf = (skies: Skies, nation: number): Superiority => {
  const regions = Math.max(0, ...skies.power.map((power) => power.length));
  const own = new Float32Array(regions);
  const enemy = new Float32Array(regions);
  for (const [other, power] of skies.power.entries()) {
    if (allied(skies.diplomacy, nation, other)) {
      addInto(own, power);
    }
    if (atWar(skies.diplomacy.wars, nation, other)) {
      addInto(enemy, power);
    }
  }
  return {
    enemy: enemy.map((held, region) => shareOf(held, valueAt(own, region))),
    own: own.map((held, region) => shareOf(held, valueAt(enemy, region))),
  };
};

/**
 * Hearts of Iron IV's penalty to a side's land combat for every point of air
 * superiority its enemy holds above half, which reaches 35% at all of it.
 * The wiki names the point an "advantage" without defining it, and its
 * example of 7% at 60% reads it as the superiority above 50%.
 */
const COMBAT_PENALTY_PER_POINT = 0.007;
const CONTESTED = 0.5;
const PERCENT = 100;

/**
 * The share of their worth in battle divisions keep under the air
 * superiority `enemy` their enemies hold over them.
 */
export const combatKeptUnder = (enemy: number): number =>
  1 - COMBAT_PENALTY_PER_POINT * PERCENT * Math.max(0, enemy - CONTESTED);

/**
 * Hearts of Iron IV's most penalty to the speed of divisions under the enemy's
 * air superiority, 30% at all of it. The wiki gives no curve up to it, so it
 * grows over the same superiority above half as the combat penalty does.
 */
const MOST_SPEED_PENALTY = 0.3;

/** The share of their speed divisions keep under the enemy air superiority `enemy`. */
export const paceUnder = (enemy: number): number =>
  1 - (MOST_SPEED_PENALTY * Math.max(0, enemy - CONTESTED)) / (1 - CONTESTED);

/** The skies laid over the provinces, by nation id and then province id. */
export interface SkiesBelow {
  /**
   * Each nation's air superiority over each province, which is what its
   * ships' hold over a sea zone gains: a share of their weight from none to
   * all of it, Hearts of Iron IV's most of +100%. The wiki reaches that most
   * at full superiority and gives no curve up to it, so the bonus is the
   * superiority itself.
   */
  readonly lift: readonly Float32Array[];
  /** The air superiority each nation's enemies hold over each province, which its divisions fight and march under. */
  readonly enemy: readonly Float32Array[];
}

/** A reading by region laid over every one of `provinces` by the region it lies in. */
const overProvinces = (
  byRegion: Float32Array,
  airspace: Airspace,
  provinces: number
): Float32Array =>
  Float32Array.from({ length: provinces }, (_, province) =>
    valueAt(byRegion, regionOfProvince(airspace, province))
  );

/** How the skies divide over every province, for every nation. */
export const skiesBelow = (
  skies: Skies,
  airspace: Airspace,
  provinces: number
): SkiesBelow => {
  const shares = skies.power.map((_, nation) => superiorityOf(skies, nation));
  return {
    enemy: shares.map((share) =>
      overProvinces(share.enemy, airspace, provinces)
    ),
    lift: shares.map((share) => overProvinces(share.own, airspace, provinces)),
  };
};

/** Enemy air superiority above this share counts as a sky lost, where the wiki's colours turn to the enemy's. */
const LOST_ABOVE = 0.6;

/**
 * The share of the regions both `nation`'s side and its enemies fly over
 * where the enemies hold its side under air superiority, from 0 to 1, and
 * none where the two sides meet nowhere. A sky only the enemy flies is one
 * the nation never fought for, so it is left out.
 */
export const skyLostBy = (skies: Skies, nation: number): number => {
  const { enemy, own } = superiorityOf(skies, nation);
  const fought = enemy.filter(
    (share, region) => share > 0 && valueAt(own, region) > 0
  );
  return (
    fought.filter((share) => share > LOST_ABOVE).length /
    Math.max(1, fought.length)
  );
};
