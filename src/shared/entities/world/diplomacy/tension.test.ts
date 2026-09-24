import { describe, expect, it } from "vite-plus/test";
import type { Focuses } from "../research/focus";
import { START_FOCUSES } from "../research/focus";
import {
  justifyingThreshold,
  mayJustifyAt,
  tensionEasedOneDay,
  tensionRaised,
} from "./tension";

const withDone = (done: Focuses["done"]): Focuses => ({
  ...START_FOCUSES,
  done,
});

describe(tensionRaised, () => {
  it("should add what the cause raises when there is room below the whole", () => {
    expect(tensionRaised(0.1, "annex")).toBeCloseTo(0.2);
  });

  it("should stop at the whole when the cause would carry it past", () => {
    expect(tensionRaised(0.98, "declare")).toBe(1);
  });
});

describe(tensionEasedOneDay, () => {
  it("should ease by a day's share when nobody is fighting", () => {
    expect(tensionEasedOneDay(0.5, false)).toBeCloseTo(0.4995);
  });

  it("should hold when a war runs somewhere", () => {
    expect(tensionEasedOneDay(0.5, true)).toBe(0.5);
  });

  it("should stop at nothing when it has eased all the way", () => {
    expect(tensionEasedOneDay(0.0001, false)).toBe(0);
  });
});

describe(justifyingThreshold, () => {
  it.each([
    { done: ["political-effort", "militarism"], threshold: 0 },
    { done: ["political-effort", "neutrality"], threshold: 1 },
    { done: ["political-effort"], threshold: 0.5 },
  ] satisfies readonly {
    readonly done: Focuses["done"];
    readonly threshold: number;
  }[])(
    "should need $threshold of world tension when the government finished $done",
    ({ done, threshold }) => {
      expect(justifyingThreshold(withDone(done))).toBe(threshold);
    }
  );
});

describe(mayJustifyAt, () => {
  it("should allow justifying when world tension has reached the threshold", () => {
    expect(mayJustifyAt(START_FOCUSES, 0.5)).toBeTruthy();
  });

  it("should refuse justifying when world tension is under the threshold", () => {
    expect(mayJustifyAt(START_FOCUSES, 0.49)).toBeFalsy();
  });
});
