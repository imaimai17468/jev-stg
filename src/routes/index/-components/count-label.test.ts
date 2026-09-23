import { describe, expect, it } from "vite-plus/test";
import { averageLabel, countLabel, percentLabel } from "./count-label";

describe(countLabel, () => {
  it("should separate the digits in threes when the count runs to millions", () => {
    expect(countLabel(1_234_567)).toBe("1,234,567");
  });

  it("should open on a separated group when the digits divide into threes", () => {
    expect(countLabel(100_000)).toBe("100,000");
  });

  it("should print the digits alone when the count is below a thousand", () => {
    expect(countLabel(0)).toBe("0");
  });

  it("should round to a whole when the count carries a fraction", () => {
    expect(countLabel(1_000_032.854)).toBe("1,000,033");
  });

  it("should keep the leading group when the count is negative", () => {
    expect(countLabel(-123_456)).toBe("-123,456");
  });
});

describe(percentLabel, () => {
  it("should round the share to a whole percentage when it falls between two", () => {
    expect(percentLabel(0.756)).toBe("76%");
  });
});

describe(averageLabel, () => {
  it("should write the average in the given form when there are levels", () => {
    expect(averageLabel([0.2, 0.4], percentLabel)).toBe("30%");
  });

  it("should write a dash when there are no levels", () => {
    expect(averageLabel([], percentLabel)).toBe("—");
  });
});
