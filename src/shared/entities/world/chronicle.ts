import type { AgencyProject } from "./agency";
import type { Aircraft, Aviation } from "./aircraft";
import type { ConscriptionLaw, IndustryPlan } from "./economy";
import type { FocusId } from "./focus";
import type { Operation } from "./operations";
import type { Settlement } from "./peace";
import type { ShipyardOrder } from "./ships";
import type { Stance } from "./stance";
import type { TechId } from "./techs";
import type { TradeLaw } from "./trade";

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
      readonly kind: "justify";
      readonly nation: number;
      readonly target: number;
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
    }
  | {
      readonly kind: "trade";
      readonly nation: number;
      readonly law: TradeLaw;
    }
  | {
      readonly kind: "shipbuilding";
      readonly nation: number;
      readonly order: ShipyardOrder;
    }
  | {
      readonly kind: "aircraft";
      readonly nation: number;
      readonly aircraft: Aircraft;
    }
  | {
      readonly kind: "build-site";
      readonly nation: number;
      /** The province its factories go up in. */
      readonly province: number;
    }
  | {
      readonly kind: "aviation";
      readonly nation: number;
      readonly aviation: Aviation;
    }
  | {
      readonly kind: "agency";
      readonly nation: number;
      readonly project: AgencyProject;
    }
  | {
      readonly kind: "espionage";
      readonly nation: number;
      /** The nation its operatives go to, or -1 for counter-intelligence at home. */
      readonly target: number;
    }
  | {
      readonly kind: "operation";
      readonly nation: number;
      readonly target: number;
      readonly operation: Operation;
      /** How many of its operatives were caught as it ended. */
      readonly captured: number;
    }
  | {
      readonly kind: "captured";
      /** The nation that caught the operative. */
      readonly nation: number;
      /** The nation whose operative it was. */
      readonly spy: number;
    }
  | {
      readonly kind: "cipher";
      readonly nation: number;
      /** The nation whose cipher it broke. */
      readonly target: number;
    }
  | {
      readonly kind: "landing";
      readonly nation: number;
      /** The coast the divisions went ashore on. */
      readonly target: number;
      /** Whose coast it was. */
      readonly defender: number;
    }
  | {
      readonly kind: "white-peace";
      readonly one: number;
      readonly other: number;
    };

/**
 * What a government decides month by month and a surrendered nation's victor
 * dictates, which is everything that goes through a ruling. A landing, a
 * white peace, an operation, a caught operative and a broken cipher come out
 * of the day's own step, so no ruling carries them out.
 */
export type Order = Exclude<
  Decision,
  { kind: "landing" | "white-peace" | "operation" | "captured" | "cipher" }
>;

/** Who made a decision: Jev, with how sure it was, or the built-in rules. */
export type Source =
  | { readonly kind: "jev"; readonly probability: number }
  | { readonly kind: "rules" };

export const BY_RULES: Source = { kind: "rules" };

/** A decision and who made it. */
export interface Ruling<Decided extends Decision = Decision> {
  readonly decision: Decided;
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
 * peaces between nations, a nation's laws, plans and stances, its research
 * and focus tree, its landings, or its agency and operatives.
 */
type Strand =
  | "diplomacy"
  | "policy"
  | "advancement"
  | "operations"
  | "intelligence";

const STRAND_OF = {
  agency: "intelligence",
  aircraft: "policy",
  aviation: "policy",
  "build-site": "policy",
  captured: "intelligence",
  cipher: "intelligence",
  conscription: "policy",
  declare: "diplomacy",
  espionage: "intelligence",
  focus: "advancement",
  join: "diplomacy",
  justify: "diplomacy",
  landing: "operations",
  operation: "intelligence",
  peace: "diplomacy",
  plan: "policy",
  research: "advancement",
  shipbuilding: "policy",
  stance: "policy",
  trade: "policy",
  "white-peace": "diplomacy",
} satisfies Readonly<Record<Decision["kind"], Strand>>;

/**
 * How many entries of each strand the chronicle keeps, the newest first. A
 * strand past its cap drops only its own oldest entries, so neither research
 * nor a change of stance pushes out a declaration or a peace.
 */
const STRAND_LENGTH = {
  advancement: 60,
  diplomacy: 60,
  intelligence: 60,
  operations: 60,
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
