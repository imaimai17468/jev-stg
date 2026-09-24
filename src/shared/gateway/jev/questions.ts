import "@tanstack/react-start/server-only";
import { Match, Option } from "effect";
import type {
  AgencyModifiers,
  AgencyProject,
} from "@/shared/entities/world/agency";
import {
  AGENCY_DAYS,
  factoriesFor,
  upgradeTermsOf,
} from "@/shared/entities/world/agency";
import {
  DROP_SUPERIORITY,
  TRANSPORTS_PER_DIVISION,
} from "@/shared/entities/world/airborne";
import type {
  Aircraft,
  AirframeModel,
  AirframeModels,
  Aviation,
} from "@/shared/entities/world/aircraft";
import {
  AIRCRAFT,
  AIRFRAME_MODELS,
  airframeOf,
  AVIATIONS,
  aviationShareOf,
} from "@/shared/entities/world/aircraft";
import type {
  BuildSite,
  Consultation,
  Council,
  NationBrief,
  PeaceTalks,
  Question,
  Verdict,
} from "@/shared/entities/world/consultation";
import {
  COUNTER_INTELLIGENCE_CHOICE,
  factionChoice,
  justifyChoice,
  NO_CHOICE,
  rivalChoice,
  siteChoice,
  spyChoice,
} from "@/shared/entities/world/consultation";
import type { DivisionKind } from "@/shared/entities/world/divisions";
import {
  raisingNameOf,
  equipmentOf,
  INFANTRY_EQUIPMENT,
  kindsUnlockedBy,
  manpowerOf,
  MIXED,
} from "@/shared/entities/world/divisions";
import type {
  ConscriptionLaw,
  IndustryPlan,
} from "@/shared/entities/world/economy";
import type { FocusId, Grants } from "@/shared/entities/world/focus";
import { FOCUS_DAYS, focusOf } from "@/shared/entities/world/focus";
import { constructionSpeedAt } from "@/shared/entities/world/infrastructure";
import { itemAt } from "@/shared/entities/world/lookup";
import type { Bonus, Modifier } from "@/shared/entities/world/modifiers";
import { MODIFIERS, shareOf } from "@/shared/entities/world/modifiers";
import type { PeaceTerms } from "@/shared/entities/world/peace";
import {
  AHEAD_OF_TIME_PER_YEAR,
  daysOf,
} from "@/shared/entities/world/research";
import type {
  ShipClass,
  ShipDesigns,
  ShipyardOrder,
} from "@/shared/entities/world/ships";
import {
  hullOf,
  orderOf,
  SHIP_DESIGNS,
  SHIPYARD_ORDERS,
} from "@/shared/entities/world/ships";
import type { Sighting } from "@/shared/entities/world/sightings";
import type { Stance } from "@/shared/entities/world/stance";
import type {
  ShipUpgrade,
  ShipWeapon,
  TechId,
} from "@/shared/entities/world/techs";
import { techOf } from "@/shared/entities/world/techs";
import type { TradeLaw } from "@/shared/entities/world/trade";
import { lawTermsOf, TRADE_LAWS } from "@/shared/entities/world/trade";
import {
  JUSTIFIED_DAYS,
  justifyingDays,
} from "@/shared/entities/world/war-goals";

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

const PERCENT = 100;

const TRADE_LAW_NAMES = {
  "closed-economy": "閉鎖経済",
  "export-focus": "輸出重視",
  "free-trade": "自由貿易",
  "limited-exports": "輸出制限",
} satisfies Readonly<Record<TradeLaw, string>>;

const percentOf = (share: number): string => `${Math.round(share * PERCENT)}%`;

/** What a trade law does, in words, read off the law's own terms. */
const tradeLawLabel = (law: TradeLaw): string => {
  const terms = lawTermsOf(law);
  if (terms.exported === 0) {
    return `${TRADE_LAW_NAMES[law]}（資源を売らない。上乗せなし）`;
  }
  return `${TRADE_LAW_NAMES[law]}（掘った資源の${percentOf(terms.exported)}まで売る。工場・造船・建設+${percentOf(terms.industry)}、研究+${percentOf(terms.research)}）`;
};

