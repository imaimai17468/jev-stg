import { describe, expect, it } from "vite-plus/test";
import { division } from "./army-fixture";
import type { Activity } from "./preparation";
import {
  entrenchedShare,
  MOST_ENTRENCHMENT,
  MOST_PLANNING,
  prepared,
} from "./preparation";

describe(prepared, () => {
  it.each([
    { activity: "holding-front", entrenchment: 6, planning: 0.3 },
    { activity: "holding", entrenchment: 6, planning: 0.29 },
    { activity: "marching", entrenchment: 0, planning: 0.29 },
    { activity: "attacking", entrenchment: 0, planning: 0.29 },
    { activity: "defending", entrenchment: 5, planning: 0.3 },
  ] satisfies readonly {
    activity: Activity;
    entrenchment: number;
    planning: number;
  }[])(
    "should leave entrenchment $entrenchment and planning $planning when a division dug in to 5 with its plan full spends a day $activity",
    ({ activity, entrenchment, planning }) => {
      const { entrenchment: dug, planning: plan } = prepared(
        division({ entrenchment: 5, planning: MOST_PLANNING }),
        activity
      );

      expect({ entrenchment: dug, planning: plan }).toStrictEqual({
        entrenchment,
        planning,
      });
    }
  );

  it("should stop digging when a division holding its front is already dug in as deep as it goes", () => {
    expect(
      prepared(division({ entrenchment: MOST_ENTRENCHMENT }), "holding-front")
        .entrenchment
    ).toBe(MOST_ENTRENCHMENT);
  });

  it("should not plan below nothing when a division with no planning marches", () => {
    expect(prepared(division({ planning: 0 }), "marching").planning).toBe(0);
  });

  it("should add two percent a day of planning when a division holds its front", () => {
    expect(prepared(division({ planning: 0 }), "holding-front").planning).toBe(
      0.02
    );
  });
});

describe(entrenchedShare, () => {
  it("should add two percent for each level when a division is dug in", () => {
    expect(entrenchedShare(division({ entrenchment: 5 }))).toBeCloseTo(0.1, 10);
  });
});
