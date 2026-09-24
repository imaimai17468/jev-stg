import { Option } from "effect";
import type { Focuses } from "@/shared/entities/world/focus";
import { justifyingThreshold } from "@/shared/entities/world/tension";
import type { WarGoal } from "@/shared/entities/world/war-goals";
import {
  JUSTIFIED_DAYS,
  warGoalOf,
  warGoalStanding,
} from "@/shared/entities/world/war-goals";
import { percentLabel } from "./count-label";
import type { Stat } from "./stat";

/** What the war goal row says about `goal` on `day`, with its target spelled out. */
const goalLabel = (goal: WarGoal, day: number, target: string): string => {
  const standing = warGoalStanding(goal, day);
  if (standing === "justifying") {
    return `${target}（正当化中・あと${goal.readyOn - day}日）`;
  }
  if (standing === "justified") {
    return `${target}（宣戦できる・あと${goal.readyOn + JUSTIFIED_DAYS - day}日で失効）`;
  }
  return `${target}（失効）`;
};

/**
 * What the nation panel says about one nation's war goal: the nation it
 * justifies one on and how far along that is, and the world tension it needs
 * before it may start justifying one, which the top bar's reading of the
 * world tension is read against.
 */
export const warGoalSummaryOf = (
  goals: readonly WarGoal[],
  focuses: Focuses,
  view: {
    readonly nation: number;
    readonly day: number;
    readonly nameOf: (nation: number) => string;
  }
): readonly Stat[] => [
  {
    label: "戦争目標",
    value: Option.match(warGoalOf(goals, view.nation), {
      onNone: () => "なし",
      onSome: (goal) => goalLabel(goal, view.day, view.nameOf(goal.target)),
    }),
  },
  {
    label: "正当化に要る緊張度",
    value: percentLabel(justifyingThreshold(focuses)),
  },
];
