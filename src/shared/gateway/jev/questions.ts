import "@tanstack/react-start/server-only";
import { Option } from "effect";
import type {
  Consultation,
  Council,
  NationBrief,
  PeaceTalks,
  Question,
  Verdict,
} from "@/shared/entities/world/consultation";
import {
  factionChoice,
  NO_CHOICE,
  rivalChoice,
} from "@/shared/entities/world/consultation";
import type {
  ConscriptionLaw,
  IndustryPlan,
} from "@/shared/entities/world/economy";
import type { FocusId, Grants } from "@/shared/entities/world/focus";
import { FOCUS_DAYS, focusOf } from "@/shared/entities/world/focus";
import type { Bonus, Modifier } from "@/shared/entities/world/modifiers";
import { MODIFIERS, shareOf } from "@/shared/entities/world/modifiers";
import type { PeaceTerms } from "@/shared/entities/world/peace";
import type { TechId } from "@/shared/entities/world/research";
import {
  AHEAD_OF_TIME_PER_YEAR,
  techOf,
} from "@/shared/entities/world/research";
import type { Stance } from "@/shared/entities/world/stance";

/** One `choice` question as `/v1/evaluate` takes it. */
interface ChoiceQuestion {
  readonly type: "choice";
  readonly instructions: string;
  readonly criteria: Readonly<Record<string, string>>;
}

/** What one question asks and about whom, kept to read its answer back. */
interface Asked {
  readonly nation: number;
  readonly question: Question;
  readonly criteria: Readonly<Record<string, string>>;
}

/** One question as it is put: the key it goes under and its wording. */
interface Posed extends Asked {
  readonly key: string;
  readonly instructions: string;
}

/** What every government's brief reads as when Jev is handed it. */
interface CouncilState {
  readonly 各国: readonly ReturnType<typeof stateOf>[];
  readonly 日付: string;
}

/** What the talks over a surrendered nation read as when Jev is handed them. */
interface PeaceState {
  readonly 戦勝国: string;
  readonly 戦勝国側が持つ敗戦国の本土の割合: number;
  readonly 敗戦国: string;
  readonly 敗戦国が持つ本土の割合: number;
  readonly 日付: string;
}

/** A request body for `/v1/evaluate`, and what each of its questions asked. */
export interface Evaluation {
  readonly body: {
    readonly model: string;
    readonly state: CouncilState | PeaceState;
    readonly questions: Readonly<Record<string, ChoiceQuestion>>;
  };
  readonly asked: ReadonlyMap<string, Asked>;
}

const JEV_MODEL = "typesafe-ai/jev";

const LAW_LABELS = {
  "all-adults":
    "国民皆兵（人口の20%まで動員できるが、装備の生産と建設が30%落ちる）",
  extensive: "拡大徴兵（人口の5%まで）",
  limited: "限定徴兵（人口の2.5%まで）",
  "service-by-requirement":
    "必要に応じた兵役（人口の10%まで、装備の生産と建設が10%落ちる）",
  volunteer: "志願兵制（人口の1.5%まで）",
} satisfies Readonly<Record<ConscriptionLaw, string>>;

const PLAN_LABELS = {
  balanced: "均衡（工場の35%で兵器、消費財に25%）",
  civilian: "民需優先（工場の15%で兵器、消費財に35%）",
  military: "軍需優先（工場の60%で兵器、消費財に15%）",
  "total-war": "総力戦（工場の80%で兵器、消費財に5%）",
} satisfies Readonly<Record<IndustryPlan, string>>;

const STANCE_LABELS = {
  balanced: "標準（守備の1.5倍の兵力がそろえば攻める）",
  defensive: "守勢（守備の3倍になるまで攻めない）",
  offensive: "攻勢（守備の1.1倍の兵力で攻める）",
} satisfies Readonly<Record<Stance, string>>;

const TERMS_LABELS = {
  annex: "全土を併合する",
  cede: "占領した土地だけを取って講和する",
  puppet: "傀儡国にして陣営に従わせる",
} satisfies Readonly<Record<PeaceTerms, string>>;

const MODIFIER_LABELS = {
  attack: "攻撃",
  construction: "建設速度",
  defence: "防御",
  manpower: "動員できる人数",
  organisation: "組織力",
  production: "装備の生産",
  recovery: "組織力の回復",
  research: "研究速度",
  supply: "補給",
} satisfies Readonly<Record<Modifier, string>>;

const GRANT_LABELS = {
  civilianFactories: "民需工場",
  militaryFactories: "軍需工場",
  researchSlots: "研究枠",
} satisfies Readonly<Record<keyof Grants, string>>;

