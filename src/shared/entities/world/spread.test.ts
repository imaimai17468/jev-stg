import { describe, expect, it } from "vite-plus/test";
import type { Neighbourhood } from "./spread";
import { distanceFrom } from "./spread";

/** `count` indices in a row, each touching the one either side of it. */
const overALine =
  (count: number): Neighbourhood =>
  (from, visit) => {
    if (from > 0) {
      visit(from - 1);
    }
    if (from < count - 1) {
      visit(from + 1);
    }
  };

describe(distanceFrom, () => {
  it("should count the steps out from the seed when every step is open", () => {
    expect([...distanceFrom(4, overALine(4), () => true, [0])]).toStrictEqual([
      0, 1, 2, 3,
    ]);
  });

  it("should leave what it cannot enter unreached when a step is closed", () => {
    expect([
      ...distanceFrom(4, overALine(4), (index) => index !== 2, [0]),
    ]).toStrictEqual([0, 1, -1, -1]);
  });

  it("should keep the shorter count when two seeds reach the same index", () => {
    expect([
      ...distanceFrom(4, overALine(4), () => true, [0, 3]),
    ]).toStrictEqual([0, 1, 1, 0]);
  });

  it("should reach nothing when no seed is given", () => {
    expect([...distanceFrom(3, overALine(3), () => true, [])]).toStrictEqual([
      -1, -1, -1,
    ]);
  });
});
