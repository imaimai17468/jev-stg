import { Option } from "effect";
import type { Advancement } from "@/shared/entities/world/research/advancement";
import type {
  FocusBranch,
  FocusId,
} from "@/shared/entities/world/research/focus";
import {
  FOCUS_IDS,
  focusOf,
  focusStandingsOf,
} from "@/shared/entities/world/research/focus";
import { techStandingsOf } from "@/shared/entities/world/research/research";
import type { TreeStanding } from "@/shared/entities/world/research/tree-standing";
import type { TechLine } from "@/shared/entities/world/techs";
import { TECH_IDS, TECH_LINES, techOf } from "@/shared/entities/world/techs";
import { daysLeft, percentDone } from "./advancement-summary";

/** One focus or technology as the tree dialog draws it. */
export interface TreeNode {
  readonly id: string;
  readonly name: string;
  readonly standing: TreeStanding;
  /** How far along it is, while it is underway. */
  readonly progress: Option.Option<string>;
}

/** The focuses of a branch that stand behind the same count of prerequisites. */
export interface FocusTier {
  readonly nodes: readonly TreeNode[];
}

/** The technologies of a line meant for one year. */
export interface YearTier {
  readonly year: number;
  readonly nodes: readonly TreeNode[];
}

/** One branch of the focus tree or one line of the research tree. */
export interface TreeGroup<Tier> {
  readonly title: string;
  readonly tiers: readonly Tier[];
}

/** A nation's focus tree and research tree, each node placed and marked. */
export interface AdvancementTree {
  /** One group per branch, a tier per count of prerequisites in a chain. */
  readonly focuses: readonly TreeGroup<FocusTier>[];
  /** One group per line, a tier per year, the earliest first. */
  readonly techs: readonly TreeGroup<YearTier>[];
}

const BRANCH_TITLES = {
  army: "陸軍",
  industry: "工業",
  politics: "政治",
  research: "研究",
} satisfies Readonly<Record<FocusBranch, string>>;

const LINE_TITLES = {
  armour: "戦車",
  battleships: "戦艦",
  carriers: "空母",
  "close-support": "近接航空支援機",
  construction: "建設",
  cruisers: "巡洋艦",
  destroyers: "駆逐艦",
  electronics: "電子工学",
  fighters: "戦闘機",
  fuel: "燃料",
  industry: "工業",
  "infantry-weapons": "歩兵装備",
  "mobile-infantry": "自動車化と機械化",
  "naval-armament": "艦砲と魚雷",
  "naval-bombers": "雷撃機",
  "special-forces": "特殊部隊",
  submarines: "潜水艦",
} satisfies Readonly<Record<TechLine, string>>;

/** How many focuses stand in the longest chain of prerequisites before `focus`. */
const depthOf = (focus: FocusId): number =>
  Math.max(-1, ...focusOf(focus).requires.map(depthOf)) + 1;

/** `items` split into runs sharing a key, the runs in ascending key order. */
const tiered = <A>(
  items: readonly A[],
  keyOf: (item: A) => number
): readonly (readonly [number, readonly A[]])[] =>
  [...new Set(items.map(keyOf))]
    .toSorted((one, other) => one - other)
    .map((key) => [key, items.filter((item) => keyOf(item) === key)]);

const focusGroups = (
  advancement: Advancement
): readonly TreeGroup<FocusTier>[] => {
  const { focuses } = advancement;
  const standingOf = focusStandingsOf(focuses);
  const node = (focus: FocusId): TreeNode => ({
    id: focus,
    name: focusOf(focus).name,
    progress: focuses.current.pipe(
      Option.filter((pursuit) => pursuit.focus === focus),
      Option.map((pursuit) => daysLeft(pursuit.progress))
    ),
    standing: standingOf(focus),
  });
  const branches = [
    ...new Set(FOCUS_IDS.map((focus) => focusOf(focus).branch)),
  ];
  return branches.map((branch) => ({
    tiers: tiered(
      FOCUS_IDS.filter((focus) => focusOf(focus).branch === branch),
      depthOf
    ).map(([, tier]) => ({ nodes: tier.map(node) })),
    title: BRANCH_TITLES[branch],
  }));
};

const techGroups = (
  advancement: Advancement
): readonly TreeGroup<YearTier>[] => {
  const { research } = advancement;
  const standingOf = techStandingsOf(research);
  return TECH_LINES.map((line) => ({
    tiers: tiered(
      TECH_IDS.filter((tech) => techOf(tech).line === line),
      (tech) => techOf(tech).year
    ).map(([year, tier]) => ({
      nodes: tier.map((tech) => ({
        id: tech,
        name: techOf(tech).name,
        progress: Option.map(
          Option.fromUndefinedOr(
            research.studies.find((study) => study.tech === tech)
          ),
          percentDone
        ),
        standing: standingOf(tech),
      })),
      year,
    })),
    title: LINE_TITLES[line],
  }));
};

/** The nation's focus tree and research tree as the tree dialog draws them. */
export const advancementTreeOf = (
  advancement: Advancement
): AdvancementTree => ({
  focuses: focusGroups(advancement),
  techs: techGroups(advancement),
});
