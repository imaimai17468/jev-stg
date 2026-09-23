import { Schema } from "effect";
import { itemAt } from "./lookup";
import type { Bonus } from "./modifiers";

/** The part of the tree a technology sits in. */
export type TechBranch =
  | "infantry"
  | "artillery"
  | "doctrine"
  | "industry"
  | "construction"
  | "electronics"
  | "logistics";

/** Every technology, in the order the tree lists them. */
export const TechIdSchema = Schema.Literals([
  "infantry-weapons-1",
  "infantry-weapons-2",
  "infantry-weapons-3",
  "support-weapons-1",
  "support-weapons-2",
  "anti-tank-1",
  "anti-tank-2",
  "artillery-1",
  "artillery-2",
  "artillery-3",
  "modern-tactics",
  "superior-firepower-1",
  "superior-firepower-2",
  "mass-assault-1",
  "mass-assault-2",
  "tools-1",
  "tools-2",
  "tools-3",
  "tools-4",
  "concentrated-industry-1",
  "concentrated-industry-2",
  "dispersed-industry-1",
  "dispersed-industry-2",
  "construction-1",
  "construction-2",
  "construction-3",
  "construction-4",
  "electronics-1",
  "computing-1",
  "computing-2",
  "logistics-1",
  "logistics-2",
  "logistics-3",
]);

/** One technology a nation can research. */
export type TechId = typeof TechIdSchema.Type;

const TECH_IDS = TechIdSchema.literals;

/** What one technology is and what it takes. */
export interface Tech {
  readonly name: string;
  readonly branch: TechBranch;
  /** The year it is meant for. Researching it earlier takes longer. */
  readonly year: number;
  /** The days one slot takes to research it in its year, with no bonus. */
  readonly days: number;
  /** Every technology that has to be researched before this one. */
  readonly requires: readonly TechId[];
  /** Technologies this one rules out, and that rule it out, once either is started. */
  readonly excludes: readonly TechId[];
  readonly bonus: Bonus;
}