const TRADE_LAW_LABELS = Object.fromEntries(
  TRADE_LAWS.map((law) => [law, tradeLawLabel(law)])
);

/**
 * What each order builds, in words, around the design `designs` lays down
 * for its class and the cost its dockyards pay.
 */
const ORDER_WORDS = {
  battleship: (cost: number, designs: ShipDesigns) =>
    `戦艦（${techOf(designs.battleship).name}、費用${cost}、制海権への重みが最も大きい）`,
  carrier: (cost: number, designs: ShipDesigns) =>
    `空母（${techOf(designs.carrier).name}、費用${cost}、艦載機${hullOf(designs.carrier).deck}機のうち半数の雷撃機で敵艦を攻撃し、半数の戦闘機で海の上の制空権を争う）`,
  convoy: (cost: number) =>
    `輸送船（費用${cost}、海越しの補給・交易・上陸に使う）`,
  cruiser: (cost: number, designs: ShipDesigns) =>
    `巡洋艦（${techOf(designs.cruiser).name}、費用${cost}、主力艦を守る護衛艦）`,
  destroyer: (cost: number, designs: ShipDesigns) =>
    `駆逐艦（${techOf(designs.destroyer).name}、費用${cost}、護衛艦で、潜水艦を爆雷で沈める）`,
  submarine: (cost: number, designs: ShipDesigns) =>
    `潜水艦（${techOf(designs.submarine).name}、費用${cost}、敵の輸送船を沈める）`,
} satisfies Readonly<
  Record<ShipyardOrder, (cost: number, designs: ShipDesigns) => string>
>;

/** What each order builds, in words, for dockyards laying down `designs`. */
const orderLabelsOf = (designs: ShipDesigns) =>
  Object.fromEntries(
    SHIPYARD_ORDERS.map((order) => [
      order,
      ORDER_WORDS[order](Math.round(orderOf(order, designs).cost), designs),
    ])
  );

/** What each plane does, in words, around the design and what one costs a military factory. */
const AIRCRAFT_WORDS = {
  "close-support": (cost: number, name: string) =>
    `近接航空支援機（${name}、1機の費用${cost}、前線の敵師団の組織力を削る）`,
  fighter: (cost: number, name: string) =>
    `戦闘機（${name}、1機の費用${cost}、敵機を落として制空権を取る。敵に制空権を握られると陸戦の力が最大35%、行軍の速さが最大30%落ちる）`,
  "naval-bomber": (cost: number, name: string) =>
    `雷撃機（${name}、1機の費用${cost}、送られた海の敵艦を攻撃して沈める）`,
  transport: (cost: number, name: string) =>
    `輸送機（${name}、1機の費用${cost}、空挺師団を敵の後方に降下させる。1個師団に${TRANSPORTS_PER_DIVISION}機、降下する空域の制空権を${percentOf(DROP_SUPERIORITY)}以上握っているときだけ飛べる）`,
} satisfies Readonly<Record<Aircraft, (cost: number, name: string) => string>>;

/**
 * What a plane design is called: its technology's name, or, for the transport
 * no technology unlocks, the year Hearts of Iron IV dates it.
 */
const designNameOf = (model: AirframeModel): string =>
  Match.value(model).pipe(
    Match.when("transport-plane-1", () => "1933年型"),
    Match.orElse((researched) => techOf(researched).name)
  );

/** What each plane does, in words, for factories building `models`. */
const aircraftLabelsOf = (models: AirframeModels) =>
  Object.fromEntries(
    AIRCRAFT.map((aircraft) => [
      aircraft,
      AIRCRAFT_WORDS[aircraft](
        airframeOf(models[aircraft]).cost,
        designNameOf(models[aircraft])
      ),
    ])
  );

const men = (count: number): string =>
  `${Math.round(count).toLocaleString("ja-JP")}人`;

