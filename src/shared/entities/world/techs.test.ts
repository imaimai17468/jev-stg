import { describe, expect, it } from "vite-plus/test";
import type { TechCategory, TechLine } from "./techs";
import { categoryOf, techOf } from "./techs";

describe(categoryOf, () => {
  it.each<{ line: TechLine; category: TechCategory }>([
    { category: "infantry", line: "infantry-weapons" },
    { category: "naval", line: "destroyers" },
    { category: "naval", line: "cruisers" },
    { category: "naval", line: "battleships" },
    { category: "naval", line: "carriers" },
    { category: "naval", line: "submarines" },
    { category: "naval", line: "naval-armament" },
    { category: "air", line: "fighters" },
    { category: "air", line: "close-support" },
    { category: "air", line: "naval-bombers" },
    { category: "industry", line: "industry" },
    { category: "industry", line: "construction" },
    { category: "industry", line: "fuel" },
    { category: "electronics", line: "electronics" },
  ])(
    "should put the $line line in the $category category when a bonus names categories",
    ({ category, line }) => {
      expect(categoryOf(line)).toBe(category);
    }
  );
});

describe(techOf, () => {
  it("should describe a technology that only opens later ones when it adds nothing this world acts on", () => {
    expect(techOf("destroyer-3")).toStrictEqual({
      bonus: {},
      cost: 2,
      excludes: [],
      from: ["destroyer-2"],
      line: "destroyers",
      name: "駆逐艦III",
      upgrades: [],
      year: 1940,
    });
  });

  it("should carry the bonus and the exclusion when a technology opens one of two paths", () => {
    expect(techOf("concentrated-industry-1")).toStrictEqual({
      bonus: { buildingSlots: 0.2, dockyards: 0.1, production: 0.15 },
      cost: 2,
      excludes: ["dispersed-industry-1"],
      from: ["basic-machine-tools"],
      line: "industry",
      name: "集中工業I",
      upgrades: [],
      year: 1936,
    });
  });

  it("should give one weapon upgrade per ship class the shell reaches when a technology improves light guns", () => {
    expect(
      techOf("small-caliber-semi-armor-piercing-shell").upgrades
    ).toStrictEqual([
      { share: 0.05, shipClass: "destroyer", weapon: "light" },
      { share: 0.05, shipClass: "cruiser", weapon: "light" },
      { share: 0.05, shipClass: "battleship", weapon: "light" },
      { share: 0.05, shipClass: "carrier", weapon: "light" },
    ]);
  });

  it("should give the torpedo upgrade to each class that carries torpedoes when a technology improves them", () => {
    expect(techOf("magnetic-detonator").upgrades).toStrictEqual([
      { share: 0.2, shipClass: "destroyer", weapon: "torpedo" },
      { share: 0.2, shipClass: "submarine", weapon: "torpedo" },
      { share: 0.2, shipClass: "cruiser", weapon: "torpedo" },
    ]);
  });
});
