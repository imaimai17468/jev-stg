import { describe, expect, it } from "vite-plus/test";
import { apportioned } from "./apportion";

describe(apportioned, () => {
  it("should give each part the whole of its quota when the weights divide the total exactly", () => {
    expect(apportioned(10, [0.5, 0.3, 0.2])).toStrictEqual([5, 3, 2]);
  });

  it("should give what rounding leaves to the parts that lost the most when the quotas are fractional", () => {
    expect(apportioned(7, [2, 3, 5])).toStrictEqual([1, 2, 4]);
  });

  it("should give what rounding leaves to the earlier part when two lost the same", () => {
    expect(apportioned(1, [1, 1])).toStrictEqual([1, 0]);
  });

  it("should split the total evenly when the weights sum to nothing", () => {
    expect(apportioned(4, [0, 0])).toStrictEqual([2, 2]);
  });
});
