import type { BattlePlan } from "@/shared/entities/world/battle-plan";
import { onItsFront } from "@/shared/entities/world/battle-plan";
import type { Division } from "@/shared/entities/world/divisions";
import type { Nation } from "@/shared/entities/world/geography/nations";
import { MOST_ENTRENCHMENT } from "@/shared/entities/world/preparation";
import { averageLabel, percentLabel } from "./count-label";
import type { Stat } from "./stat";

/** The capital an offensive ends on, named after the nation whose it is. */
const objectiveLabel = (
  nations: readonly Nation[],
  offensive: readonly number[]
): readonly string[] =>
  nations.flatMap((nation) => {
    if (nation.capital !== offensive.at(-1)) {
      return [];
    }
    return [`${nation.name}の首都`];
  });

/**
 * What the nation panel says about one nation's battle plan: how many fronts
 * it holds, which capitals its offensives make for, how many provinces its
 * fallback line runs through, how many of its divisions are regrouping
 * after breaking, and how far the divisions holding its fronts have dug in
 * and planned their attack.
 */
export const frontSummaryOf = (
  nations: readonly Nation[],
  plan: BattlePlan,
  divisions: readonly Division[],
  nation: number
): readonly Stat[] => {
  const objectives = [
    ...new Set(
      plan.fronts.flatMap((front) => objectiveLabel(nations, front.offensive))
    ),
  ];
  const holding = divisions.filter(
    (division) => division.nation === nation && onItsFront(plan, division)
  );
  return [
    { label: "戦線", value: `${plan.fronts.length} 本` },
    { label: "攻勢目標", value: objectives.join("、") || "なし" },
    { label: "撤退線の州", value: String(plan.fallback.length) },
    {
      label: "再編中の師団",
      value: String(
        divisions.filter(
          (division) =>
            division.nation === nation && division.task === "regroup"
        ).length
      ),
    },
    {
      label: "前線の塹壕（平均）",
      value: averageLabel(
        holding.map((division) => division.entrenchment),
        (levels) => `${levels.toFixed(1)} / ${MOST_ENTRENCHMENT}`
      ),
    },
    {
      label: "前線の計画ボーナス（平均）",
      value: averageLabel(
        holding.map((division) => division.planning),
        percentLabel
      ),
    },
  ];
};
