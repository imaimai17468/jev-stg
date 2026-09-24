import { raisingNameOf } from "@/shared/entities/world/army/divisions";
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
} from "@/shared/entities/world/economy/economy";
import { NO_NATION } from "@/shared/entities/world/geography/nations";
import type { World } from "@/shared/entities/world/geography/world";
import { itemAt } from "@/shared/entities/world/lookup";
import type { PeaceTerms } from "@/shared/entities/world/peace";
import { focusOf } from "@/shared/entities/world/research/focus";
import type { Stance } from "@/shared/entities/world/stance";
import { techOf } from "@/shared/entities/world/techs";
import { destinationName, OPERATION_NAMES, projectName } from "./intel-names";
import {
  AIRCRAFT_NAMES,
  AVIATION_NAMES,
  ORDER_NAMES,
  TRADE_LAW_NAMES,
} from "./naval-names";

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

/** How many operatives an operation lost as it ended, in the feed's words, or nothing where it lost none. */
const caughtNote = (captured: number): string =>
  itemAt(["", `（${captured}人が捕まった）`], Number(captured > 0), "");

/** The kinds of decision about a nation's trade, dockyards, planes, divisions or build site. */
const PRODUCTION_KINDS = {
  aircraft: true,
  aviation: true,
  "build-site": true,
  "division-kind": true,
  shipbuilding: true,
  trade: true,
} satisfies Partial<Readonly<Record<Decision["kind"], true>>>;

/** A decision about a nation's trade, dockyards, planes, divisions or build site. */
type ProductionDecision = Extract<
  Decision,
  { kind: keyof typeof PRODUCTION_KINDS }
>;

const isProduction = (decision: Decision): decision is ProductionDecision =>
  decision.kind in PRODUCTION_KINDS;

/** What a decision about a nation's trade, dockyards, planes, divisions or build site says in the feed's words. */
const productionAction = (decision: ProductionDecision): string => {
  if (decision.kind === "division-kind") {
    return `師団の編成 → ${raisingNameOf(decision.division)}`;
  }
  if (decision.kind === "trade") {
    return `交易法 → ${TRADE_LAW_NAMES[decision.law]}`;
  }
  if (decision.kind === "shipbuilding") {
    return `造船 → ${ORDER_NAMES[decision.order]}`;
  }
  if (decision.kind === "aircraft") {
    return `航空機 → ${AIRCRAFT_NAMES[decision.aircraft]}`;
  }
  if (decision.kind === "aviation") {
    return `航空機の生産 → ${AVIATION_NAMES[decision.aviation]}`;
  }
  return `建設地 → 州${decision.province}`;
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
  if (decision.kind === "white-peace") {
    return {
      action: `${nameOf(decision.other)}と白紙講和`,
      actor: nameOf(decision.one),
    };
  }
  const actor = nameOf(decision.nation);
  if (isProduction(decision)) {
    return { action: productionAction(decision), actor };
  }
  if (decision.kind === "landing") {
    return { action: `${nameOf(decision.defender)}の海岸に上陸`, actor };
  }
  if (decision.kind === "paradrop") {
    return {
      action: `${nameOf(decision.defender)}の州${decision.target}に空挺降下`,
      actor,
    };
  }
  if (decision.kind === "conscription") {
    return { action: `徴兵法 → ${LAW_NAMES[decision.law]}`, actor };
  }
  if (decision.kind === "plan") {
    return { action: `工業方針 → ${PLAN_NAMES[decision.plan]}`, actor };
  }
  if (decision.kind === "stance") {
    return { action: `攻撃姿勢 → ${STANCE_NAMES[decision.stance]}`, actor };
  }
  if (decision.kind === "justify") {
    return {
      action: `${nameOf(decision.target)}への戦争目標の正当化を開始`,
      actor,
    };
  }
  if (decision.kind === "declare") {
    return { action: `${nameOf(decision.target)}に宣戦布告`, actor };
  }
  if (decision.kind === "research") {
    return { action: `研究開始 → ${techOf(decision.tech).name}`, actor };
  }
  if (decision.kind === "focus") {
    return { action: `国家方針 → ${focusOf(decision.focus).name}`, actor };
  }
  if (decision.kind === "agency") {
    return { action: `諜報機関 → ${projectName(decision.project)}`, actor };
  }
  if (decision.kind === "espionage") {
    return {
      action: `工作員 → ${destinationName(decision.target, nameOf)}`,
      actor,
    };
  }
  if (decision.kind === "operation") {
    return {
      action: `${nameOf(decision.target)}で${OPERATION_NAMES[decision.operation]}${caughtNote(decision.captured)}`,
      actor,
    };
  }
  if (decision.kind === "captured") {
    return { action: `${nameOf(decision.spy)}の工作員を捕らえた`, actor };
  }
  if (decision.kind === "cipher") {
    return { action: `${nameOf(decision.target)}の暗号を解読`, actor };
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
