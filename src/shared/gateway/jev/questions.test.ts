import { describe, expect, it } from "vite-plus/test";
import type {
  Council,
  NationBrief,
  PeaceTalks,
} from "@/shared/entities/world/consultation";
import { evaluationFor, verdictsFrom } from "./questions";

const BRIEF: NationBrief = {
  atWar: true,
  civilianFactories: 20,
  enemyStrength: 40_000,
  equipment: 1500.4,
  factions: [{ faction: 0, strength: 60_000 }],
  manpower: 90_000.6,
  militaryFactories: 5,
  nation: 1,
  population: 3_000_000.2,
  rivals: [{ nation: 2, strength: 20_000 }],
  strength: 20_000,
};

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
  it("should ask a government about its law, plan, stance, war and faction when it has rivals and factions in reach", () => {
    expect(Object.keys(evaluationFor(COUNCIL).body.questions)).toStrictEqual([
      "n1_conscription",
      "n1_plan",
      "n1_stance",
      "n1_war",
      "n1_faction",
    ]);
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
    ]);
  });

  it("should offer declaring on each rival, or on nobody, when the war question is asked", () => {
    expect(evaluationFor(COUNCIL).body.questions.n1_war).toStrictEqual({
      criteria: {
        n2: "国2に宣戦する（相手陣営の兵力 20,000人）",
        none: "どこにも宣戦しない",
      },
      instructions:
        "国1は今月、隣国に宣戦しますか。戦争は負ければ国を失う賭けで、相手を大きく上回る兵力があるときだけ割に合います。",
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

  it("should hand Jev every government's numbers as the state when the council meets", () => {
    expect(evaluationFor(COUNCIL).body.state).toStrictEqual({
      各国: [
        {
          人口: 3_000_000,
          人的資源: 90_001,
          国: "国1",
          工場: { 民需: 20, 軍需: 5 },
          戦争中: true,
          敵に対する兵力比: 0.5,
          敵の兵力: 40_000,
          自陣営の兵力: 20_000,
          装備: 1500,
          隣国: [{ こちらとの兵力比: 1, 国: "国2", 相手陣営の兵力: 20_000 }],
        },
      ],
      日付: "1936-03-01",
    });
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
      nations: [{ ...BRIEF, atWar: false, enemyStrength: 0, rivals: [] }],
    };

    expect(evaluationFor(peaceful).body.state).toStrictEqual({
      各国: [
        {
          人口: 3_000_000,
          人的資源: 90_001,
          国: "国1",
          工場: { 民需: 20, 軍需: 5 },
          戦争中: false,
          敵に対する兵力比: "相手は兵を出していない",
          敵の兵力: 0,
          自陣営の兵力: 20_000,
          装備: 1500,
          隣国: [],
        },
      ],
      日付: "1936-03-01",
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
