import type { Aircraft } from "./aircraft";
import { airframeOf } from "./aircraft";
import { valueAt } from "./grid";
import type { Wars } from "./wars";
import { atWar } from "./wars";

/** A group of one nation's planes of one kind in the sky over one region. */
export interface Flight {
  readonly nation: number;
  readonly aircraft: Aircraft;
  readonly planes: number;
  /** The share of its planes that fly, from 0 to 1: its mission efficiency. */
  readonly efficiency: number;
}

/**
 * How many air battles a day holds, after Hearts of Iron IV's one every
 * eight hours.
 */
const BATTLES_PER_DAY = 3;

/**
 * Hearts of Iron IV's air combat: an attacking wing sends no more planes
 * than three times the enemy it has in sight, puts a fifth of its air attack
 * per plane into its fire, loses some of it to a more agile target and gains
 * some for being the faster, and every point of fire that lands destroys a
 * hundredth of a plane for each point of the target's air defence.
 */
const MOST_ATTACKERS_PER_TARGET = 3;
const FIRE_PER_ATTACK = 0.2;
const AGILITY_MITIGATION = 0.45;
const MOST_AGILITY_RATIO = 4;
const RELATIVE_SPEED_BONUS = 0.65;
const MOST_SPEED_RATIO = 3.5;
const ABSOLUTE_SPEED_BONUS = 0.025;
const MOST_ABSOLUTE_SPEED = 800;
const SPEED_UNIT = 100;
const PLANES_PER_FIRE = 0.01;
const LEAST_LOSS = 0.001;

/**
 * The planes `attackers` of `attacker`'s kind bring down of `target`'s kind
 * in one air battle, after the wiki's formula.
 */
export const destroyedIn = (
  attackers: number,
  attacker: Aircraft,
  target: Aircraft
): number => {
  const shooter = airframeOf(attacker);
  const hunted = airframeOf(target);
  const fire = attackers * shooter.airAttack * FIRE_PER_ATTACK;
  const mitigated =
    fire *
    AGILITY_MITIGATION *
    Math.max(
      Math.min(hunted.agility / shooter.agility, MOST_AGILITY_RATIO) - 1,
      0
    );
  const faster =
    fire *
    RELATIVE_SPEED_BONUS *
    Math.max(Math.min(shooter.speed / hunted.speed, MOST_SPEED_RATIO) - 1, 0);
  const swift =
    (fire *
      ABSOLUTE_SPEED_BONUS *
      Math.min(shooter.speed, MOST_ABSOLUTE_SPEED)) /
    SPEED_UNIT;
  return Math.max(
    ((fire - mitigated + faster + swift) * PLANES_PER_FIRE) / hunted.airDefence,
    LEAST_LOSS
  );
};

/** The planes of one nation's one kind in a battle, flying as one. */
interface Group {
  readonly nation: number;
  readonly aircraft: Aircraft;
  /** The planes in it. */
  readonly planes: number;
  /** The planes it sends out, its planes cut by their mission efficiency. */
  readonly flying: number;
}

/** `flights` gathered into one group for each nation and kind, in the order each first appears. */
const groupsOf = (flights: readonly Flight[]): readonly Group[] => {
  const groups = new Map<string, Group>();
  for (const flight of flights) {
    const key = `${flight.nation}:${flight.aircraft}`;
    const group = groups.get(key) ?? {
      aircraft: flight.aircraft,
      flying: 0,
      nation: flight.nation,
      planes: 0,
    };
    groups.set(key, {
      ...group,
      flying: group.flying + flight.planes * flight.efficiency,
      planes: group.planes + flight.planes,
    });
  }
  return [...groups.values()];
};

/**
 * The planes each group loses in one air battle, in the same order: each
 * group fires on every group of a nation it is at war with, spreading what it
 * sends out over them by their numbers.
 */
const lossesInOneBattle = (
  groups: readonly Group[],
  wars: Wars
): Float64Array => {
  const losses = new Float64Array(groups.length);
  for (const group of groups) {
    const hostile = [...groups.entries()].filter(([, other]) =>
      atWar(wars, group.nation, other.nation)
    );
    const enemyPlanes = hostile.reduce(
      (total, [, other]) => total + other.planes,
      0
    );
    const attackers = Math.min(
      group.flying,
      MOST_ATTACKERS_PER_TARGET * enemyPlanes
    );
    if (attackers === 0) {
      continue;
    }
    for (const [index, other] of hostile) {
      losses[index] =
        valueAt(losses, index) +
        destroyedIn(
          (attackers * other.planes) / enemyPlanes,
          group.aircraft,
          other.aircraft
        );
    }
  }
  return losses;
};

/**
 * What is left of each of `flights` after a day of air battles over one
 * region. The planes of one nation and one kind fly as one group; every group
 * fires on every group of a nation it is at war with, all of them at once
 * before the losses come off; and a group's losses come off its flights by
 * their numbers.
 */
export const foughtInTheAir = (
  flights: readonly Flight[],
  wars: Wars
): readonly Flight[] => {
  let current = flights;
  for (let battle = 0; battle < BATTLES_PER_DAY; battle += 1) {
    const groups = groupsOf(current);
    const losses = lossesInOneBattle(groups, wars);
    const shareLost = Float64Array.from(groups, (group, index) =>
      Math.min(1, valueAt(losses, index) / Math.max(group.planes, 1e-9))
    );
    current = current.map((flight) => ({
      ...flight,
      planes:
        flight.planes *
        (1 -
          valueAt(
            shareLost,
            groups.findIndex(
              (group) =>
                group.nation === flight.nation &&
                group.aircraft === flight.aircraft
            )
          )),
    }));
  }
  return current;
};
