import { describe, expect, it } from "vite-plus/test";
import {
  AT_WAR,
  division,
  LINE_GRAPH,
  LINE_OWNERS,
  LINE_WORLD,
  TWO_NATIONS,
} from "@/shared/entities/world/army-fixture";
import { battlePlanOf } from "@/shared/entities/world/battle-plan";
import { noWars } from "@/shared/entities/world/wars";
import { frontSummaryOf } from "./front-summary";

const planUnder = (wars: typeof AT_WAR) =>
  battlePlanOf(
    LINE_WORLD.provinces,
    TWO_NATIONS,
    LINE_GRAPH,
    LINE_OWNERS,
    wars,
    0
  );

describe(frontSummaryOf, () => {
  it("should name the front, the enemy capital it makes for, its fallback line, the divisions regrouping and how the front has prepared when the nation is at war", () => {
    expect(
      frontSummaryOf(
        TWO_NATIONS,
        planUnder(AT_WAR),
        [
          division({ nation: 0, task: "regroup" }),
          division({ entrenchment: 9, nation: 0, planning: 0.3 }),
          division({ entrenchment: 4, nation: 0, planning: 0.2, province: 1 }),
          division({ entrenchment: 2, nation: 0, planning: 0.1, province: 1 }),
          division({ nation: 1, task: "regroup" }),
        ],
        0
      )
    ).toStrictEqual([
      { label: "戦線", value: "1 本" },
      { label: "攻勢目標", value: "国1の首都" },
      { label: "撤退線の州", value: "1" },
      { label: "再編中の師団", value: "1" },
      { label: "前線の塹壕（平均）", value: "3.0 / 10" },
      { label: "前線の計画ボーナス（平均）", value: "15%" },
    ]);
  });

  it("should say it has no objective when the nation is at peace", () => {
    expect(
      frontSummaryOf(TWO_NATIONS, planUnder(noWars(2)), [], 0).at(1)
    ).toStrictEqual({ label: "攻勢目標", value: "なし" });
  });

  it("should leave the front's preparation blank when no division holds the front", () => {
    expect(
      frontSummaryOf(TWO_NATIONS, planUnder(AT_WAR), [], 0).at(4)
    ).toStrictEqual({ label: "前線の塹壕（平均）", value: "—" });
  });
});