const TECHS = {
  "anti-tank-1": {
    bonus: { defence: 0.1 },
    branch: "infantry",
    days: 120,
    excludes: [],
    name: "対戦車砲I",
    requires: ["infantry-weapons-1"],
    year: 1938,
  },
  "anti-tank-2": {
    bonus: { defence: 0.1 },
    branch: "infantry",
    days: 140,
    excludes: [],
    name: "対戦車砲II",
    requires: ["anti-tank-1"],
    year: 1941,
  },
  "artillery-1": {
    bonus: { attack: 0.1 },
    branch: "artillery",
    days: 100,
    excludes: [],
    name: "野砲I",
    requires: [],
    year: 1936,
  },
  "artillery-2": {
    bonus: { attack: 0.1 },
    branch: "artillery",
    days: 120,
    excludes: [],
    name: "野砲II",
    requires: ["artillery-1"],
    year: 1939,
  },
  "artillery-3": {
    bonus: { attack: 0.1, defence: 0.05 },
    branch: "artillery",
    days: 140,
    excludes: [],
    name: "野砲III",
    requires: ["artillery-2"],
    year: 1942,
  },
  "computing-1": {
    bonus: { research: 0.03 },
    branch: "electronics",
    days: 120,
    excludes: [],
    name: "計算機I",
    requires: ["electronics-1"],
    year: 1938,
  },
  "computing-2": {
    bonus: { research: 0.05 },
    branch: "electronics",
    days: 140,
    excludes: [],
    name: "計算機II",
    requires: ["computing-1"],
    year: 1941,
  },
  "concentrated-industry-1": {
    bonus: { production: 0.15 },
    branch: "industry",
    days: 120,
    excludes: ["dispersed-industry-1"],
    name: "集中工業I",
    requires: ["tools-1"],
    year: 1937,
  },
  "concentrated-industry-2": {
    bonus: { production: 0.15 },
    branch: "industry",
    days: 140,
    excludes: [],
    name: "集中工業II",
    requires: ["concentrated-industry-1"],
    year: 1940,
  },
  "construction-1": {
    bonus: { construction: 0.1 },
    branch: "construction",
    days: 100,
    excludes: [],
    name: "建設技術I",
    requires: [],
    year: 1936,
  },
  "construction-2": {
    bonus: { construction: 0.1 },
    branch: "construction",
    days: 120,
    excludes: [],
    name: "建設技術II",
    requires: ["construction-1"],
    year: 1938,
  },
  "construction-3": {
    bonus: { construction: 0.1 },
    branch: "construction",
    days: 130,
    excludes: [],
    name: "建設技術III",
    requires: ["construction-2"],
    year: 1940,
  },
  "construction-4": {
    bonus: { construction: 0.1 },
    branch: "construction",
    days: 140,
    excludes: [],
    name: "建設技術IV",
    requires: ["construction-3"],
    year: 1942,
  },
  "dispersed-industry-1": {
    bonus: { construction: 0.1, production: 0.05 },
    branch: "industry",
    days: 120,
    excludes: ["concentrated-industry-1"],
    name: "分散工業I",
    requires: ["tools-1"],
    year: 1937,
  },
  "dispersed-industry-2": {
    bonus: { construction: 0.1, production: 0.05 },
    branch: "industry",
    days: 140,
    excludes: [],
    name: "分散工業II",
    requires: ["dispersed-industry-1"],
    year: 1940,
  },
  "electronics-1": {
    bonus: { research: 0.03 },
    branch: "electronics",
    days: 100,
    excludes: [],
    name: "電子工学",
    requires: [],
    year: 1936,
  },
  "infantry-weapons-1": {
    bonus: { attack: 0.05, defence: 0.1 },
    branch: "infantry",
    days: 100,
    excludes: [],
    name: "歩兵装備I",
    requires: [],
    year: 1936,
  },
  "infantry-weapons-2": {
    bonus: { attack: 0.05, defence: 0.1 },
    branch: "infantry",
    days: 120,
    excludes: [],
    name: "歩兵装備II",
    requires: ["infantry-weapons-1"],
    year: 1939,
  },
  "infantry-weapons-3": {
    bonus: { attack: 0.05, defence: 0.1 },
    branch: "infantry",
    days: 140,
    excludes: [],
    name: "歩兵装備III",
    requires: ["infantry-weapons-2"],
    year: 1942,
  },
  "logistics-1": {
    bonus: { supply: 0.1 },
    branch: "logistics",
    days: 100,
    excludes: [],
    name: "兵站I",
    requires: [],
    year: 1936,
  },
  "logistics-2": {
    bonus: { supply: 0.15 },
    branch: "logistics",
    days: 120,
    excludes: [],
    name: "兵站II",
    requires: ["logistics-1"],
    year: 1938,
  },
  "logistics-3": {
    bonus: { supply: 0.15 },
    branch: "logistics",
    days: 140,
    excludes: [],
    name: "兵站III",
    requires: ["logistics-2"],
    year: 1941,
  },
  "mass-assault-1": {
    bonus: { organisation: 0.15, recovery: 0.2 },
    branch: "doctrine",
    days: 120,
    excludes: ["superior-firepower-1"],
    name: "大規模突撃I",
    requires: ["modern-tactics"],
    year: 1938,
  },
  "mass-assault-2": {
    bonus: { defence: 0.1, organisation: 0.1 },
    branch: "doctrine",
    days: 140,
    excludes: [],
    name: "大規模突撃II",
    requires: ["mass-assault-1"],
    year: 1940,
  },
  "modern-tactics": {
    bonus: { organisation: 0.1 },
    branch: "doctrine",
    days: 100,
    excludes: [],
    name: "近代戦術",
    requires: [],
    year: 1936,
  },
  "superior-firepower-1": {
    bonus: { attack: 0.1 },
    branch: "doctrine",
    days: 120,
    excludes: ["mass-assault-1"],
    name: "優勢火力I",
    requires: ["modern-tactics"],
    year: 1938,
  },
  "superior-firepower-2": {
    bonus: { attack: 0.1, defence: 0.05 },
    branch: "doctrine",
    days: 140,
    excludes: [],
    name: "優勢火力II",
    requires: ["superior-firepower-1"],
    year: 1940,
  },
  "support-weapons-1": {
    bonus: { attack: 0.05 },
    branch: "infantry",
    days: 100,
    excludes: [],
    name: "支援火器I",
    requires: ["infantry-weapons-1"],
    year: 1937,
  },
  "support-weapons-2": {
    bonus: { attack: 0.05 },
    branch: "infantry",
    days: 120,
    excludes: [],
    name: "支援火器II",
    requires: ["support-weapons-1"],
    year: 1940,
  },
  "tools-1": {
    bonus: { production: 0.1 },
    branch: "industry",
    days: 100,
    excludes: [],
    name: "工作機械I",
    requires: [],
    year: 1936,
  },
  "tools-2": {
    bonus: { production: 0.1 },
    branch: "industry",
    days: 110,
    excludes: [],
    name: "工作機械II",
    requires: ["tools-1"],
    year: 1937,
  },
  "tools-3": {
    bonus: { production: 0.1 },
    branch: "industry",
    days: 130,
    excludes: [],
    name: "工作機械III",
    requires: ["tools-2"],
    year: 1939,
  },
  "tools-4": {
    bonus: { production: 0.1 },
    branch: "industry",
    days: 140,
    excludes: [],
    name: "工作機械IV",
    requires: ["tools-3"],
    year: 1941,
  },
} satisfies Readonly<Record<TechId, Tech>>;

export const techOf = (tech: TechId): Tech => TECHS[tech];

/**
 * A technology on a slot, the research-days put into it so far, and the share
 * a research bonus adds to every day of it.
 */
export interface Study {
  readonly tech: TechId;
  readonly progress: number;
  readonly bonus: number;
}

