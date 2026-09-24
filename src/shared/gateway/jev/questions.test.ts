import { describe, expect, it } from "vite-plus/test";
import { OPENING_ARMOURY } from "@/shared/entities/world/armoury";
import type {
  Council,
  NationBrief,
  PeaceTalks,
} from "@/shared/entities/world/consultation";
import type { Sighting } from "@/shared/entities/world/sightings";
import { evaluationFor, verdictsFrom } from "./questions";

/** A figure the government sees exactly, with every nation behind it in view. */
const exactly = (estimate: number): Sighting => ({
  estimate,
  margin: 0,
  unseen: 0,
});

const BRIEF: NationBrief = {
  agencyProjects: [],
  atWar: true,
  buildSites: [],
  civilianFactories: 20,
  convoys: 12.4,
  divisionKinds: OPENING_ARMOURY.kinds,
  dockyards: 0,
  enemyFleet: exactly(30.6),
  enemyPlanes: exactly(480.6),
  enemyStrength: exactly(40_000),
  equipment: 1500.4,
  factions: [{ faction: 0, strength: 60_000 }],
  fleet: 10.2,
  focuses: [],
  freeSlots: 0,
  fuel: 0.726,
  justifiable: [],
  manpower: 90_000.6,
  militaryFactories: 5,
  nation: 1,
  operatives: 0,
  planeModels: OPENING_ARMOURY.planes,
  planes: 300.4,
  population: 3_000_000.2,
  posted: false,
  rivals: [{ nation: 2, strength: exactly(20_000) }],
  shipDesigns: OPENING_ARMOURY.ships,
  shortage: 0.126,
  skyLost: 0.334,
  spyTargets: [],
  strength: 20_000,
  techs: [],
  tension: 0.12,
  undersupplied: 0.254,
};

/** What a test changes in the state row `BRIEF` gives Jev. */
interface StatePatch {
  readonly 宣戦できる国?: readonly unknown[];
  readonly 戦争中?: boolean;
  readonly 敵に対する兵力比?: string;
  readonly 敵の兵力?: string;
}

/** The state row `BRIEF` gives Jev, with `patch` in place of what a test changed. */
const stateWith = (patch: StatePatch) => ({
  各国: [
    {
      世界緊張度: "12%",
      人口: 3_000_000,
      人的資源: 90_001,
      国: "国1",
      宣戦できる国: [
        { こちらとの兵力比: 1, 国: "国2", 相手陣営の兵力: "20,000人" },
      ],
      工作員: 0,
      工場: { 民需: 20, 軍需: 5 },
      戦争中: true,
      敵に制空権を握られている空の割合: 0.33,
      敵に対する兵力比: 0.5,
      敵の兵力: "40,000人",
      敵の航空機: "481",
      敵の艦隊の強さ: "31",
      正当化できる国: [],
      燃料の備蓄の割合: 0.73,
      自陣営の兵力: 20_000,
      航空機: 300,
      艦隊の強さ: 10,
      装備: 1500,
      補給が足りない師団の割合: 0.25,
      資源不足で落ちた軍需生産の割合: 0.13,
      輸送船: 12,
      造船所: 0,
      ...patch,
    },
  ],
  日付: "1936-03-01",
});

const COUNCIL: Council = {
  _tag: "council",
  date: "1936-03-01",
  nations: [BRIEF],
};

const TALKS: PeaceTalks = {
  _tag: "peace",
  date: "1937-05-02",
  loser: 3,
  loserHeld: 0.1,
  victor: 0,
  victorHeld: 0.7,
};

