import { describe, expect, it } from "vite-plus/test";
import { UNASSIGNED } from "@/shared/entities/world/spread";
import { nationLabels } from "./nation-labels";
import { fixtureWorld, TWO_NATIONS } from "./world-fixture";

describe(nationLabels, () => {
  it("should put each name over the land its nation holds when both hold some", () => {
    expect(nationLabels(TWO_NATIONS)).toStrictEqual([
      { id: 0, name: "国0", weight: 4, x: 0.5, y: 0 },
      { id: 1, name: "国1", weight: 4, x: 2.5, y: 0 },
    ]);
  });

  it("should weigh a nation by the land it holds when it holds more than one province", () => {
    const merged = fixtureWorld([0, 0, UNASSIGNED]);

    expect(nationLabels(merged).at(0)).toStrictEqual({
      id: 0,
      name: "国0",
      weight: 8,
      x: 1.5,
      y: 0,
    });
  });

  it("should leave a nation at the origin when it holds no land at all", () => {
    const stateless = fixtureWorld([UNASSIGNED, UNASSIGNED, UNASSIGNED]);

    expect(nationLabels(stateless).at(0)).toStrictEqual({
      id: 0,
      name: "国0",
      weight: 0,
      x: 0,
      y: 0,
    });
  });
});
