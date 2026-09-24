import { Option } from "effect";
import type { Random } from "../random";
import type { IntelKind, IntelLevels } from "./intel";

/**
 * What a government believes another nation's forces come to: the sum of
 * what it can see, the widest error in that sum, and how many of the nations
 * it could not see at all.
 */
export interface Sighting {
  readonly estimate: number;
  /** The widest share either way any of the seen amounts may be off by, 0 where every one is exact. */
  readonly margin: number;
  /** The nations whose forces it has no figure for. */
  readonly unseen: number;
}

/** The kinds of intelligence a government reads other nations' forces by. */
type ForceKind = Exclude<IntelKind, "civilian">;

/** From how much intelligence of a kind a figure shows, and how far off it may be. */
interface Threshold {
  readonly from: number;
  readonly margin: number;
}

/**
 * Hearts of Iron IV's intel thresholds for the figures a government reads:
 * divisions show at ±80% from 5% of army intel, ±50% from 30% and exactly
 * from 70%; ships at ±50% from 10% of navy intel and exactly from 70%; air
 * wings at ±50% from 30% of air intel and exactly from 70%.
 */
const THRESHOLDS = {
  air: [
    { from: 0.3, margin: 0.5 },
    { from: 0.7, margin: 0 },
  ],
  army: [
    { from: 0.05, margin: 0.8 },
    { from: 0.3, margin: 0.5 },
    { from: 0.7, margin: 0 },
  ],
  navy: [
    { from: 0.1, margin: 0.5 },
    { from: 0.7, margin: 0 },
  ],
} satisfies Readonly<Record<ForceKind, readonly Threshold[]>>;

/** How far off a figure read with `level` of `kind` may be, or none where it does not show. */
const marginAt = (kind: ForceKind, level: number): Option.Option<number> =>
  Option.fromUndefinedOr(
    THRESHOLDS[kind].findLast((threshold) => level >= threshold.from)
  ).pipe(Option.map((threshold) => threshold.margin));

/** One nation's forces, and what the government looking knows of that nation. */
export interface Forces {
  readonly amount: number;
  readonly known: IntelLevels;
}

/**
 * What a government believes `forces` of `kind` come to: each nation it
 * sees is read off by a draw anywhere within its margin either way, and
 * each it does not see is counted as unseen. Every nation takes a draw,
 * seen or not, so what one is known to have never shifts another's error.
 */
export const sightingOf = (
  kind: ForceKind,
  forces: readonly Forces[],
  random: Random
): Sighting => {
  let estimate = 0;
  let margin = 0;
  let unseen = 0;
  for (const force of forces) {
    const draw = random.unit();
    const read = marginAt(kind, force.known[kind]);
    for (const off of Option.toArray(read)) {
      estimate += force.amount * (1 + off * (2 * draw - 1));
      margin = Math.max(margin, off);
    }
    unseen += Number(Option.isNone(read));
  }
  return { estimate, margin, unseen };
};
