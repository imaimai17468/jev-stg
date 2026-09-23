import { describe, expect, it } from "vite-plus/test";
import { civilFromDays, daysFromCivil } from "./calendar";

describe(daysFromCivil, () => {
  it("should be nothing when the date is the epoch", () => {
    expect(daysFromCivil({ day: 1, month: 1, year: 1970 })).toBe(0);
  });

  it("should count back when the date is before the epoch", () => {
    expect(daysFromCivil({ day: 31, month: 12, year: 1969 })).toBe(-1);
  });

  it("should count the leap day when the date follows one", () => {
    expect(
      daysFromCivil({ day: 1, month: 3, year: 2000 }) -
        daysFromCivil({ day: 28, month: 2, year: 2000 })
    ).toBe(2);
  });

  it("should skip the leap day when the year is a century that is not a leap year", () => {
    expect(
      daysFromCivil({ day: 1, month: 3, year: 1900 }) -
        daysFromCivil({ day: 28, month: 2, year: 1900 })
    ).toBe(1);
  });
});

describe(civilFromDays, () => {
  it("should answer the epoch when the count is nothing", () => {
    expect(civilFromDays(0)).toStrictEqual({ day: 1, month: 1, year: 1970 });
  });

  it("should answer the day before when the count is negative", () => {
    expect(civilFromDays(-1)).toStrictEqual({ day: 31, month: 12, year: 1969 });
  });

  it("should answer the leap day when the count lands on one", () => {
    expect(
      civilFromDays(daysFromCivil({ day: 29, month: 2, year: 2024 }))
    ).toStrictEqual({ day: 29, month: 2, year: 2024 });
  });

  it("should round-trip every day of a decade when it is converted both ways", () => {
    const start = daysFromCivil({ day: 1, month: 1, year: 1936 });
    const wrong = Array.from(
      { length: 3653 },
      (_, step) => start + step
    ).filter((days) => daysFromCivil(civilFromDays(days)) !== days);

    expect(wrong).toStrictEqual([]);
  });
});
