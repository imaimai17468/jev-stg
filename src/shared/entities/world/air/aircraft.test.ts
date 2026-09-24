import { describe, expect, it } from "vite-plus/test";
import { NO_RESOURCES } from "../economy/resources";
import type { Aviation } from "./aircraft";
import { airframeModelsOf, airframeOf, aviationShareOf } from "./aircraft";

describe(airframeOf, () => {
  it("should give the 1936 fighter's figures when the model is fighter-1", () => {
    expect(airframeOf("fighter-1")).toStrictEqual({
      agility: 50,
      airAttack: 18,
      airDefence: 10,
      aircraft: "fighter",
      cost: 24,
      fuel: 0.21,
      groundAttack: 0,
      navalAttack: 2,
      resources: { ...NO_RESOURCES, aluminium: 3, rubber: 1 },
      speed: 500,
    });
  });
});

describe(airframeModelsOf, () => {
  it("should build the first design of every kind when nothing is researched", () => {
    expect(airframeModelsOf(new Set())).toStrictEqual({
      "close-support": "close-air-support-1",
      fighter: "interwar-fighter",
      "naval-bomber": "naval-bomber-1",
      transport: "transport-plane-1",
    });
  });

  it("should build the newest design of each kind when several of it are researched", () => {
    expect(
      airframeModelsOf(
        new Set([
          "fighter-1",
          "fighter-2",
          "close-air-support-2",
          "naval-bomber-3",
          "infantry-weapons-1",
        ])
      )
    ).toStrictEqual({
      "close-support": "close-air-support-2",
      fighter: "fighter-2",
      "naval-bomber": "naval-bomber-3",
      transport: "transport-plane-1",
    });
  });
});

describe(aviationShareOf, () => {
  it.each<{ aviation: Aviation; share: number }>([
    { aviation: "none", share: 0 },
    { aviation: "light", share: 0.2 },
    { aviation: "heavy", share: 0.4 },
  ])(
    "should put $share of the military factories on planes when aviation is $aviation",
    ({ aviation, share }) => {
      expect(aviationShareOf(aviation)).toBe(share);
    }
  );
});
