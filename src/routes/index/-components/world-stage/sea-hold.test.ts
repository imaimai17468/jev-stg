import { describe, expect, it } from "vite-plus/test";
import { seaHoldOf } from "./sea-hold";

describe(seaHoldOf, () => {
  it.each([
    {
      expected: { leader: -1, level: "empty" },
      waters: [Float32Array.from([0]), Float32Array.from([0])],
      when: "no warship covers the zone",
    },
    {
      expected: { leader: 1, level: "held" },
      waters: [Float32Array.from([1]), Float32Array.from([9])],
      when: "one nation has nine tenths of the weight there",
    },
    {
      expected: { leader: 0, level: "contested" },
      waters: [Float32Array.from([6]), Float32Array.from([4])],
      when: "the nation with the most has less than nine tenths",
    },
  ])(
    "should read the zone as $expected.level when $when",
    ({ expected, waters }) => {
      expect(seaHoldOf(waters, 0)).toStrictEqual(expected);
    }
  );
});
