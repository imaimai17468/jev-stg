import { describe, expect, it } from "vite-plus/test";
import type { Clock } from "./clock";
import {
  advancedOneDay,
  atSpeed,
  dateOf,
  dayDuration,
  START_CLOCK,
  togglePaused,
} from "./clock";

const RUNNING: Clock = { days: 0, paused: false, speed: 2 };

describe(dateOf, () => {
  it("should read the start date when no day has passed", () => {
    expect(dateOf(START_CLOCK)).toStrictEqual({ day: 1, month: 1, year: 1936 });
  });

  it("should read the following January when a year of days has passed", () => {
    expect(dateOf({ ...RUNNING, days: 366 })).toStrictEqual({
      day: 1,
      month: 1,
      year: 1937,
    });
  });
});

describe(advancedOneDay, () => {
  it("should move the calendar by a day when the clock advances", () => {
    expect(dateOf(advancedOneDay(RUNNING))).toStrictEqual({
      day: 2,
      month: 1,
      year: 1936,
    });
  });
});

describe(dayDuration, () => {
  it("should take two seconds a day when the speed is the slowest", () => {
    expect(dayDuration({ ...RUNNING, speed: 1 })).toBe(2000);
  });

  it("should take a twelfth of a second a day when the speed is the fastest", () => {
    expect(dayDuration({ ...RUNNING, speed: 5 })).toBeCloseTo(83.33, 1);
  });
});

describe(atSpeed, () => {
  it("should start a paused clock when a speed is chosen", () => {
    expect(atSpeed({ ...RUNNING, paused: true }, 4)).toStrictEqual({
      days: 0,
      paused: false,
      speed: 4,
    });
  });
});

describe(togglePaused, () => {
  it("should pause a running clock when it is toggled", () => {
    expect(togglePaused(RUNNING).paused).toBeTruthy();
  });

  it("should start a paused clock when it is toggled", () => {
    expect(togglePaused({ ...RUNNING, paused: true }).paused).toBeFalsy();
  });
});
