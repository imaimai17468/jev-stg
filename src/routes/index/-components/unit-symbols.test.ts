import { describe, expect, it } from "vite-plus/test";
import type { DivisionKind } from "@/shared/entities/world/divisions";
import type { Colour } from "@/shared/entities/world/nations";
import type { Ink, UnitSymbol } from "./unit-symbols";
import { dominantSymbol, inkOn } from "./unit-symbols";

describe(dominantSymbol, () => {
  it.each<{
    readonly condition: string;
    readonly kinds: readonly DivisionKind[];
    readonly symbol: UnitSymbol;
  }>([
    {
      condition: "one kind outnumbers the rest",
      kinds: ["infantry", "infantry", "motorized"],
      symbol: "infantry",
    },
    {
      condition: "three weights of armour together outnumber the rest",
      kinds: ["light-armour", "medium-armour", "infantry"],
      symbol: "armour",
    },
    {
      condition: "infantry and a more specialised arm are tied",
      kinds: ["infantry", "mechanized"],
      symbol: "mechanized",
    },
    {
      condition: "paratroopers and marines are tied",
      kinds: ["marines", "paratroopers"],
      symbol: "airborne",
    },
  ])("should draw $symbol when $condition", ({ kinds, symbol }) => {
    expect(dominantSymbol(kinds)).toBe(symbol);
  });
});

describe(inkOn, () => {
  it.each<{
    readonly condition: string;
    readonly fill: Colour;
    readonly ink: Ink;
  }>([
    {
      condition: "the fill is light",
      fill: { blue: 120, green: 220, red: 230 },
      ink: "dark",
    },
    {
      condition: "the fill is dark",
      fill: { blue: 90, green: 30, red: 40 },
      ink: "light",
    },
    {
      condition: "the fill is near black, on sRGB's straight segment",
      fill: { blue: 5, green: 5, red: 5 },
      ink: "light",
    },
  ])("should choose $ink ink when $condition", ({ fill, ink }) => {
    expect(inkOn(fill)).toBe(ink);
  });
});
