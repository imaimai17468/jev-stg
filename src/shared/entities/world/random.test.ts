import { describe, expect, it } from "vite-plus/test";
import { randomFromSeed, shuffled, streamSeed } from "./random";

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

describe(shuffled, () => {
  it("should keep every item when a list is dealt again", () => {
    expect(
      [...shuffled([1, 2, 3, 4, 5], randomFromSeed(9))].toSorted(
        (left, right) => left - right
      )
    ).toStrictEqual([1, 2, 3, 4, 5]);
  });

  it("should deal an empty list back when there is nothing to deal", () => {
    expect(shuffled([], randomFromSeed(9))).toStrictEqual([]);
  });

  it("should deal the same order when the seed is the same", () => {
    expect(shuffled([1, 2, 3, 4, 5], randomFromSeed(9))).toStrictEqual(
      shuffled([1, 2, 3, 4, 5], randomFromSeed(9))
    );
  });
});

describe(streamSeed, () => {
  it("should open consecutive streams far apart when the stream counts up by one", () => {
    const first = randomFromSeed(streamSeed(115, 30)).unit();
    const next = randomFromSeed(streamSeed(115, 31)).unit();

    expect(Math.abs(first - next)).toBeGreaterThan(0.01);
  });

  it("should give the same seed when the seed and the stream are the same", () => {
    expect(streamSeed(115, 30)).toBe(streamSeed(115, 30));
  });
});
