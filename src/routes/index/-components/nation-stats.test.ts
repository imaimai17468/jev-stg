import { describe, expect, it } from "vite-plus/test";
import { NO_ECONOMY } from "@/shared/entities/world/economy";
import { terrainOf, territoryOf } from "./nation-stats";
import type { NationSummary } from "./nation-summary";

const SUMMARY: NationSummary = {
  cells: 6943,
  economy: { ...NO_ECONOMY, population: 125_166_336 },
  id: 0,
  name: "国0",
  neighbours: ["国1"],
  provinces: 61,
  terrain: [
    { provinces: 32, terrain: "plains" },
    { provinces: 14, terrain: "tundra" },
  ],
};

describe(territoryOf, () => {
  it("should read the provinces, the area and the people when a nation is picked", () => {
    expect(territoryOf(SUMMARY)).toStrictEqual([
      { label: "州", value: "61" },
      { label: "面積", value: "6943" },
      { label: "人口", value: "125,166,336" },
    ]);
  });
});

describe(terrainOf, () => {
  it("should name each terrain in Japanese when the nation holds some", () => {
    expect(terrainOf(SUMMARY)).toStrictEqual([
      { label: "平野", value: "32" },
      { label: "ツンドラ", value: "14" },
    ]);
  });
});
