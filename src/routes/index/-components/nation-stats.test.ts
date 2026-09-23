import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { NO_ECONOMY } from "@/shared/entities/world/economy";
import {
  factionListing,
  standingLabel,
  terrainOf,
  territoryOf,
} from "./nation-stats";
import type { NationSummary } from "./nation-summary";

const SUMMARY: NationSummary = {
  advancement: {
    focus: { label: "進めている方針", value: "なし" },
    focusesDone: [],
    researched: 0,
    slots: [],
  },
  cells: 6943,
  divisions: 0,
  economy: { ...NO_ECONOMY, population: 125_166_336 },
  enemies: [],
  faction: Option.none(),
  id: 0,
  name: "国0",
  neighbours: ["国1"],
  occupation: [],
  provinces: 61,
  puppets: [],
  standing: { kind: "independent" },
  supply: [],
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

describe(standingLabel, () => {
  it("should read independent when the nation answers to nobody", () => {
    expect(standingLabel({ kind: "independent" })).toBe("独立");
  });

  it("should name the overlord when the nation is a puppet", () => {
    expect(standingLabel({ kind: "puppet", overlord: "国1" })).toBe(
      "国1の傀儡"
    );
  });

  it("should name the annexer when the nation has been annexed", () => {
    expect(standingLabel({ by: "国2", kind: "annexed" })).toBe(
      "国2に併合された"
    );
  });
});

describe(factionListing, () => {
  it("should head the section with the faction's name when the nation has joined one", () => {
    const summary: NationSummary = {
      ...SUMMARY,
      faction: Option.some({ members: ["国0", "国1"], name: "国1陣営" }),
    };

    expect(factionListing(summary)).toStrictEqual({
      members: ["国0", "国1"],
      title: "国1陣営",
    });
  });

  it("should head the section plainly and list nobody when the nation has joined none", () => {
    expect(factionListing(SUMMARY)).toStrictEqual({
      members: [],
      title: "陣営",
    });
  });
});
