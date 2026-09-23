import { valueAt } from "./grid";
import type { NationPair } from "./nations";

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

/** The same wars with `flag` written for the two of `pair`, both ways round. */
const withPair = (wars: Wars, pair: NationPair, flag: 0 | 1): Wars => {
  const fighting = Uint8Array.from(wars.fighting);
  fighting[pair.one * wars.nations + pair.other] = flag;
  fighting[pair.other * wars.nations + pair.one] = flag;
  return { fighting, nations: wars.nations };
};

/** The same wars with one more between `one` and `other`. */
export const declared = (wars: Wars, pair: NationPair): Wars =>
  withPair(wars, pair, 1);

/** The same wars with the two of `pair` at peace with each other. */
export const peaceBetween = (wars: Wars, pair: NationPair): Wars =>
  withPair(wars, pair, 0);

/** The same wars with `nation` at peace with everybody. */
export const peaceFor = (wars: Wars, nation: number): Wars => {
  const fighting = Uint8Array.from(wars.fighting);
  fighting.fill(0, nation * wars.nations, (nation + 1) * wars.nations);
  for (let other = 0; other < wars.nations; other += 1) {
    fighting[other * wars.nations + nation] = 0;
  }
  return { fighting, nations: wars.nations };
};

/** How many wars are being fought, each pair of enemies counted once. */
export const warCount = (wars: Wars): number =>
  wars.fighting.reduce((total, flag) => total + flag, 0) / 2;
