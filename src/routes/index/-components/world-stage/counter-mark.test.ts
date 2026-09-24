import { describe, expect, it } from "vite-plus/test";
import { leadingMark } from "./counter-mark";
import { FIXTURE_WORLD } from "./world-fixture";

describe(leadingMark, () => {
  it("should draw the counter in the colour of the nation with the most when two have something there", () => {
    expect(
      leadingMark(FIXTURE_WORLD, {
        counts: [2.4, 7.6],
        nations: [0, 1],
        x: 3,
        y: 1,
      })
    ).toStrictEqual([
      { colour: { blue: 0, green: 0, red: 100 }, count: 8, x: 3, y: 1 },
    ]);
  });

  it("should read the nation off its place in the tally when the tally skips a nation", () => {
    expect(
      leadingMark(FIXTURE_WORLD, { counts: [5], nations: [1], x: 0, y: 0 })
    ).toStrictEqual([
      { colour: { blue: 0, green: 0, red: 100 }, count: 5, x: 0, y: 0 },
    ]);
  });

  it("should draw no counter when nobody has as much as one there", () => {
    expect(
      leadingMark(FIXTURE_WORLD, {
        counts: [0.4, 0.9],
        nations: [0, 1],
        x: 3,
        y: 1,
      })
    ).toStrictEqual([]);
  });

  it("should draw no counter when nobody is tallied there", () => {
    expect(
      leadingMark(FIXTURE_WORLD, { counts: [], nations: [], x: 3, y: 1 })
    ).toStrictEqual([]);
  });
});
