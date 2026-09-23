import type { ConscriptionLaw, IndustryPlan } from "./economy";
import type { FocusId } from "./focus";
import type { Settlement } from "./peace";
import type { TechId } from "./research";
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
      readonly kind: "research";
      readonly nation: number;
      readonly tech: TechId;
    }
  | { readonly kind: "focus"; readonly nation: number; readonly focus: FocusId }
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

/**
 * Which run of the chronicle an entry counts against: the wars, factions and
 * peaces between nations, a nation's laws, plans and stances, or its research
 * and focus tree.
 */
type Strand = "diplomacy" | "policy" | "advancement";

const STRAND_OF = {
  conscription: "policy",
  declare: "diplomacy",
  focus: "advancement",
  join: "diplomacy",
  peace: "diplomacy",
  plan: "policy",
  research: "advancement",
  stance: "policy",
} satisfies Readonly<Record<Decision["kind"], Strand>>;

/**
 * How many entries of each strand the chronicle keeps, the newest first. A
 * strand past its cap drops only its own oldest entries, so neither research
 * nor a change of stance pushes out a declaration or a peace.
 */
const STRAND_LENGTH = {
  advancement: 60,
  diplomacy: 60,
  policy: 60,
} satisfies Readonly<Record<Strand, number>>;

/**
 * The chronicle with `carried` added at the front and, in each strand, the
 * oldest past that strand's cap gone.
 */
export const chronicled = (
  chronicle: readonly Entry[],
  carried: Carried
): readonly Entry[] => {
  const newest = chronicle.slice(0, 1).map((entry) => entry.seq);
  const seq = Math.max(-1, ...newest) + 1;
  const counted = new Map<Strand, number>();
  const kept: Entry[] = [];
  for (const entry of [{ ...carried, seq }, ...chronicle]) {
    const strand = STRAND_OF[entry.ruling.decision.kind];
    const count = (counted.get(strand) ?? 0) + 1;
    counted.set(strand, count);
    if (count <= STRAND_LENGTH[strand]) {
      kept.push(entry);
    }
  }
  return kept;
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
