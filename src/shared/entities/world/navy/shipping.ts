import type { Diplomacy } from "../diplomacy";
import { itemAt } from "../lookup";
import type { ProvinceGraph } from "../provinces";
import { atWar } from "../wars";
import type { Lane, Navy } from "./navy";
import { enemyHoldIn } from "./navy";
import { laneBetween } from "./seas";

/** The convoys one lane asks for, and between which waters it runs. */
export interface Voyage {
  readonly cargo: Lane["cargo"];
  /** The sea zones off the ports the convoys leave from. */
  readonly from: readonly number[];
  /** The sea zones off the ports they sail to. */
  readonly to: readonly number[];
  /** The convoys it takes to carry everything the lane is asked to. */
  readonly need: number;
}

/** What one nation's convoys are asked to do today. */
export interface Sailings {
  /** The convoys it holds back for a landing being prepared. */
  readonly reserved: number;
  /** Its lanes, supply first and then trade. */
  readonly voyages: readonly Voyage[];
}

/** What the convoys run into at sea. */
export interface Waters {
  readonly graph: ProvinceGraph;
  readonly diplomacy: Diplomacy;
  /** Every nation's weight over each zone, by nation id and then province id. */
  readonly all: readonly Float32Array[];
  /** The weight of every nation's raiders alone. */
  readonly raiders: readonly Float32Array[];
}

/**
 * The share of the convoys on a lane the enemy's raiders sink in a day where
 * they hold every zone of it. Hearts of Iron IV gives no loss rate, so this is
 * this game's own.
 */
const SUNK_PER_DAY = 0.02;

/** What the sea does to one lane today. */
interface Fate {
  /**
   * The share of what the lane is asked to carry that gets through: none where
   * no sea joins its ends, and otherwise as much as the zone the enemy holds
   * most of leaves.
   */
  readonly throughput: number;
  /**
   * The share of its convoys the enemy's raiders sink: as much as they hold
   * of the zone where they hold the most against everything the nation's side
   * has there.
   */
  readonly sunk: number;
}

/** What the sea does to `nation`'s lane across `zones` today. */
const laneFate = (
  waters: Waters,
  nation: number,
  zones: readonly number[]
): Fate => {
  const { diplomacy } = waters;
  const raided = {
    diplomacy,
    waters: waters.all.map((weights, other) => {
      if (!atWar(diplomacy.wars, nation, other)) {
        return weights;
      }
      return itemAt(waters.raiders, other, weights);
    }),
  };
  const sunk =
    SUNK_PER_DAY *
    Math.max(0, ...zones.map((zone) => enemyHoldIn(raided, nation, zone)));
  if (zones.length === 0) {
    return { sunk, throughput: 0 };
  }
  const held = zones.map((zone) =>
    enemyHoldIn({ diplomacy, waters: waters.all }, nation, zone)
  );
  return { sunk, throughput: 1 - Math.max(...held) };
};

/** One lane as run today: its zones, its convoys, and what it delivered. */
interface Run {
  readonly lane: Lane;
  /** The convoys it was asked for. */
  readonly need: number;
  /** The share of what it was asked to carry that arrived, from 0 to 1. */
  readonly delivered: number;
  /** The convoys sunk on it. */
  readonly sunk: number;
}

/**
 * Every lane of `sailings` run with the convoys `navy` has free: each takes
 * what it needs, in order, while any are left.
 */
const runLanes = (
  waters: Waters,
  nation: number,
  navy: Navy,
  sailings: Sailings
): readonly Run[] => {
  let free = Math.max(0, navy.convoys - sailings.reserved);
  return sailings.voyages.map((voyage) => {
    const convoys = Math.min(free, voyage.need);
    free -= convoys;
    const zones = laneBetween(waters.graph, voyage.from, voyage.to);
    const carried = convoys / Math.max(Number.MIN_VALUE, voyage.need);
    const fate = laneFate(waters, nation, zones);
    return {
      delivered: Math.min(1, carried) * fate.throughput,
      lane: { cargo: voyage.cargo, convoys, zones },
      need: voyage.need,
      sunk: convoys * fate.sunk,
    };
  });
};

/**
 * The share of what the lanes carrying `cargo` were asked for that arrived,
 * weighing each lane by what it was asked to carry, and all of it where
 * nothing was asked.
 */
const deliveredOf = (runs: readonly Run[], cargo: Lane["cargo"]): number => {
  let asked = 0;
  let arrived = 0;
  for (const run of runs) {
    if (run.lane.cargo !== cargo) {
      continue;
    }
    asked += run.need;
    arrived += run.need * run.delivered;
  }
  if (asked === 0) {
    return 1;
  }
  return arrived / asked;
};

/**
 * Every navy after a day of running its convoys: each lane takes its convoys
 * in turn, delivers as much as the enemy's hold over its waters lets through,
 * and loses the ones the enemy's raiders sink.
 */
export const shippedOneDay = (
  waters: Waters,
  navies: readonly Navy[],
  sailings: readonly Sailings[]
): readonly Navy[] =>
  navies.map((navy, nation) => {
    const orders = itemAt(sailings, nation, { reserved: 0, voyages: [] });
    const runs = runLanes(waters, nation, navy, orders);
    return {
      ...navy,
      convoys: navy.convoys - runs.reduce((total, run) => total + run.sunk, 0),
      lanes: runs.map((run) => run.lane),
      overseas: deliveredOf(runs, "supply"),
      traded: deliveredOf(runs, "trade"),
    };
  });

/** The convoys `navy` has on no lane and holds back for nothing. */
export const idleConvoys = (navy: Navy, reserved: number): number =>
  Math.max(
    0,
    navy.convoys -
      reserved -
      navy.lanes.reduce((total, lane) => total + lane.convoys, 0)
  );