describe(evaluationFor, () => {
  it("should ask a government about its law, plan, stance, war, trade, planes and faction when it has rivals and factions in reach", () => {
    expect(Object.keys(evaluationFor(COUNCIL).body.questions)).toStrictEqual([
      "n1_conscription",
      "n1_plan",
      "n1_stance",
      "n1_war",
      "n1_trade",
      "n1_aviation",
      "n1_aircraft",
      "n1_division-kind",
      "n1_faction",
    ]);
  });

  it("should offer justifying on each nation it may, or on nobody, with the days it takes when the justify question is asked", () => {
    const justifying: Council = {
      ...COUNCIL,
      nations: [
        {
          ...BRIEF,
          justifiable: [{ nation: 3, strength: exactly(10_000) }],
          tension: 0.5,
        },
      ],
    };

    expect(evaluationFor(justifying).body.questions.n1_justify).toStrictEqual({
      criteria: {
        j3: "国3への戦争目標を正当化する（相手陣営の兵力 10,000人）",
        none: "どの国にも戦争目標を正当化しない",
      },
      instructions:
        "国1は今月、陸で接する国か、艦隊で海を渡れる国への戦争目標の正当化を始めますか。正当化には135日かかり、終わるまで宣戦できません。正当化を始めると世界緊張度が上がり、ほかの国も正当化を始めやすくなります。",
      type: "choice",
    });
  });

  it("should ask what the dockyards build next when the nation has dockyards", () => {
    const building: Council = {
      ...COUNCIL,
      nations: [{ ...BRIEF, dockyards: 3 }],
    };

    expect(
      evaluationFor(building).body.questions.n1_shipbuilding
    ).toStrictEqual({
      criteria: {
        battleship: "戦艦（戦艦II、費用12960、制海権への重みが最も大きい）",
        carrier:
          "空母（空母II、費用8822、艦載機10機のうち半数の雷撃機で敵艦を攻撃し、半数の戦闘機で海の上の制空権を争う）",
        convoy: "輸送船（費用100、海越しの補給・交易・上陸に使う）",
        cruiser: "巡洋艦（軽巡洋艦II、費用3302、主力艦を守る護衛艦）",
        destroyer:
          "駆逐艦（駆逐艦II、費用1185、護衛艦で、潜水艦を爆雷で沈める）",
        submarine: "潜水艦（潜水艦II、費用451、敵の輸送船を沈める）",
      },
      instructions:
        "国1の造船所は次に何を造りますか。戦艦1隻には護衛艦3隻が付くと命中が上がり、輸送船が足りないと海越しの補給と上陸が止まります。",
      type: "choice",
    });
  });

  it("should offer each province with its infrastructure, its free slots and its coast when the nation has somewhere to build", () => {
    const building: Council = {
      ...COUNCIL,
      nations: [
        {
          ...BRIEF,
          buildSites: [
            { coastal: true, free: 4, infrastructure: 5, province: 3 },
            { coastal: false, free: 1, infrastructure: 2, province: 8 },
          ],
        },
      ],
    };

    expect(
      evaluationFor(building).body.questions["n1_build-site"]
    ).toStrictEqual({
      criteria: {
        p3: "州3・インフラ5・空き枠4・沿岸",
        p8: "州8・インフラ2・空き枠1",
      },
      instructions:
        "国1は次の工場をどの州に建てますか。建てる州のインフラが1段階高いごとに建設が20%速くなり、造船所は沿岸の州にしか建ちません。選んだ州に空き枠があるあいだはそこに建ち、空き枠がないか州を失っているあいだは最もインフラの高い州に建ちます。",
      type: "choice",
    });
  });

  it("should offer each weight of aviation with the share of military factories it takes when the aviation question is asked", () => {
    expect(evaluationFor(COUNCIL).body.questions.n1_aviation).toStrictEqual({
      criteria: {
        heavy: "軍需工場の40%で航空機を作り、残りで装備を作る",
        light: "軍需工場の20%で航空機を作り、残りで装備を作る",
        none: "航空機を作らない（軍需工場はすべて装備を作る）",
      },
      instructions:
        "国1は軍需工場のどれだけを航空機の生産に回しますか。航空機が多いほど制空権を取りやすくなりますが、そのぶん師団の装備が減り、航空機はアルミとゴムを使います。",
      type: "choice",
    });
  });

  it("should offer each plane with its model, what one costs and what it does when the aircraft question is asked", () => {
    expect(evaluationFor(COUNCIL).body.questions.n1_aircraft).toStrictEqual({
      criteria: {
        "close-support":
          "近接航空支援機（近接航空支援機I、1機の費用22、前線の敵師団の組織力を削る）",
        fighter:
          "戦闘機（戦闘機I、1機の費用24、敵機を落として制空権を取る。敵に制空権を握られると陸戦の力が最大35%、行軍の速さが最大30%落ちる）",
        "naval-bomber":
          "雷撃機（雷撃機I、1機の費用26、送られた海の敵艦を攻撃して沈める）",
        transport:
          "輸送機（1933年型、1機の費用4、空挺師団を敵の後方に降下させる。1個師団に45機、降下する空域の制空権を70%以上握っているときだけ飛べる）",
      },
      instructions:
        "国1の航空機工場は次にどの機種を作りますか。戦闘機がいないと制空権を奪われ、近接航空支援機と雷撃機も撃ち落とされます。",
      type: "choice",
    });
  });

  it("should offer each kind its research has unlocked with what a division costs and what it is good at when the division-kind question is asked", () => {
    const raising: Council = {
      ...COUNCIL,
      nations: [{ ...BRIEF, divisionKinds: ["infantry", "light-armour"] }],
    };

    expect(
      evaluationFor(raising).body.questions["n1_division-kind"]
    ).toStrictEqual({
      criteria: {
        infantry:
          "歩兵（1師団に兵員20,000人・装備1,000、最も安く、どの地形でも同じように戦う）",
        "light-armour":
          "軽戦車（1師団に兵員17,000人・装備6,175、軽戦車と自動車化歩兵の混成で速く攻撃が強いが、森では速さが落ち、組織力が低い）",
        mix: "国柄の編成比率どおり（研究で編成できる兵種を、比率に足りない順に1つずつ編成する）",
      },
      instructions:
        "国1は次にどの兵種の師団を編成しますか。選択肢は研究で編成できるようになった兵種です。選んだ兵種は変えるまで編成し続け、装備が足りない日は編成せずに貯めます。兵員が1師団分に足りないあいだは、国柄の編成比率どおりに編成します。",
      type: "choice",
    });
  });

  it("should offer every trade law with what it sells and adds when the trade question is asked", () => {
    expect(evaluationFor(COUNCIL).body.questions.n1_trade).toStrictEqual({
      criteria: {
        "closed-economy": "閉鎖経済（資源を売らない。上乗せなし）",
        "export-focus":
          "輸出重視（掘った資源の50%まで売る。工場・造船・建設+10%、研究+5%）",
        "free-trade":
          "自由貿易（掘った資源の80%まで売る。工場・造船・建設+15%、研究+10%）",
        "limited-exports":
          "輸出制限（掘った資源の25%まで売る。工場・造船・建設+5%、研究+1%）",
      },
      instructions:
        "国1はどの交易法を取りますか。売る割合が大きいほど工場と研究に上乗せが付きます。資源の足りない国に買われると、資源8単位ごとに相手の民需工場を1つ受け取って建設に使え、そのぶん手元の資源は減ります。",
      type: "choice",
    });
  });

  it("should leave out war and faction when the brief offers neither", () => {
    const quiet: Council = {
      ...COUNCIL,
      nations: [{ ...BRIEF, factions: [], rivals: [] }],
    };

    expect(Object.keys(evaluationFor(quiet).body.questions)).toStrictEqual([
      "n1_conscription",
      "n1_plan",
      "n1_stance",
      "n1_trade",
      "n1_aviation",
      "n1_aircraft",
      "n1_division-kind",
    ]);
  });

  it("should offer declaring on each rival, or on nobody, when the war question is asked", () => {
    expect(evaluationFor(COUNCIL).body.questions.n1_war).toStrictEqual({
      criteria: {
        n2: "国2に宣戦する（相手陣営の兵力 20,000人）",
        none: "どこにも宣戦しない",
      },
      instructions:
        "国1は今月、戦争目標の正当化を終えた国に宣戦しますか。正当化した戦争目標は60日で失効します。戦争は負ければ国を失う賭けで、相手を大きく上回る兵力があるときだけ割に合います。宣戦すると世界緊張度が上がります。",
      type: "choice",
    });
  });

  it("should offer joining each faction, or none, when the faction question is asked", () => {
    expect(evaluationFor(COUNCIL).body.questions.n1_faction).toStrictEqual({
      criteria: {
        f0: "国0陣営に入る（陣営の兵力 60,000人）",
        none: "どの陣営にも入らない",
      },
      instructions:
        "国1は今月、陣営に入りますか。強い隣国に脅かされているなら、後ろ盾になる陣営が役に立ちます。",
      type: "choice",
    });
  });

  it("should offer each technology a free slot may start, with its year, its research days and what it adds, when a slot is free", () => {
    const researching: Council = {
      ...COUNCIL,
      nations: [
        {
          ...BRIEF,
          freeSlots: 2,
          techs: [
            "destroyer-3",
            "fighter-2",
            "infantry-equipment-2",
            "improved-infantry-equipment-1",
            "concentrated-industry-1",
            "small-caliber-semi-armor-piercing-shell",
            "basic-light-battery",
            "truck",
          ],
        },
      ],
    };

    expect(evaluationFor(researching).body.questions.n1_research).toStrictEqual(
      {
        criteria: {
          "basic-light-battery":
            "基本小口径砲（1936年の技術、研究110日、それ自体の効果はなく、次の技術を開く）",
          "concentrated-industry-1":
            "集中工業I（1936年の技術、研究220日、装備の生産+15%・造船+10%）",
          "destroyer-3":
            "駆逐艦III（1940年の技術、研究220日、造船所が新しい型で造る）",
          "fighter-2":
            "戦闘機II（1940年の技術、研究220日、工場が新しい型の機体を作る）",
          "improved-infantry-equipment-1":
            "改良歩兵装備I（1938年の技術、研究165日、攻撃+5%）",
          "infantry-equipment-2":
            "歩兵装備II（1939年の技術、研究220日、師団が新しい世代の装備で戦う）",
          "small-caliber-semi-armor-piercing-shell":
            "半徹甲弾（小口径）（1936年の技術、研究55日、駆逐艦の軽攻撃+5%・巡洋艦の軽攻撃+5%・戦艦の軽攻撃+5%・空母の軽攻撃+5%）",
          truck:
            "トラック（1936年の技術、研究220日、自動車化歩兵の師団を編成できるようになる）",
        },
        instructions:
          "国1には空いている研究枠が2つあります。次に研究する技術として最も良いものはどれですか。選択肢は分野ごとに今始められるいちばん早い年の技術です。今年より後の年の技術は、研究の速さが「1＋2×早い年数」分の1に落ちます。",
        type: "choice",
      }
    );
  });

  it("should offer each focus on offer, with what it hands over and adds, when no focus is being pursued", () => {
    const choosing: Council = {
      ...COUNCIL,
      nations: [
        {
          ...BRIEF,
          focuses: ["industrialisation", "total-mobilisation", "army-effort"],
        },
      ],
    };

    expect(evaluationFor(choosing).body.questions.n1_focus).toStrictEqual({
      criteria: {
        "army-effort": "陸軍拡張（組織力+5%）",
        industrialisation: "工業化（民需工場+3）",
        "total-mobilisation":
          "総力動員（民需工場+2・軍需工場+2・装備の生産+5%・造船+5%）",
      },
      instructions:
        "国1が次に進める国家方針はどれですか。国家方針は70日かけて達成され、達成した日から効果が出ます。",
      type: "choice",
    });
  });

  it("should hand Jev every government's numbers as the state when the council meets", () => {
    expect(evaluationFor(COUNCIL).body.state).toStrictEqual(stateWith({}));
  });

  it("should ask the victor which terms to dictate when a nation has surrendered", () => {
    expect(evaluationFor(TALKS).body).toStrictEqual({
      model: "typesafe-ai/jev",
      questions: {
        n3_terms: {
          criteria: {
            annex: "全土を併合する",
            cede: "占領した土地だけを取って講和する",
            puppet: "傀儡国にして陣営に従わせる",
          },
          instructions: "国0は、降伏した国3にどの講和条件を課しますか。",
          type: "choice",
        },
      },
      state: {
        戦勝国: "国0",
        戦勝国側が持つ敗戦国の本土の割合: 0.7,
        敗戦国: "国3",
        敗戦国が持つ本土の割合: 0.1,
        日付: "1937-05-02",
      },
    });
  });
});

