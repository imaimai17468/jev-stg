import { valueAt } from "../grid";
import type { ProvinceGraph } from "../provinces";
import { isLand, neighboursOf } from "../provinces";

/**
 * How strong each nation's intelligence network is in each province, from 0
 * to 100, by nation id and then province id. A nation has one network for
 * the whole world, so what it built in one country stays where it was built
 * when its operatives move on to another.
 */
export type Networks = readonly Float32Array[];

/** Every nation with no network anywhere yet. */
export const noNetworks = (nations: number, provinces: number): Networks =>
  Array.from({ length: nations }, () => new Float32Array(provinces));

/** The strongest a network grows in a province, after Hearts of Iron IV. */
const MOST_STRENGTH = 100;

/**
 * The strength from which a network counts in a province, after Hearts of
 * Iron IV's rule that its modifiers apply at 10 and above.
 */
export const NETWORK_FLOOR = 10;

/** What one operative building a network adds in a day, after Hearts of Iron IV. */
const GAIN_PER_OPERATIVE = 0.4;

/**
 * The share of the gain each step away from where the operatives work keeps,
 * how many steps away it still reaches, and how much a province with nobody
 * building there loses a day. Hearts of Iron IV's wiki says a network
 * spreads to the states around the one it is built in without giving a rate,
 * and names no decay, so these three are this game's own.
 */
const KEPT_PER_STEP = 0.5;
const MOST_STEPS = 4;
const DECAY_PER_DAY = 0.05;

/**
 * How much each point of the host's counter-intelligence slows a network.
 * The wiki says counter-intelligence holds a network down without a number,
 * so this is this game's own.
 */
const DRAG_PER_COUNTER_INTELLIGENCE = 0.25;

/** Where a nation's operatives build its network today, and how fast. */
export interface Build {
  /** The province they work from. */
  readonly center: number;
  /** The nation whose ground they build on, which the network does not spread past. */
  readonly host: number;
  /** How many operatives are building. */
  readonly operatives: number;
  /** The counter-intelligence the host fields against them. */
  readonly counterIntelligence: number;
}

/**
 * What a day of `build` adds to each province it reaches, by province id:
 * its full gain where the operatives work, halving at every step out over the
 * host's land, and nothing past the fourth step or off the host's ground.
 */
const gainsOf = (
  build: Build,
  graph: ProvinceGraph,
  owners: Int32Array
): ReadonlyMap<number, number> => {
  const gains = new Map<number, number>();
  const full =
    (GAIN_PER_OPERATIVE * build.operatives) /
    (1 + DRAG_PER_COUNTER_INTELLIGENCE * build.counterIntelligence);
  let ring = [build.center];
  let gain = full;
  gains.set(build.center, gain);
  for (let step = 1; step <= MOST_STEPS; step += 1) {
    gain *= KEPT_PER_STEP;
    const next: number[] = [];
    for (const province of ring) {
      for (const beside of neighboursOf(graph, province)) {
        if (
          gains.has(beside) ||
          !isLand(graph, beside) ||
          valueAt(owners, beside) !== build.host
        ) {
          continue;
        }
        gains.set(beside, gain);
        next.push(beside);
      }
    }
    ring = next;
  }
  return gains;
};

/**
 * One nation's network one day on: every province `build` reaches gains its
 * share, up to the most a network grows, and every other province loses a
 * little, down to nothing. With no build, every province loses.
 */
export const networkBuiltOneDay = (
  network: Float32Array,
  build: readonly Build[],
  graph: ProvinceGraph,
  owners: Int32Array
): Float32Array => {
  const next = new Float32Array(network.length);
  for (let province = 0; province < network.length; province += 1) {
    next[province] = Math.max(0, valueAt(network, province) - DECAY_PER_DAY);
  }
  const gained = new Map<number, number>();
  for (const one of build) {
    for (const [province, gain] of gainsOf(one, graph, owners)) {
      gained.set(province, (gained.get(province) ?? 0) + gain);
    }
  }
  for (const [province, gain] of gained) {
    next[province] = Math.min(MOST_STRENGTH, valueAt(network, province) + gain);
  }
  return next;
};