/** What each kind of division is good and bad at, in words, read off its battalions. */
const DIVISION_KIND_TRAITS = {
  cavalry: "歩兵より速く、丘・森・山では攻撃が少し落ちる",
  "heavy-armour":
    "重戦車と自動車化歩兵の混成で、中戦車より攻撃は弱く守りは少し固い。戦車のうち最も遅く、森・山と上陸では攻撃が大きく落ち、組織力が低い",
  infantry: "最も安く、どの地形でも同じように戦う",
  "light-armour":
    "軽戦車と自動車化歩兵の混成で速く攻撃が強いが、森では速さが落ち、組織力が低い",
  marines:
    "ほかの兵種は上陸すると攻撃が半分以下に落ちるが、海兵は陸上と同じ攻撃で戦える。組織力が高い",
  mechanized: "装甲車で守りが固く速いが、森では攻撃が落ちる",
  "medium-armour":
    "中戦車と自動車化歩兵の混成で軽戦車より攻撃が強いが、森・山と上陸では攻撃が落ち、組織力が低い",
  motorized:
    "歩兵の3倍の速さで進む。森では速さが半分に落ちるが、それでも歩兵より速い",
  mountaineers: "山と丘で攻撃・守り・速さが上がり、組織力が高い",
  paratroopers: "組織力が高い。空挺降下はまだできない",
} satisfies Readonly<Record<DivisionKind, string>>;

/** How the division-kind question words one kind: what a division of it costs and what it is good at. */
const divisionKindLabel = (kind: DivisionKind): string =>
  `${raisingNameOf(kind)}（1師団に兵員${men(manpowerOf(kind))}・装備${Math.round(equipmentOf(kind)).toLocaleString("ja-JP")}、${DIVISION_KIND_TRAITS[kind]}）`;

/** What each weight of aviation puts on planes, in words, read off its share. */
const aviationLabel = (aviation: Aviation): string => {
  const share = aviationShareOf(aviation);
  if (share === 0) {
    return "航空機を作らない（軍需工場はすべて装備を作る）";
  }
  return `軍需工場の${percentOf(share)}で航空機を作り、残りで装備を作る`;
};

const AVIATION_LABELS = Object.fromEntries(
  AVIATIONS.map((aviation) => [aviation, aviationLabel(aviation)])
);

const TERMS_LABELS = {
  annex: "全土を併合する",
  cede: "占領した土地だけを取って講和する",
  puppet: "傀儡国にして陣営に従わせる",
} satisfies Readonly<Record<PeaceTerms, string>>;

/** How much faster each level of infrastructure builds, in percent, as the question words it. */
const CONSTRUCTION_SPEED_PERCENT_PER_LEVEL = Math.round(
  (constructionSpeedAt(1) - 1) * 100
);

/** What the build-site question says of a province's coast: that it has one, or nothing. */
const coastWords = (site: BuildSite): readonly string[] => {
  if (site.coastal) {
    return ["沿岸"];
  }
  return [];
};

/** How the build-site question words one province it offers. */
const buildSiteLabel = (site: BuildSite): string =>
  [
    `州${site.province}`,
    `インフラ${site.infrastructure}`,
    `空き枠${site.free}`,
    ...coastWords(site),
  ].join("・");

const MODIFIER_LABELS = {
  attack: "攻撃",
  buildingSlots: "州の建設枠",
  construction: "建設速度",
  defence: "防御",
  dockyards: "造船",
  extraction: "資源の採掘",
  manpower: "動員できる人数",
  organisation: "組織力",
  production: "装備の生産",
  recovery: "組織力の回復",
  refining: "石油から得る燃料",
  research: "研究速度",
  supply: "補給",
} satisfies Readonly<Record<Modifier, string>>;

const SHIP_CLASS_NAMES = {
  battleship: "戦艦",
  carrier: "空母",
  cruiser: "巡洋艦",
  destroyer: "駆逐艦",
  submarine: "潜水艦",
} satisfies Readonly<Record<ShipClass, string>>;

