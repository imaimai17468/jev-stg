import { valueAt } from "./grid";
import type { World } from "./index";
import type { NationPair } from "./nations";
import { neighbouringNations } from "./nations";
import type { Random } from "./random";
import { shuffled } from "./random";

/** Who each nation is fighting, as a square symmetric table of nation ids. */
export interface Wars {
  readonly nations: number;
  /** 1 where the row's nation and the column's nation are at war. */
  readonly fighting: Uint8Array;
}

/** A world where nobody is fighting anybody. */
export const noWars = (nations: number): Wars => ({
  fighting: new Uint8Array(nations * nations),
  nations,
});

export const atWar = (wars: Wars, one: number, other: number): boolean =>
  valueAt(wars.fighting, one * wars.nations + other) === 1;

/** The nations `nation` is fighting, by id and in id order. */
export const enemiesOf = (wars: Wars, nation: number): readonly number[] =>
  Array.from({ length: wars.nations }, (_, other) => other).filter((other) =>
    atWar(wars, nation, other)
  );

/** The same wars with one more between `one` and `other`. */
export const declared = (wars: Wars, pair: NationPair): Wars => {
  const fighting = Uint8Array.from(wars.fighting);
  fighting[pair.one * wars.nations + pair.other] = 1;
  fighting[pair.other * wars.nations + pair.one] = 1;
  return { fighting, nations: wars.nations };
};

/** How many wars a world opens with. */
const WARS_AT_START = 3;

/**
 * The wars a world starts under.
 *
 * Nothing yet decides to declare one, so a world with none would never fight
 * and the ground would never change hands. These are drawn from the seed
 * between nations that share a border, and no nation is drawn twice, so each
 * war starts as one front between two powers.
 */
export const startWars = (
  world: World,
  owners: Int32Array,
  random: Random
): Wars => {
  const pairs = shuffled(neighbouringNations(world, owners), random);
  const drawn = new Set<number>();
  let wars = noWars(world.nations.length);
  for (const pair of pairs) {
    if (drawn.size >= WARS_AT_START * 2) {
      break;
    }
    if (drawn.has(pair.one) || drawn.has(pair.other)) {
      continue;
    }
    drawn.add(pair.one);
    drawn.add(pair.other);
    wars = declared(wars, pair);
  }
  return wars;
};