const GRANTS: readonly (keyof Grants)[] = [
  "civilianFactories",
  "militaryFactories",
  "researchSlots",
];

const PERCENT = 100;

/** What a technology or a focus makes the nation better at, in words. */
const bonusWords = (bonus: Bonus): readonly string[] =>
  MODIFIERS.flatMap((modifier) => {
    const share = shareOf(bonus, modifier);
    if (share === 0) {
      return [];
    }
    return [`${MODIFIER_LABELS[modifier]}+${Math.round(share * PERCENT)}%`];
  });

/** What finishing a focus hands the nation once, in words. */
const grantWords = (grants: Grants): readonly string[] =>
  GRANTS.flatMap((grant) => {
    if (grants[grant] === 0) {
      return [];
    }
    return [`${GRANT_LABELS[grant]}+${grants[grant]}`];
  });

const techLabel = (tech: TechId): string => {
  const { bonus, name, year } = techOf(tech);
  return `${name}（${year}年の技術、${bonusWords(bonus).join("・")}）`;
};

const focusLabel = (focus: FocusId): string => {
  const { bonus, grants, name } = focusOf(focus);
  return `${name}（${[...grantWords(grants), ...bonusWords(bonus)].join("・")}）`;
};

const men = (count: number): string =>
  `${Math.round(count).toLocaleString("ja-JP")}人`;

/** The key a question about `nation` goes under, unique within one request. */
const keyOf = (nation: number, question: Question): string =>
  `n${nation}_${question}`;

/**
 * How many times over `other` the nation's men outnumber, or a word for a
 * nation facing nobody under arms.
 */
const ratioTo = (strength: number, other: number): number | string => {
  if (other <= 0) {
    return "相手は兵を出していない";
  }
  return Math.round((strength / other) * 100) / 100;
};

/**
 * The numbers a government reads, as Jev reads them. What the nation has
 * already chosen stays out, because Jev shown its current law and plan picks
 * them again whatever the war does, so it is handed the situation alone.
 */
const stateOf = (brief: NationBrief) => ({
  人口: Math.round(brief.population),
  人的資源: Math.round(brief.manpower),
  国: `国${brief.nation}`,
  工場: { 民需: brief.civilianFactories, 軍需: brief.militaryFactories },
  戦争中: brief.atWar,
  敵に対する兵力比: ratioTo(brief.strength, brief.enemyStrength),
  敵の兵力: Math.round(brief.enemyStrength),
  自陣営の兵力: Math.round(brief.strength),
  装備: Math.round(brief.equipment),
  補給が足りない師団の割合: Math.round(brief.undersupplied * 100) / 100,
  隣国: brief.rivals.map((rival) => ({
    こちらとの兵力比: ratioTo(brief.strength, rival.strength),
    国: `国${rival.nation}`,
    相手陣営の兵力: Math.round(rival.strength),
  })),
});

/** The questions one government is asked this month. */
const questionsOf = (brief: NationBrief): readonly Posed[] => {
  const { nation } = brief;
  const name = `国${nation}`;
  const asked: Posed[] = [
    {
      criteria: LAW_LABELS,
      instructions: `${name}の置かれた状況に最も合う徴兵法はどれですか。`,
      key: keyOf(nation, "conscription"),
      nation,
      question: "conscription",
    },
    {
      criteria: PLAN_LABELS,
      instructions: `${name}の置かれた状況に最も合う工業方針はどれですか。`,
      key: keyOf(nation, "plan"),
      nation,
      question: "plan",
    },
    {
      criteria: STANCE_LABELS,
      instructions: `${name}の兵力比から見て、陸軍が取るべき攻撃姿勢はどれですか。`,
      key: keyOf(nation, "stance"),
      nation,
      question: "stance",
    },
  ];
  if (brief.rivals.length > 0) {
    asked.push({
      criteria: Object.fromEntries([
        [NO_CHOICE, "どこにも宣戦しない"],
        ...brief.rivals.map((rival): [string, string] => [
          rivalChoice(rival.nation),
          `国${rival.nation}に宣戦する（相手陣営の兵力 ${men(rival.strength)}）`,
        ]),
      ]),
      instructions: `${name}は今月、隣国に宣戦しますか。戦争は負ければ国を失う賭けで、相手を大きく上回る兵力があるときだけ割に合います。`,
      key: keyOf(nation, "war"),
      nation,
      question: "war",
    });
  }
  if (brief.techs.length > 0) {
    asked.push({
      criteria: Object.fromEntries(
        brief.techs.map((tech): [string, string] => [tech, techLabel(tech)])
      ),
      instructions: `${name}には空いている研究枠が${brief.freeSlots}つあります。次に研究する技術として最も良いものはどれですか。今年より後の年の技術は、1年早いごとに研究にかかる日数が${AHEAD_OF_TIME_PER_YEAR}倍ずつ増えます。`,
      key: keyOf(nation, "research"),
      nation,
      question: "research",
    });
  }
  if (brief.focuses.length > 0) {
    asked.push({
      criteria: Object.fromEntries(
        brief.focuses.map((focus): [string, string] => [
          focus,
          focusLabel(focus),
        ])
      ),
      instructions: `${name}が次に進める国家方針はどれですか。国家方針は${FOCUS_DAYS}日かけて達成され、達成した日から効果が出ます。`,
      key: keyOf(nation, "focus"),
      nation,
      question: "focus",
    });
  }
  if (brief.factions.length > 0) {
    asked.push({
      criteria: Object.fromEntries([
        [NO_CHOICE, "どの陣営にも入らない"],
        ...brief.factions.map((option): [string, string] => [
          factionChoice(option.faction),
          `国${option.faction}陣営に入る（陣営の兵力 ${men(option.strength)}）`,
        ]),
      ]),
      instructions: `${name}は今月、陣営に入りますか。強い隣国に脅かされているなら、後ろ盾になる陣営が役に立ちます。`,
      key: keyOf(nation, "faction"),
      nation,
      question: "faction",
    });
  }
  return asked;
};

