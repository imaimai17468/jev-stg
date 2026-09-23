import { describe, expect, it } from "vite-plus/test";
import { combatWidth } from "./frontage";

describe(combatWidth, () => {
  it("should hold the terrain's base width when the battle is attacked from one direction", () => {
    expect(combatWidth("mountains", 1)).toBe(4);
  });

  it("should widen by half the base for each further direction when it is attacked from two", () => {
    expect(combatWidth("plains", 2)).toBe(12);
  });

  it("should stop widening when it is attacked from more directions than the most it counts", () => {
    expect(combatWidth("plains", 6)).toBe(16);
  });

  it("should count one direction when no neighbour is attacking it", () => {
    expect(combatWidth("hills", 0)).toBe(5);
  });
});
