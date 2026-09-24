import { Option, Schema } from "effect";
import type { NationEconomy } from "./economy/economy";
import type { Bonus } from "./modifiers";
import type { TreeStanding } from "./tree-standing";

/** The part of the national focus tree a focus sits in. */
export type FocusBranch = "industry" | "research" | "army" | "politics";

/** Every focus, in the order the tree lists them. */
export const FocusIdSchema = Schema.Literals([
  "industrialisation",
  "construction-effort",
  "production-effort",
  "total-mobilisation",
  "research-bureau",
  "technical-schools",
  "secret-projects",
  "army-effort",
  "equipment-effort",
  "doctrine-effort",
  "political-effort",
  "national-unity",
  "neutrality",
  "militarism",
  "war-propaganda",
  "intelligence-bureau",
]);

/** One national focus a government can pursue. */
export type FocusId = typeof FocusIdSchema.Type;

export const FOCUS_IDS = FocusIdSchema.literals;

/** What finishing a focus hands the nation once, on the day it finishes. */
export interface Grants {
  readonly civilianFactories: number;
  readonly militaryFactories: number;
  readonly researchSlots: number;
  /** Operative slots for its intelligence agency. */
  readonly operatives: number;
}

const NO_GRANTS: Grants = {
  civilianFactories: 0,
  militaryFactories: 0,
  operatives: 0,
  researchSlots: 0,
};

/** One national focus, what it needs, and what it gives. */
export interface Focus {
  readonly name: string;
  readonly branch: FocusBranch;
  /** Every focus that has to be finished before this one. */
  readonly requires: readonly FocusId[];
  /** Focuses this one rules out, and that rule it out, once either is started. */
  readonly excludes: readonly FocusId[];
  /** What it makes the nation better at from the day it finishes on. */
  readonly bonus: Bonus;
  readonly grants: Grants;
}

const FOCUSES = {
  "army-effort": {
    bonus: { organisation: 0.05 },
    branch: "army",
    excludes: [],
    grants: NO_GRANTS,
    name: "陸軍拡張",
    requires: [],
  },
  "construction-effort": {
    bonus: { construction: 0.1 },
    branch: "industry",
    excludes: [],
    grants: { ...NO_GRANTS, civilianFactories: 2 },
    name: "建設振興",
    requires: ["industrialisation"],
  },
  "doctrine-effort": {
    bonus: { attack: 0.05, recovery: 0.1 },
    branch: "army",
    excludes: [],
    grants: NO_GRANTS,
    name: "戦術研究",
    requires: ["army-effort"],
  },
  "equipment-effort": {
    bonus: { dockyards: 0.1, production: 0.1 },
    branch: "army",
    excludes: [],
    grants: NO_GRANTS,
    name: "装備増産",
    requires: ["army-effort"],
  },
  industrialisation: {
    bonus: {},
    branch: "industry",
    excludes: [],
    grants: { ...NO_GRANTS, civilianFactories: 3 },
    name: "工業化",
    requires: [],
  },
  "intelligence-bureau": {
    bonus: {},
    branch: "politics",
    excludes: [],
    grants: { ...NO_GRANTS, operatives: 1 },
    name: "諜報局",
    requires: ["political-effort"],
  },
  militarism: {
    bonus: { attack: 0.1 },
    branch: "politics",
    excludes: ["neutrality"],
    grants: NO_GRANTS,
    name: "軍国主義",
    requires: ["political-effort"],
  },
  "national-unity": {
    bonus: { manpower: 0.1 },
    branch: "politics",
    excludes: [],
    grants: NO_GRANTS,
    name: "国民統合",
    requires: ["political-effort"],
  },
  neutrality: {
    bonus: { defence: 0.1 },
    branch: "politics",
    excludes: ["militarism"],
    grants: NO_GRANTS,
    name: "中立",
    requires: ["political-effort"],
  },
  "political-effort": {
    bonus: { manpower: 0.05 },
    branch: "politics",
    excludes: [],
    grants: NO_GRANTS,
    name: "政治運動",
    requires: [],
  },
  "production-effort": {
    bonus: {},
    branch: "industry",
    excludes: [],
    grants: { ...NO_GRANTS, militaryFactories: 3 },
    name: "生産振興",
    requires: ["industrialisation"],
  },
  "research-bureau": {
    bonus: {},
    branch: "research",
    excludes: [],
    grants: { ...NO_GRANTS, researchSlots: 1 },
    name: "研究局",
    requires: [],
  },
  "secret-projects": {
    bonus: {},
    branch: "research",
    excludes: [],
    grants: { ...NO_GRANTS, researchSlots: 1 },
    name: "秘密研究",
    requires: ["technical-schools"],
  },
  "technical-schools": {
    bonus: { research: 0.05 },
    branch: "research",
    excludes: [],
    grants: NO_GRANTS,
    name: "技術学校",
    requires: ["research-bureau"],
  },
  "total-mobilisation": {
    bonus: { dockyards: 0.05, production: 0.05 },
    branch: "industry",
    excludes: [],
    grants: { ...NO_GRANTS, civilianFactories: 2, militaryFactories: 2 },
    name: "総力動員",
    requires: ["construction-effort", "production-effort"],
  },
  "war-propaganda": {
    bonus: { manpower: 0.05, organisation: 0.05 },
    branch: "politics",
    excludes: [],
    grants: NO_GRANTS,
    name: "戦時宣伝",
    requires: ["national-unity"],
  },
} satisfies Readonly<Record<FocusId, Focus>>;

