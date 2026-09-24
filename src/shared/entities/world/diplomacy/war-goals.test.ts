import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { WarGoal } from "./war-goals";
import {
  justifiedTarget,
  justifyingDays,
  warGoalOf,
  warGoalStanding,
  withoutGoalOf,
} from "./war-goals";

/** Nation 1's goal on nation 2 completing on day 100, beside nation 3's on 0. */
const GOALS: readonly WarGoal[] = [
  { nation: 1, readyOn: 100, target: 2 },
  { nation: 3, readyOn: 50, target: 0 },
];

describe(justifyingDays, () => {
  it.each([
    { days: 180, tension: 0 },
    { days: 135, tension: 0.5 },
    { days: 90, tension: 1 },
  ])(
    "should take $days days when world tension stands at $tension",
    ({ days, tension }) => {
      expect(justifyingDays(tension)).toBe(days);
    }
  );
});

describe(warGoalStanding, () => {
  it.each([
    { day: 99, standing: "justifying" },
    { day: 100, standing: "justified" },
    { day: 159, standing: "justified" },
    { day: 160, standing: "expired" },
  ])(
    "should read $standing when the day is $day for a goal completing on day 100",
    ({ day, standing }) => {
      expect(warGoalStanding({ nation: 1, readyOn: 100, target: 2 }, day)).toBe(
        standing
      );
    }
  );
});

describe(warGoalOf, () => {
  it("should find the nation's goal when it holds one", () => {
    expect(warGoalOf(GOALS, 3)).toStrictEqual(
      Option.some({ nation: 3, readyOn: 50, target: 0 })
    );
  });

  it("should find nothing when the nation holds none", () => {
    expect(warGoalOf(GOALS, 2)).toStrictEqual(Option.none());
  });
});

describe(justifiedTarget, () => {
  it("should name the target when the goal is justified", () => {
    expect(justifiedTarget(GOALS, 1, 120)).toStrictEqual(Option.some(2));
  });

  it("should name nothing when the goal is still being justified", () => {
    expect(justifiedTarget(GOALS, 1, 60)).toStrictEqual(Option.none());
  });
});

describe(withoutGoalOf, () => {
  it("should keep the other nations' goals when one nation's goal is dropped", () => {
    expect(withoutGoalOf(GOALS, 1)).toStrictEqual([
      { nation: 3, readyOn: 50, target: 0 },
    ]);
  });
});