/** The request built from a list of questions and the state they share. */
const evaluationOf = (
  state: CouncilState | PeaceState,
  questions: readonly Posed[]
): Evaluation => ({
  asked: new Map(
    questions.map((posed) => [
      posed.key,
      {
        criteria: posed.criteria,
        nation: posed.nation,
        question: posed.question,
      },
    ])
  ),
  body: {
    model: JEV_MODEL,
    questions: Object.fromEntries(
      questions.map((posed) => [
        posed.key,
        {
          criteria: posed.criteria,
          instructions: posed.instructions,
          type: "choice",
        },
      ])
    ),
    state,
  },
});

const councilEvaluation = (council: Council): Evaluation =>
  evaluationOf(
    { 各国: council.nations.map(stateOf), 日付: council.date },
    council.nations.flatMap(questionsOf)
  );

const peaceEvaluation = (talks: PeaceTalks): Evaluation =>
  evaluationOf(
    {
      戦勝国: `国${talks.victor}`,
      戦勝国側が持つ敗戦国の本土の割合: talks.victorHeld,
      敗戦国: `国${talks.loser}`,
      敗戦国が持つ本土の割合: talks.loserHeld,
      日付: talks.date,
    },
    [
      {
        criteria: TERMS_LABELS,
        instructions: `国${talks.victor}は、降伏した国${talks.loser}にどの講和条件を課しますか。`,
        key: keyOf(talks.loser, "terms"),
        nation: talks.loser,
        question: "terms",
      },
    ]
  );

/**
 * The request that asks Jev about `consultation`.
 *
 * Every word of it is written here from the ids and numbers the schema
 * checked, so a caller can choose which of this app's questions to ask and
 * cannot put text of its own in front of the model.
 */
export const evaluationFor = (consultation: Consultation): Evaluation => {
  if (consultation._tag === "council") {
    return councilEvaluation(consultation);
  }
  return peaceEvaluation(consultation);
};

/** One answer as `/v1/evaluate` returns it. */
export interface ChoiceAnswer {
  readonly choice: string;
  readonly probabilities: Readonly<Record<string, number>>;
}

/** The weight an answer put on `choice`, which is none where it names none. */
const weightOf = (answer: ChoiceAnswer, choice: string): number =>
  Option.getOrElse(
    Option.fromUndefinedOr(answer.probabilities[choice]),
    () => 0
  );

/**
 * The verdicts the answers name, one per question asked. An answer to a
 * question nobody asked, or naming a choice the question did not offer, is
 * dropped.
 */
export const verdictsFrom = (
  asked: ReadonlyMap<string, Asked>,
  answers: Readonly<Record<string, ChoiceAnswer>>
): readonly Verdict[] =>
  Object.entries(answers).flatMap(([key, answer]) =>
    Option.toArray(Option.fromUndefinedOr(asked.get(key))).flatMap(
      (question) => {
        if (!Object.hasOwn(question.criteria, answer.choice)) {
          return [];
        }
        return [
          {
            choice: answer.choice,
            nation: question.nation,
            probability: weightOf(answer, answer.choice),
            question: question.question,
            weights: Object.keys(question.criteria).map((choice) => ({
              choice,
              probability: weightOf(answer, choice),
            })),
          },
        ];
      }
    )
  );
