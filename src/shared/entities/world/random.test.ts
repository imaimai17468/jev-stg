import { describe, expect, it } from "vite-plus/test";
import { randomFromSeed } from "./random";

const firstThree = (seed: number): readonly number[] => {
  const random = randomFromSeed(seed);
  return [random.unit(), random.unit(), random.unit()];
};

describe(randomFromSeed, () => {
  it("should draw the same sequence when the seed is the same", () => {
    expect(firstThree(42)).toStrictEqual(firstThree(42));
  });

  it("should draw a different sequence when the seed differs", () => {
    expect(firstThree(42)).not.toStrictEqual(firstThree(43));
  });

  it("should draw a different sequence when the seed is zero rather than one", () => {
    expect(firstThree(0)).not.toStrictEqual(firstThree(1));
  });

  it("should draw values inside the unit interval when drawn repeatedly", () => {
    const drawn = Array.from({ length: 200 }, randomFromSeed(7).unit);

    expect(drawn.every((value) => value > 0 && value < 1)).toBeTruthy();
  });

  it("should draw integers below the bound when a bound is given", () => {
    const random = randomFromSeed(11);
    const drawn = Array.from({ length: 200 }, () => random.below(5));

    expect(
      drawn.every((value) => Number.isInteger(value) && value >= 0 && value < 5)
    ).toBeTruthy();
  });
});