describe("evaluationFor at peace", () => {
  it("should say the enemy fields nobody when the nation is at war with no one", () => {
    const peaceful: Council = {
      ...COUNCIL,
      nations: [
        { ...BRIEF, atWar: false, enemyStrength: exactly(0), rivals: [] },
      ],
    };

    expect(evaluationFor(peaceful).body.state).toStrictEqual(
      stateWith({
        宣戦できる国: [],
        戦争中: false,
        敵に対する兵力比: "相手は兵を出していない",
        敵の兵力: "0人",
      })
    );
  });

  it("should say the enemy's men are unknown when no nation it fights is in view", () => {
    const blind: Council = {
      ...COUNCIL,
      nations: [
        { ...BRIEF, enemyStrength: { estimate: 0, margin: 0, unseen: 2 } },
      ],
    };

    expect(evaluationFor(blind).body.state).toStrictEqual(
      stateWith({
        敵に対する兵力比: "相手の兵力がわからない",
        敵の兵力: "不明（2国）",
      })
    );
  });
});

describe("evaluationFor with sightings", () => {
  it.each<{ condition: string; sighting: Sighting; words: string }>([
    {
      condition: "the government sees the rival's side exactly",
      sighting: exactly(20_000),
      words: "20,000人",
    },
    {
      condition: "the government sees the rival's side within a margin",
      sighting: { estimate: 20_000, margin: 0.5, unseen: 0 },
      words: "約20,000人（±50%）",
    },
    {
      condition: "part of the rival's side is blurred and part unseen",
      sighting: { estimate: 20_000, margin: 0.8, unseen: 2 },
      words: "約20,000人（±80%）、ほかに数のわからない国が2",
    },
    {
      condition: "part of the rival's side is exact and part unseen",
      sighting: { estimate: 20_000, margin: 0, unseen: 1 },
      words: "20,000人、ほかに数のわからない国が1",
    },
    {
      condition: "none of the rival's side is in view",
      sighting: { estimate: 0, margin: 0, unseen: 3 },
      words: "不明（3国）",
    },
  ])(
    "should write the rival's men as $words when $condition",
    ({ sighting, words }) => {
      const sighted: Council = {
        ...COUNCIL,
        nations: [{ ...BRIEF, rivals: [{ nation: 2, strength: sighting }] }],
      };

      expect(evaluationFor(sighted).body.questions.n1_war?.criteria.n2).toBe(
        `国2に宣戦する（相手陣営の兵力 ${words}）`
      );
    }
  );
});

