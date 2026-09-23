import type { World } from "@/shared/entities/world";
import { dateLabel } from "@/shared/entities/world/calendar";
import type {
  Decision,
  Entry,
  Source,
} from "@/shared/entities/world/chronicle";
import { dateOnDay } from "@/shared/entities/world/clock";
import type {
  ConscriptionLaw,
  IndustryPlan,
} from "@/shared/entities/world/economy";
import { itemAt } from "@/shared/entities/world/lookup";
import { NO_NATION } from "@/shared/entities/world/nations";
import type { PeaceTerms } from "@/shared/entities/world/peace";
import type { Stance } from "@/shared/entities/world/stance";

/** One chronicle entry as the feed prints it. */
export interface EntryLine {
  /** Tells the entry apart from every other in the chronicle. */
  readonly key: string;
  readonly date: string;
  /** The nation that decided. */
  readonly actor: string;
  readonly action: string;
  readonly source: string;
}

const LAW_NAMES = {
  "all-adults": "国民皆兵",
  extensive: "拡大徴兵",
  limited: "限定徴兵",
  "service-by-requirement": "必要に応じた兵役",
  volunteer: "志願兵制",
} satisfies Readonly<Record<ConscriptionLaw, string>>;

const PLAN_NAMES = {
  balanced: "均衡",
  civilian: "民需優先",
  military: "軍需優先",
  "total-war": "総力戦",
} satisfies Readonly<Record<IndustryPlan, string>>;

const STANCE_NAMES = {
  balanced: "標準",
  defensive: "守勢",
  offensive: "攻勢",
} satisfies Readonly<Record<Stance, string>>;

const TERMS_ACTIONS = {
  annex: (loser: string) => `${loser}を併合`,
  cede: (loser: string) => `${loser}と講和し、占領地を割譲させた`,
  puppet: (loser: string) => `${loser}を傀儡国にした`,
} satisfies Readonly<Record<PeaceTerms, (loser: string) => string>>;

const PERCENT = 100;

const sourceLabel = (source: Source): string => {
  if (source.kind === "jev") {
    return `Jev ${Math.round(source.probability * PERCENT)}%`;
  }
  return "規則";
};

/** Who decided, and what, in the feed's words. */
const described = (
  decision: Decision,
  nameOf: (nation: number) => string
): Pick<EntryLine, "action" | "actor"> => {
  if (decision.kind === "peace") {
    return {
      action: TERMS_ACTIONS[decision.settlement.terms](nameOf(decision.loser)),
      actor: nameOf(decision.settlement.victor),
    };
  }
  const actor = nameOf(decision.nation);
  if (decision.kind === "conscription") {
    return { action: `徴兵法 → ${LAW_NAMES[decision.law]}`, actor };
  }
  if (decision.kind === "plan") {
    return { action: `工業方針 → ${PLAN_NAMES[decision.plan]}`, actor };
  }
  if (decision.kind === "stance") {
    return { action: `攻撃姿勢 → ${STANCE_NAMES[decision.stance]}`, actor };
  }
  if (decision.kind === "declare") {
    return { action: `${nameOf(decision.target)}に宣戦布告`, actor };
  }
  return { action: `${nameOf(decision.faction)}陣営に加盟`, actor };
};

export const entryLine = (world: World, entry: Entry): EntryLine => ({
  ...described(
    entry.ruling.decision,
    (nation) => itemAt(world.nations, nation, NO_NATION).name
  ),
  date: dateLabel(dateOnDay(entry.day)),
  key: String(entry.seq),
  source: sourceLabel(entry.ruling.source),
});
