import { describe, expect, it } from "vite-plus/test";
import { START_FOCUSES } from "@/shared/entities/world/research/focus";
import type { WarGoal } from "@/shared/entities/world/war-goals";
import { warGoalSummaryOf } from "./war-goal-summary";

/** Nation 1 justifying a war goal on nation 2 that completes on day 100. */
const GOALS: readonly WarGoal[] = [{ nation: 1, readyOn: 100, target: 2 }];

/** What nation 1's panel reads on `day`. */
const summaryOn = (day: number) =>
  warGoalSummaryOf(GOALS, START_FOCUSES, {
    day,
    nameOf: (nation) => `国${nation}`,
    nation: 1,
  });

describe(warGoalSummaryOf, () => {
  it("should count the days left to justify when the war goal is still being justified", () => {
    expect(summaryOn(40)).toStrictEqual([
      { label: "戦争目標", value: "国2（正当化中・あと60日）" },
      { label: "正当化に要る緊張度", value: "50%" },
    ]);
  });

  it("should count the days left before it expires when the war goal is justified", () => {
    expect(summaryOn(110)[0]).toStrictEqual({
      label: "戦争目標",
      value: "国2（宣戦できる・あと50日で失効）",
    });
  });

  it("should say the war goal has expired when its days are past", () => {
    expect(summaryOn(160)[0]).toStrictEqual({
      label: "戦争目標",
      value: "国2（失効）",
    });
  });

  it("should read none when the nation holds no war goal", () => {
    expect(
      warGoalSummaryOf(GOALS, START_FOCUSES, {
        day: 0,
        nameOf: (nation) => `国${nation}`,
        nation: 2,
      })[0]
    ).toStrictEqual({ label: "戦争目標", value: "なし" });
  });
});
