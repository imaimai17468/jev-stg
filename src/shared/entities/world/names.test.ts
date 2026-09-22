import { describe, expect, it } from "vite-plus/test";
import { nationNames } from "./names";
import { randomFromSeed } from "./random";

describe(nationNames, () => {
  it("should give as many names as asked when the count fits the pool", () => {
    expect(nationNames(14, randomFromSeed(3))).toHaveLength(14);
  });

  it("should give the same names when the seed is the same", () => {
    expect(nationNames(6, randomFromSeed(3))).toStrictEqual(
      nationNames(6, randomFromSeed(3))
    );
  });

  it("should give different names when the seed differs", () => {
    expect(nationNames(6, randomFromSeed(3))).not.toStrictEqual(
      nationNames(6, randomFromSeed(4))
    );
  });

  it("should give no two nations the same name when the count is within the stem pool", () => {
    const names = nationNames(20, randomFromSeed(9));

    expect(new Set(names).size).toBe(20);
  });

  it("should keep naming nations when the count outruns the stem pool", () => {
    expect(nationNames(40, randomFromSeed(9))).toHaveLength(40);
  });
});