describe("evaluationFor for the intelligence service", () => {
  it("should offer each agency project with what it costs and adds, or nothing, when the agency is free", () => {
    const founding: Council = {
      ...COUNCIL,
      nations: [
        {
          ...BRIEF,
          agencyProjects: [
            "found",
            "passive-defense",
            "invisible-ink",
            "cypher-school",
          ],
        },
      ],
    };

    expect(evaluationFor(founding).body.questions.n1_agency).toStrictEqual({
      criteria: {
        "cypher-school":
          "政府暗号学校（民需工場5つを30日使う、自国の暗号の強さ+1、全3段階）",
        found:
          "諜報機関を設立する（民需工場5つを30日使う。設立すると工作員を1人雇える）",
        "invisible-ink":
          "あぶり出しインク（民需工場5つを30日使う、工作員と潜入から得る諜報+20%・設計図を盗む作戦で捕まる危険-25%、全1段階）",
        none: "今月は何も始めない",
        "passive-defense":
          "受動防御（民需工場5つを30日使う、防諜+1.5、全4段階）",
      },
      instructions:
        "国1の諜報機関は今月、何に取り組みますか。設立も強化も30日かかり、そのあいだ民需工場を建設から外します。諜報が高いほど、敵の兵力・艦隊・航空機の数が正確にわかり、陸戦で相手より強く戦えます。",
      type: "choice",
    });
  });

  it("should offer counter-intelligence at home or each nation to send the operatives to when the agency has operatives", () => {
    const spying: Council = {
      ...COUNCIL,
      nations: [
        { ...BRIEF, operatives: 1, spyTargets: [{ known: 0.254, nation: 2 }] },
      ],
    };

    expect(evaluationFor(spying).body.questions.n1_espionage).toStrictEqual({
      criteria: {
        home: "工作員を自国に置き、敵の工作員を捕まえる",
        s2: "国2に工作員を送る（いまの諜報 25%）",
      },
      instructions:
        "国1は工作員をどこに置きますか。送った国には諜報網が育ち、その国の軍や経済の数がわかるようになり、網が育つと潜入・暗号の奪取・設計図の窃取・抵抗運動の支援といった作戦を行います。送った先で捕まることもあります。",
      type: "choice",
    });
  });
});

