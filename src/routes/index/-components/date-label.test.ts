import { describe, expect, it } from "vite-plus/test";
import { dateLabel } from "./date-label";

describe(dateLabel, () => {
  it("should pad the month and the day when both are single digits", () => {
    expect(dateLabel({ day: 1, month: 1, year: 1936 })).toBe("1936-01-01");
  });

  it("should leave the month and the day when both are two digits", () => {
    expect(dateLabel({ day: 24, month: 12, year: 1941 })).toBe("1941-12-24");
  });
});
