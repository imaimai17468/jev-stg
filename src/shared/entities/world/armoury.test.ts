import { describe, expect, it } from "vite-plus/test";
import { armouryOf, OPENING_ARMOURY } from "./armoury";
import { START_RESEARCH } from "./research";

const UNARMED_SHARES = { heavy: 0, light: 0, torpedo: 0 };

describe(armouryOf, () => {
  it("should arm with the first model of each kind and no weapon shares when nothing is researched", () => {
    expect(armouryOf({ ...START_RESEARCH, researched: [] })).toStrictEqual({
      infantry: "basic-infantry-equipment",
      planes: {
        "close-support": "close-air-support-1",
        fighter: "interwar-fighter",
        "naval-bomber": "naval-bomber-1",
      },
      ships: {
        battleship: "battleship-1",
        carrier: "carrier-1",
        cruiser: "light-cruiser-1",
        destroyer: "destroyer-1",
        submarine: "submarine-1",
      },
      weapons: {
        battleship: UNARMED_SHARES,
        carrier: UNARMED_SHARES,
        cruiser: UNARMED_SHARES,
        destroyer: UNARMED_SHARES,
        submarine: UNARMED_SHARES,
      },
    });
  });

  it("should arm with the newest model of each kind and add up the shares per class and weapon when upgrades are researched", () => {
    expect(
      armouryOf({
        ...START_RESEARCH,
        researched: [
          "infantry-equipment-1",
          "infantry-equipment-2",
          "fighter-1",
          "fighter-2",
          "destroyer-2",
          "destroyer-3",
          "magnetic-detonator",
          "armor-piercing-capped-shell",
          "super-heavy-armor-piercing-shell",
        ],
      })
    ).toStrictEqual({
      infantry: "infantry-equipment-2",
      planes: {
        "close-support": "close-air-support-1",
        fighter: "fighter-2",
        "naval-bomber": "naval-bomber-1",
      },
      ships: {
        battleship: "battleship-1",
        carrier: "carrier-1",
        cruiser: "light-cruiser-1",
        destroyer: "destroyer-3",
        submarine: "submarine-1",
      },
      weapons: {
        battleship: { heavy: 0.1, light: 0, torpedo: 0 },
        carrier: UNARMED_SHARES,
        cruiser: { heavy: 0, light: 0, torpedo: 0.2 },
        destroyer: { heavy: 0, light: 0, torpedo: 0.2 },
        submarine: { heavy: 0, light: 0, torpedo: 0.2 },
      },
    });
  });
});

describe("the opening armoury", () => {
  it("should arm with the 1936 opening models when the world opens", () => {
    const { infantry, planes, ships } = OPENING_ARMOURY;

    expect({ infantry, planes, ships }).toStrictEqual({
      infantry: "infantry-equipment-1",
      planes: {
        "close-support": "close-air-support-1",
        fighter: "fighter-1",
        "naval-bomber": "naval-bomber-1",
      },
      ships: {
        battleship: "battleship-2",
        carrier: "carrier-2",
        cruiser: "light-cruiser-2",
        destroyer: "destroyer-2",
        submarine: "submarine-2",
      },
    });
  });
});
