import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { networkLevelOf, strengthShown } from "./network-level";

describe(networkLevelOf, () => {
  it.each([
    { level: "none", strength: 0 },
    { level: "building", strength: 9.9 },
    { level: "counts", strength: 10 },
    { level: "strong", strength: 50 },
  ])(
    "should read $level when the network is $strength strong",
    ({ level, strength }) => {
      expect(networkLevelOf(strength)).toBe(level);
    }
  );
});

/** Nation 0, 1 and 2's networks over three provinces. */
const NETWORKS = [
  Float32Array.from([5, 20, 0]),
  Float32Array.from([40, 0, 0]),
  Float32Array.from([15, 0, 0]),
];

describe(strengthShown, () => {
  it("should show the picked nation's own network when a nation is picked", () => {
    expect(strengthShown(NETWORKS, 0, 1, Option.some(2))).toBe(15);
  });

  it("should show no network when the picked nation is one the list does not reach", () => {
    expect(strengthShown(NETWORKS, 0, 1, Option.some(7))).toBe(0);
  });

  it("should show the strongest network of a nation other than the holder when nobody is picked", () => {
    expect(strengthShown(NETWORKS, 0, 1, Option.none())).toBe(15);
  });

  it("should show no network when no nation has one there and nobody is picked", () => {
    expect(strengthShown([], 0, 1, Option.none())).toBe(0);
  });
});