const WEAPON_NAMES = {
  heavy: "重攻撃",
  light: "軽攻撃",
  torpedo: "魚雷攻撃",
} satisfies Readonly<Record<ShipWeapon, string>>;

/** What a technology adds to warships' weapons, in words. */
const upgradeWords = (upgrades: readonly ShipUpgrade[]): readonly string[] =>
  upgrades.map(
    (upgrade) =>
      `${SHIP_CLASS_NAMES[upgrade.shipClass]}の${WEAPON_NAMES[upgrade.weapon]}+${Math.round(upgrade.share * PERCENT)}%`
  );

/** The technologies that unlock each kind of design, and what researching one does, in words. */
const DESIGN_WORDS: readonly (readonly [ReadonlySet<string>, string])[] = [
  [new Set(SHIP_DESIGNS), "造船所が新しい型で造る"],
  [new Set(AIRFRAME_MODELS), "工場が新しい型の機体を作る"],
  [new Set(INFANTRY_EQUIPMENT), "師団が新しい世代の装備で戦う"],
];

/** What researching `tech` brings in the way of a new design, in words. */
const designWords = (tech: TechId): readonly string[] =>
  DESIGN_WORDS.flatMap(([techs, words]) => {
    if (!techs.has(tech)) {
      return [];
    }
    return [words];
  });

/** The kinds of division researching `tech` lets the nation raise, in words. */
const unlockWords = (tech: TechId): readonly string[] =>
  kindsUnlockedBy(tech).map(
    (kind) => `${raisingNameOf(kind)}の師団を編成できるようになる`
  );

const GRANT_LABELS = {
  civilianFactories: "民需工場",
  militaryFactories: "軍需工場",
  operatives: "工作員の枠",
  researchSlots: "研究枠",
} satisfies Readonly<Record<keyof Grants, string>>;

const GRANTS: readonly (keyof Grants)[] = [
  "civilianFactories",
  "militaryFactories",
  "researchSlots",
  "operatives",
];

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
  const { bonus, name, upgrades, year } = techOf(tech);
  const effects = [
    ...designWords(tech),
    ...unlockWords(tech),
    ...bonusWords(bonus),
    ...upgradeWords(upgrades),
  ];
  const told = itemAt(
    [effects, ["それ自体の効果はなく、次の技術を開く"]],
    Number(effects.length === 0),
    effects
  );
  return `${name}（${year}年の技術、研究${daysOf(tech)}日、${told.join("・")}）`;
};

const focusLabel = (focus: FocusId): string => {
  const { bonus, grants, name } = focusOf(focus);
  return `${name}（${[...grantWords(grants), ...bonusWords(bonus)].join("・")}）`;
};

/** What an agency upgrade's first level adds, by what it changes, and whether it counts points rather than a share. */
const AGENCY_GAIN_WORDS = {
  airIntel: { label: "空軍の諜報", points: false },
  armyIntel: { label: "陸軍の諜報", points: false },
  assets: { label: "工作員と潜入から得る諜報", points: false },
  blueprintRisk: { label: "設計図を盗む作戦で捕まる危険", points: false },
  blueprints: { label: "盗んだ設計図の研究ボーナス", points: false },
  capture: { label: "敵の工作員を捕まえる確率", points: false },
  civilianIntel: { label: "経済の諜報", points: false },
  counterIntelligence: { label: "防諜", points: true },
  cryptology: { label: "自国の暗号の強さ", points: true },
  decryption: { label: "1日の解読力", points: true },
  extraction: { label: "捕らえた工作員から得る諜報", points: false },
  navyIntel: { label: "海軍の諜報", points: false },
  resistance: { label: "抵抗運動を強める作戦の効果", points: false },
} satisfies Readonly<
  Record<
    keyof AgencyModifiers,
    { readonly label: string; readonly points: boolean }
  >
>;

const AGENCY_GAINS = Object.keys(AGENCY_GAIN_WORDS).filter(
  (key): key is keyof AgencyModifiers => Object.hasOwn(AGENCY_GAIN_WORDS, key)
);

