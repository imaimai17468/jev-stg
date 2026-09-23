import { describe, expect, it } from "vite-plus/test";
import { nationLabels } from "./nation-labels";
import {
  FIXTURE_WORLD,
  HELD_BY_NOBODY,
  HELD_BY_ONE,
  HELD_BY_TWO,
} from "./world-fixture";

describe(nationLabels, () => {
  it("should put each name over the land its nation holds when both hold some", () => {
    expect(nationLabels(FIXTURE_WORLD, HELD_BY_TWO)).toStrictEqual([
      { id: 0, name: "国0", weight: 4, x: 0.5, y: 0 },
      { id: 1, name: "国1", weight: 4, x: 2.5, y: 0 },
    ]);
  });

  it("should weigh a nation by the land it holds when it holds more than one province", () => {
    expect(nationLabels(FIXTURE_WORLD, HELD_BY_ONE).at(0)).toStrictEqual({
      id: 0,
      name: "国0",
      weight: 8,
      x: 1.5,
      y: 0,
    });
  });

  it("should leave a nation at the origin when it holds no land at all", () => {
    expect(nationLabels(FIXTURE_WORLD, HELD_BY_NOBODY).at(0)).toStrictEqual({
      id: 0,
      name: "国0",
      weight: 0,
      x: 0,
      y: 0,
    });
  });
});
