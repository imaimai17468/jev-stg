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
  it("should name the front, the enemy capital it makes for, its fallback line and the divisions regrouping when the nation is at war", () => {
    expect(
      frontSummaryOf(
        TWO_NATIONS,
        planUnder(AT_WAR),
        [
          division({ nation: 0, task: "regroup" }),
          division({ nation: 0 }),
          division({ nation: 1, task: "regroup" }),
        ],
        0
      )
    ).toStrictEqual([
      { label: "戦線", value: "1 本" },
      { label: "攻勢目標", value: "国1の首都" },
      { label: "撤退線の州", value: "1" },
      { label: "再編中の師団", value: "1" },
    ]);
  });

  it("should say it has no objective when the nation is at peace", () => {
    expect(
      frontSummaryOf(TWO_NATIONS, planUnder(noWars(2)), [], 0).at(1)
    ).toStrictEqual({ label: "攻勢目標", value: "なし" });
  });
});
