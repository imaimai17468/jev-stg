import type { ConscriptionLaw, IndustryPlan } from "./economy";
import type { Settlement } from "./peace";
import type { Stance } from "./stance";

/** One thing a government decided. */
export type Decision =
  | {
      readonly kind: "conscription";
      readonly nation: number;
      readonly law: ConscriptionLaw;
    }
  | {
      readonly kind: "plan";
      readonly nation: number;
      readonly plan: IndustryPlan;
    }
  | {
      readonly kind: "stance";
      readonly nation: number;
      readonly stance: Stance;
    }
  | {
      readonly kind: "declare";
      readonly nation: number;
      readonly target: number;
    }
  | { readonly kind: "join"; readonly nation: number; readonly faction: number }
  | {
      readonly kind: "peace";
      readonly loser: number;
      readonly settlement: Settlement;
    };

/** Who made a decision: Jev, with how sure it was, or the built-in rules. */
export type Source =
  | { readonly kind: "jev"; readonly probability: number }
  | { readonly kind: "rules" };

export const BY_RULES: Source = { kind: "rules" };

/** A decision and who made it. */
export interface Ruling {
  readonly decision: Decision;
  readonly source: Source;
}

/** A ruling the world carried out, on the day it did. */
interface Carried {
  /** Days since the start date. */
  readonly day: number;
  readonly ruling: Ruling;
}

/** A ruling in the chronicle, numbered in the order it went in. */
export interface Entry extends Carried {
  /** One more than the entry before it, so no two entries share one. */
  readonly seq: number;
}

/** How many entries the chronicle keeps, the newest first. */
const CHRONICLE_LENGTH = 60;

/** The chronicle with `carried` added at the front and the oldest past the cap gone. */
export const chronicled = (
  chronicle: readonly Entry[],
  carried: Carried
): readonly Entry[] => {
  const newest = chronicle.slice(0, 1).map((entry) => entry.seq);
  const seq = Math.max(-1, ...newest) + 1;
  return [{ ...carried, seq }, ...chronicle].slice(0, CHRONICLE_LENGTH);
};

/**
 * A nation that has surrendered and waits to hear its terms, with the terms it
 * signs when nobody names others in time.
 */
export interface Negotiation {
  readonly loser: number;
  readonly fallback: Settlement;
  /** Days since the start date, on the day it surrendered. */
  readonly openedOn: number;
}