/**
 * A research bonus waiting for the next technology started in one of its
 * branches, which it speeds up by `share` until that one is done.
 */
export interface Voucher {
  readonly branches: readonly TechBranch[];
  readonly share: number;
}

/** What a nation has researched and what its slots are working on. */
export interface Research {
  readonly researched: readonly TechId[];
  /** One study per busy slot, in the order they were started. */
  readonly studies: readonly Study[];
  /** Research bonuses not yet used, the oldest first. */
  readonly vouchers: readonly Voucher[];
}

export const START_RESEARCH: Research = {
  researched: [],
  studies: [],
  vouchers: [],
};

/** How much longer a technology takes for each year it is researched early. */
export const AHEAD_OF_TIME_PER_YEAR = 1;

/** The research-days `tech` costs in `year`. */
export const costOf = (tech: TechId, year: number): number => {
  const { days, year: meant } = techOf(tech);
  return days * (1 + AHEAD_OF_TIME_PER_YEAR * Math.max(0, meant - year));
};

/** The technologies `research` has finished or has on a slot. */
const touched = (research: Research): ReadonlySet<TechId> =>
  new Set([
    ...research.researched,
    ...research.studies.map((study) => study.tech),
  ]);

/** Whether `one` and `other` rule each other out, whichever of them names it. */
const exclusive = (one: TechId, other: TechId): boolean =>
  techOf(one).excludes.includes(other) || techOf(other).excludes.includes(one);

/**
 * The technologies a slot may start on: every one not already researched or on
 * a slot, whose prerequisites are all researched, and that nothing researched
 * or on a slot rules out. They come in the tree's order.
 */
export const availableTechs = (research: Research): readonly TechId[] => {
  const taken = touched(research);
  const finished = new Set(research.researched);
  return TECH_IDS.filter(
    (tech) =>
      !taken.has(tech) &&
      techOf(tech).requires.every((needed) => finished.has(needed)) &&
      ![...taken].some((other) => exclusive(tech, other))
  );
};

/** No research bonus, which a technology started without one runs on. */
const NO_VOUCHER: Voucher = { branches: [], share: 0 };

/**
 * The research with `tech` started on a free slot, taking the oldest research
 * bonus that covers its branch.
 */
export const studyStarted = (research: Research, tech: TechId): Research => {
  const { branch } = techOf(tech);
  const used = research.vouchers.findIndex((voucher) =>
    voucher.branches.includes(branch)
  );
  return {
    ...research,
    studies: [
      ...research.studies,
      {
        bonus: itemAt(research.vouchers, used, NO_VOUCHER).share,
        progress: 0,
        tech,
      },
    ],
    vouchers: research.vouchers.filter((_, index) => index !== used),
  };
};

/**
 * Whether a slot could still start `tech` some day: it is neither researched
 * nor on a slot, nothing researched or on a slot rules it out, and every
 * technology it needs is researched, on a slot, or could itself still be
 * started.
 */
const reachable = (research: Research) => {
  const taken = touched(research);
  const open = (tech: TechId): boolean =>
    !taken.has(tech) &&
    ![...taken].some((other) => exclusive(tech, other)) &&
    techOf(tech).requires.every((needed) => taken.has(needed) || open(needed));
  return open;
};

/**
 * Whether a research bonus for `branches` would find a use: no bonus for any
 * of them is already waiting, and some technology in them could still be
 * started.
 */
export const bonusUsable = (
  research: Research,
  branches: readonly TechBranch[]
): boolean => {
  const covered = new Set(branches);
  if (
    research.vouchers.some((voucher) =>
      voucher.branches.some((branch) => covered.has(branch))
    )
  ) {
    return false;
  }
  const reach = reachable(research);
  return TECH_IDS.some(
    (tech) => covered.has(techOf(tech).branch) && reach(tech)
  );
};

/** The research with `voucher` waiting for the next technology in its branches. */
export const voucherGranted = (
  research: Research,
  voucher: Voucher
): Research => ({ ...research, vouchers: [...research.vouchers, voucher] });

/**
 * The research after one day, with every slot putting `1 + speed` research-days,
 * and its research bonus on top, into its technology and every technology that reached its cost for `year`
 * moved to the researched list, which frees its slot.
 */
export const researchedOneDay = (
  research: Research,
  speed: number,
  year: number
): Research => {
  const advanced = research.studies.map((study) => ({
    ...study,
    progress: study.progress + 1 + speed + study.bonus,
  }));
  const done = (study: Study) => study.progress >= costOf(study.tech, year);
  return {
    ...research,
    researched: [
      ...research.researched,
      ...advanced.flatMap((study) => {
        if (!done(study)) {
          return [];
        }
        return [study.tech];
      }),
    ],
    studies: advanced.filter((study) => !done(study)),
  };
};

/** What every technology `research` has finished adds. */
export const researchBonuses = (research: Research): readonly Bonus[] =>
  research.researched.map((tech) => techOf(tech).bonus);