/** The sign an amount is written with, which a negative amount already carries. */
const signOf = (amount: number): string =>
  itemAt(["+", ""], Number(amount < 0), "+");

/** A signed amount, as a share or as points. */
const signed = (amount: number, points: boolean): string => {
  if (points) {
    return `${signOf(amount)}${amount}`;
  }
  return `${signOf(amount)}${Math.round(amount * PERCENT)}%`;
};

/** What founding the agency or buying one of its upgrades does and costs, in words. */
const agencyLabel = (project: AgencyProject): string => {
  const cost = `民需工場${factoriesFor(project)}つを${AGENCY_DAYS}日使う`;
  if (project === "found") {
    return `諜報機関を設立する（${cost}。設立すると工作員を1人雇える）`;
  }
  const { levels, name } = upgradeTermsOf(project);
  const first: Partial<AgencyModifiers> = itemAt(levels, 0, {});
  const words = AGENCY_GAINS.flatMap((key) => {
    const amount = first[key] ?? 0;
    if (amount === 0) {
      return [];
    }
    return [
      `${AGENCY_GAIN_WORDS[key].label}${signed(amount, AGENCY_GAIN_WORDS[key].points)}`,
    ];
  });
  return `${name}（${cost}、${words.join("・")}、全${levels.length}段階）`;
};

/** The nations a figure leaves out, in words, or nothing where it leaves none out. */
const unseenWords = (unseen: number): string => {
  if (unseen === 0) {
    return "";
  }
  return `、ほかに数のわからない国が${unseen}`;
};

/**
 * What a government believes an amount comes to, in words: the figure
 * itself where it sees every nation exactly, and otherwise its estimate with
 * the widest error and the nations it has no figure for.
 */
const sightingWords = (
  sighting: Sighting,
  unit: (amount: number) => string
): string => {
  const unseen = unseenWords(sighting.unseen);
  if (sighting.estimate === 0 && sighting.unseen > 0) {
    return `不明（${sighting.unseen}国）`;
  }
  if (sighting.margin === 0) {
    return `${unit(sighting.estimate)}${unseen}`;
  }
  return `約${unit(sighting.estimate)}（±${Math.round(sighting.margin * PERCENT)}%）${unseen}`;
};

const counted = (amount: number): string =>
  Math.round(amount).toLocaleString("ja-JP");

/** The key a question about `nation` goes under, unique within one request. */
const keyOf = (nation: number, question: Question): string =>
  `n${nation}_${question}`;

/**
 * How many times over `other` the nation's men outnumber, or a word for a
 * nation facing nobody under arms.
 */
const ratioTo = (strength: number, other: Sighting): number | string => {
  if (other.estimate <= 0 && other.unseen > 0) {
    return "相手の兵力がわからない";
  }
  if (other.estimate <= 0) {
    return "相手は兵を出していない";
  }
  return Math.round((strength / other.estimate) * 100) / 100;
};

/** Each of `rivals` as Jev reads it, against the men `strength` counts on its own side. */
const rivalRows = (strength: number, rivals: NationBrief["rivals"]) =>
  rivals.map((rival) => ({
    こちらとの兵力比: ratioTo(strength, rival.strength),
    国: `国${rival.nation}`,
    相手陣営の兵力: sightingWords(rival.strength, men),
  }));

/**
 * The numbers a government reads, as Jev reads them. What the nation has
 * already chosen stays out, because Jev shown its current law and plan picks
 * them again whatever the war does, so it is handed the situation alone.
 */