export const focusOf = (focus: FocusId): Focus => FOCUSES[focus];

/** How many days a focus takes from the day it is picked. */
export const FOCUS_DAYS = 70;

/** How many research slots a nation has before any focus adds one. */
const BASE_RESEARCH_SLOTS = 3;

/** The focus a government is pursuing, and the days put into it so far. */
interface Pursuit {
  readonly focus: FocusId;
  readonly progress: number;
}

/** What a government has finished of its focus tree and what it pursues now. */
export interface Focuses {
  readonly done: readonly FocusId[];
  readonly current: Option.Option<Pursuit>;
}

export const START_FOCUSES: Focuses = { current: Option.none(), done: [] };

const exclusive = (one: FocusId, other: FocusId): boolean =>
  focusOf(one).excludes.includes(other) ||
  focusOf(other).excludes.includes(one);

/**
 * Where each focus stands for a government with `focuses`: finished, the one
 * it pursues, ruled out by one it finished or pursues, open once every
 * prerequisite is finished, and otherwise locked.
 */
export const focusStandingsOf = (focuses: Focuses) => {
  const finished = new Set(focuses.done);
  const pursued = focuses.current.pipe(Option.map((pursuit) => pursuit.focus));
  const started = [...focuses.done, ...Option.toArray(pursued)];
  const ruledOut = new Set(
    FOCUS_IDS.filter((focus) =>
      started.some((other) => exclusive(focus, other))
    )
  );
  return (focus: FocusId): TreeStanding => {
    if (finished.has(focus)) {
      return "done";
    }
    if (Option.contains(pursued, focus)) {
      return "underway";
    }
    if (ruledOut.has(focus)) {
      return "excluded";
    }
    if (focusOf(focus).requires.every((needed) => finished.has(needed))) {
      return "open";
    }
    return "locked";
  };
};

/**
 * The focuses a government may pick next: none while it pursues one, and
 * otherwise every open one, in the tree's order.
 */
export const availableFocuses = (focuses: Focuses): readonly FocusId[] => {
  if (Option.isSome(focuses.current)) {
    return [];
  }
  const standingOf = focusStandingsOf(focuses);
  return FOCUS_IDS.filter((focus) => standingOf(focus) === "open");
};

export const focusStarted = (focuses: Focuses, focus: FocusId): Focuses => ({
  ...focuses,
  current: Option.some({ focus, progress: 0 }),
});

/** A day of work on the focus, and the focus it finished, if it finished one. */
interface Pursued {
  readonly focuses: Focuses;
  readonly finished: Option.Option<FocusId>;
}

/** The focuses after one more day spent on the current one. */
export const focusedOneDay = (focuses: Focuses): Pursued =>
  Option.match(focuses.current, {
    onNone: () => ({ finished: Option.none(), focuses }),
    onSome: (pursuit): Pursued => {
      const progress = pursuit.progress + 1;
      if (progress < FOCUS_DAYS) {
        return {
          finished: Option.none(),
          focuses: {
            ...focuses,
            current: Option.some({ ...pursuit, progress }),
          },
        };
      }
      return {
        finished: Option.some(pursuit.focus),
        focuses: {
          current: Option.none(),
          done: [...focuses.done, pursuit.focus],
        },
      };
    },
  });

/** The economy with what finishing `focus` hands the nation added to it. */
export const grantedBy = (
  economy: NationEconomy,
  focus: FocusId
): NationEconomy => {
  const { grants } = focusOf(focus);
  return {
    ...economy,
    civilianFactories: economy.civilianFactories + grants.civilianFactories,
    militaryFactories: economy.militaryFactories + grants.militaryFactories,
  };
};

/** What every focus in `focuses` finished grants of `grant` together. */
const grantedAll = (
  focuses: Focuses,
  grant: "researchSlots" | "operatives"
): number => {
  let granted = 0;
  for (const focus of focuses.done) {
    granted += focusOf(focus).grants[grant];
  }
  return granted;
};

/** The research slots a nation with `focuses` finished has. */
export const researchSlotsOf = (focuses: Focuses): number =>
  BASE_RESEARCH_SLOTS + grantedAll(focuses, "researchSlots");

/**
 * The operative slots the focuses a nation has finished add to its agency.
 * Hearts of Iron IV's national focus trees add operative slots, and which
 * focus does here, and that it adds one, is this game's own.
 */
export const operativeSlotsOf = (focuses: Focuses): number =>
  grantedAll(focuses, "operatives");

/** What every focus finished adds. */
export const focusBonuses = (focuses: Focuses): readonly Bonus[] =>
  focuses.done.map((focus) => focusOf(focus).bonus);