describe(verdictsFrom, () => {
  const { asked } = evaluationFor(COUNCIL);

  it("should read the answer as a verdict on its nation and question when the question was asked", () => {
    expect(
      verdictsFrom(asked, {
        n1_war: { choice: "n2", probabilities: { n2: 0.8, none: 0.2 } },
      })
    ).toStrictEqual([
      {
        choice: "n2",
        nation: 1,
        probability: 0.8,
        question: "war",
        weights: [
          { choice: "none", probability: 0.2 },
          { choice: "n2", probability: 0.8 },
        ],
      },
    ]);
  });

  it("should count the choice as unweighted when the answer gives it no probability", () => {
    expect(
      verdictsFrom(asked, { n1_war: { choice: "n2", probabilities: {} } })
    ).toStrictEqual([
      {
        choice: "n2",
        nation: 1,
        probability: 0,
        question: "war",
        weights: [
          { choice: "none", probability: 0 },
          { choice: "n2", probability: 0 },
        ],
      },
    ]);
  });

  it("should drop the answer when nobody asked its question", () => {
    expect(
      verdictsFrom(asked, {
        n9_war: { choice: "n2", probabilities: { n2: 1 } },
      })
    ).toStrictEqual([]);
  });

  it("should drop the answer when it names a choice the question did not offer", () => {
    expect(
      verdictsFrom(asked, {
        n1_war: { choice: "n3", probabilities: { n3: 1 } },
      })
    ).toStrictEqual([]);
  });
});