const stateOf = (brief: NationBrief) => ({
  世界緊張度: percentOf(brief.tension),
  人口: Math.round(brief.population),
  人的資源: Math.round(brief.manpower),
  国: `国${brief.nation}`,
  宣戦できる国: rivalRows(brief.strength, brief.rivals),
  工作員: brief.operatives,
  工場: { 民需: brief.civilianFactories, 軍需: brief.militaryFactories },
  戦争中: brief.atWar,
  敵に制空権を握られている空の割合: Math.round(brief.skyLost * 100) / 100,
  敵に対する兵力比: ratioTo(brief.strength, brief.enemyStrength),
  敵の兵力: sightingWords(brief.enemyStrength, men),
  敵の航空機: sightingWords(brief.enemyPlanes, counted),
  敵の艦隊の強さ: sightingWords(brief.enemyFleet, counted),
  正当化できる国: rivalRows(brief.strength, brief.justifiable),
  燃料の備蓄の割合: Math.round(brief.fuel * 100) / 100,
  自陣営の兵力: Math.round(brief.strength),
  航空機: Math.round(brief.planes),
  艦隊の強さ: Math.round(brief.fleet),
  装備: Math.round(brief.equipment),
  補給が足りない師団の割合: Math.round(brief.undersupplied * 100) / 100,
  資源不足で落ちた軍需生産の割合: Math.round(brief.shortage * 100) / 100,
  輸送船: Math.round(brief.convoys),
  造船所: brief.dockyards,
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
          `国${rival.nation}に宣戦する（相手陣営の兵力 ${sightingWords(rival.strength, men)}）`,
        ]),
      ]),
      instructions: `${name}は今月、戦争目標の正当化を終えた国に宣戦しますか。正当化した戦争目標は${JUSTIFIED_DAYS}日で失効します。戦争は負ければ国を失う賭けで、相手を大きく上回る兵力があるときだけ割に合います。宣戦すると世界緊張度が上がります。`,
      key: keyOf(nation, "war"),
      nation,
      question: "war",
    });
  }
  if (brief.justifiable.length > 0) {
    asked.push({
      criteria: Object.fromEntries([
        [NO_CHOICE, "どの国にも戦争目標を正当化しない"],
        ...brief.justifiable.map((rival): [string, string] => [
          justifyChoice(rival.nation),
          `国${rival.nation}への戦争目標を正当化する（相手陣営の兵力 ${sightingWords(rival.strength, men)}）`,
        ]),
      ]),
      instructions: `${name}は今月、陸で接する国か、艦隊で海を渡れる国への戦争目標の正当化を始めますか。正当化には${justifyingDays(brief.tension)}日かかり、終わるまで宣戦できません。正当化を始めると世界緊張度が上がり、ほかの国も正当化を始めやすくなります。`,
      key: keyOf(nation, "justify"),
      nation,
      question: "justify",
    });
  }
  asked.push({
    criteria: TRADE_LAW_LABELS,
    instructions: `${name}はどの交易法を取りますか。売る割合が大きいほど工場と研究に上乗せが付きます。資源の足りない国に買われると、資源8単位ごとに相手の民需工場を1つ受け取って建設に使え、そのぶん手元の資源は減ります。`,
    key: keyOf(nation, "trade"),
    nation,
    question: "trade",
  });
  if (brief.buildSites.length > 0) {
    asked.push({
      criteria: Object.fromEntries(
        brief.buildSites.map((site): [string, string] => [
          siteChoice(site.province),
          buildSiteLabel(site),
        ])
      ),
      instructions: `${name}は次の工場をどの州に建てますか。建てる州のインフラが1段階高いごとに建設が${CONSTRUCTION_SPEED_PERCENT_PER_LEVEL}%速くなり、造船所は沿岸の州にしか建ちません。選んだ州に空き枠があるあいだはそこに建ち、空き枠がないか州を失っているあいだは最もインフラの高い州に建ちます。`,
      key: keyOf(nation, "build-site"),
      nation,
      question: "build-site",
    });
  }
  if (brief.dockyards > 0) {
    asked.push({
      criteria: orderLabelsOf(brief.shipDesigns),
      instructions: `${name}の造船所は次に何を造りますか。戦艦1隻には護衛艦3隻が付くと命中が上がり、輸送船が足りないと海越しの補給と上陸が止まります。`,
      key: keyOf(nation, "shipbuilding"),
      nation,
      question: "shipbuilding",
    });
  }
  asked.push(
    {
      criteria: AVIATION_LABELS,
      instructions: `${name}は軍需工場のどれだけを航空機の生産に回しますか。航空機が多いほど制空権を取りやすくなりますが、そのぶん師団の装備が減り、航空機はアルミとゴムを使います。`,
      key: keyOf(nation, "aviation"),
      nation,
      question: "aviation",
    },
    {
      criteria: aircraftLabelsOf(brief.planeModels),
      instructions: `${name}の航空機工場は次にどの機種を作りますか。戦闘機がいないと制空権を奪われ、近接航空支援機と雷撃機も撃ち落とされます。`,
      key: keyOf(nation, "aircraft"),
      nation,
      question: "aircraft",
    },
    {
      criteria: Object.fromEntries([
        [
          MIXED,
          "国柄の編成比率どおり（研究で編成できる兵種を、比率に足りない順に1つずつ編成する）",
        ],
        ...brief.divisionKinds.map((kind): [string, string] => [
          kind,
          divisionKindLabel(kind),
        ]),
      ]),
      instructions: `${name}は次にどの兵種の師団を編成しますか。選択肢は研究で編成できるようになった兵種です。選んだ兵種は変えるまで編成し続け、装備が足りない日は編成せずに貯めます。兵員が1師団分に足りないあいだは、国柄の編成比率どおりに編成します。`,
      key: keyOf(nation, "division-kind"),
      nation,
      question: "division-kind",
    }
  );
  if (brief.techs.length > 0) {
    asked.push({
      criteria: Object.fromEntries(
        brief.techs.map((tech): [string, string] => [tech, techLabel(tech)])
      ),
      instructions: `${name}には空いている研究枠が${brief.freeSlots}つあります。次に研究する技術として最も良いものはどれですか。選択肢は分野ごとに今始められるいちばん早い年の技術です。今年より後の年の技術は、研究の速さが「1＋${AHEAD_OF_TIME_PER_YEAR}×早い年数」分の1に落ちます。`,
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
  if (brief.agencyProjects.length > 0) {
    asked.push({
      criteria: Object.fromEntries([
        [NO_CHOICE, "今月は何も始めない"],
        ...brief.agencyProjects.map((project): [string, string] => [
          project,
          agencyLabel(project),
        ]),
      ]),
      instructions: `${name}の諜報機関は今月、何に取り組みますか。設立も強化も${AGENCY_DAYS}日かかり、そのあいだ民需工場を建設から外します。諜報が高いほど、敵の兵力・艦隊・航空機の数が正確にわかり、陸戦で相手より強く戦えます。`,
      key: keyOf(nation, "agency"),
      nation,
      question: "agency",
    });
  }
  if (brief.operatives > 0) {
    asked.push({
      criteria: Object.fromEntries([
        [
          COUNTER_INTELLIGENCE_CHOICE,
          "工作員を自国に置き、敵の工作員を捕まえる",
        ],
        ...brief.spyTargets.map((option): [string, string] => [
          spyChoice(option.nation),
          `国${option.nation}に工作員を送る（いまの諜報 ${percentOf(option.known)}）`,
        ]),
      ]),
      instructions: `${name}は工作員をどこに置きますか。送った国には諜報網が育ち、その国の軍や経済の数がわかるようになり、網が育つと潜入・暗号の奪取・設計図の窃取・抵抗運動の支援といった作戦を行います。送った先で捕まることもあります。`,
      key: keyOf(nation, "espionage"),
      nation,
      question: "espionage",
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

/**
 * The consultations `consultation` is put to Jev as, one request each: a
 * council government by government, each carrying its own numbers alone, and
 * peace talks as they are. On 2026-09-24 Jev answered a request carrying one
 * government's questions and refused with 503 every one carrying four
 * governments' or more.
 */
export const partsOf = (
  consultation: Consultation
): readonly Consultation[] => {
  if (consultation._tag === "council") {
    return consultation.nations.map((brief) => ({
      ...consultation,
      nations: [brief],
    }));
  }
  return [consultation];
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
