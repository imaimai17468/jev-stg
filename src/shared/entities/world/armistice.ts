import type { Division } from "./army/divisions";
import type { NationPair } from "./geography/nations";
import { neighbouringNations } from "./geography/nations";
import type { World } from "./geography/world";
import { valueAt } from "./grid";
import { UNASSIGNED } from "./spread";
import type { Wars } from "./wars";
import { atWar } from "./wars";

/**
 * The days two nations at war can go without touching each other before they
 * sign a white peace. Hearts of Iron IV ends a war only by capitulation, and a
 * war nobody can reach never gets there, so this is this game's own.
 */
const QUIET_DAYS = 180;

/**
 * How many days each pair of nations at war has gone without touching, as a
 * square symmetric table of nation ids, and zero for a pair at peace.
 */
export type Quiet = Int32Array;

export const noQuiet = (nations: number): Quiet =>
  new Int32Array(nations * nations);

/**
 * The table one day on: a day longer for every pair at war that did not touch
 * today, and back to zero for a pair that did or is at peace. `touched` reads
 * a pair whichever way round it is asked.
 */
export const quietOneDay = (
  quiet: Quiet,
  wars: Wars,
  touched: (one: number, other: number) => boolean
): Quiet =>
  Int32Array.from(quiet, (days, cell) => {
    const one = Math.floor(cell / wars.nations);
    const other = cell % wars.nations;
    if (!atWar(wars, one, other) || touched(one, other)) {
      return 0;
    }
    return days + 1;
  });

/** The pairs at war that have gone long enough without touching to sign a white peace. */
export const armisticesDue = (
  quiet: Quiet,
  nations: number
): readonly NationPair[] => {
  const due: NationPair[] = [];
  for (let one = 0; one < nations; one += 1) {
    for (let other = one + 1; other < nations; other += 1) {
      if (valueAt(quiet, one * nations + other) >= QUIET_DAYS) {
        due.push({ one, other });
      }
    }
  }
  return due;
};

/**
 * The pairs in `pairs` as a square symmetric table of nation ids, 1 where a
 * pair is named, leaving out a pair whose second is ground nobody holds.
 */
const contactsOf = (
  nations: number,
  pairs: readonly NationPair[]
): Uint8Array => {
  const touched = new Uint8Array(nations * nations);
  for (const pair of pairs) {
    if (pair.other === UNASSIGNED) {
      continue;
    }
    touched[pair.one * nations + pair.other] = 1;
    touched[pair.other * nations + pair.one] = 1;
  }
  return touched;
};

/**
 * Whether two nations touched today, whichever way round they are asked:
 * their ground borders, or a division of one stands on the other's ground. A
 * division on ground nobody holds touches nobody, and a landing still in
 * preparation touches nobody, so a war whose landings never find the sea
 * clear still ends.
 */
export const touchedBetween = (
  world: World,
  owners: Int32Array,
  divisions: readonly Division[]
): ((one: number, other: number) => boolean) => {
  const nations = world.nations.length;
  const touched = contactsOf(nations, [
    ...neighbouringNations(world, owners),
    ...divisions.map((division) => ({
      one: division.nation,
      other: valueAt(owners, division.province),
    })),
  ]);
  return (one, other) => valueAt(touched, one * nations + other) === 1;
};
