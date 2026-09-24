import { describe, expect, it } from "vite-plus/test";
import type { AirForce } from "@/shared/entities/world/air/air-force";
import { NO_AIR_FORCE } from "@/shared/entities/world/air/air-force";
import { NO_ECONOMY } from "@/shared/entities/world/economy/economy";
import type { Hangar } from "./air-summary";
import { airSummaryOf } from "./air-summary";
import { HELD_BY_TWO } from "./world-fixture";

/**
 * Half way through a fighter on a fifth of its military factories, with 80
 * fighters fighting for a sky and 20 at their base, and 30 close support
 * planes striking the front.
 */
const AIR_FORCE: AirForce = {
  aviation: "light",
  order: "fighter",
  progress: 12,
  wings: [
    {
      model: "fighter-1",
      base: 0,
      mission: "superiority",
      planes: 80,
      region: 0,
    },
    {
      model: "fighter-1",
      base: 0,
      mission: "standby",
      planes: 20,
      region: -1,
    },
    {
      model: "close-air-support-1",
      base: 0,
      mission: "close-support",
      planes: 30,
      region: 1,
    },
  ],
};

/**
 * Nation 0 of the fixture with the air force above, an air base of five
 * levels on its own ground and one of two on its neighbour's, half its fuel,
 * one sky of three held and two lost.
 */
const HANGAR: Hangar = {
  airBases: Uint8Array.from([5, 2, 0]),
  airForce: AIR_FORCE,
  economy: { ...NO_ECONOMY, burned: 1234.4, fuel: 25_000 },
  models: {
    "close-support": "close-air-support-1",
    fighter: "fighter-1",
    "naval-bomber": "naval-bomber-1",
    transport: "transport-plane-1",
  },
  nation: 0,
  owners: HELD_BY_TWO,
  superiority: {
    enemy: Float32Array.from([0.1, 0.9, 0.61]),
    own: Float32Array.from([0.7, 0.5, 0.2]),
  },
};

describe(airSummaryOf, () => {
  it("should read the production, the planes by kind and flying, the bases, the fuel and the skies when a nation has an air force", () => {
    expect(airSummaryOf(HANGAR)).toStrictEqual([
      { label: "航空機の生産", value: "軍需工場の20%で戦闘機（50%）" },
      { label: "戦闘機", value: "100（出撃中 80）" },
      { label: "近接航空支援機", value: "30（出撃中 30）" },
      { label: "雷撃機", value: "0（出撃中 0）" },
      { label: "輸送機", value: "0（出撃中 0）" },
      { label: "航空基地", value: "5段階（1,000機分）" },
      { label: "燃料（昨日の消費）", value: "50%（1,234）" },
      { label: "制空権を握る空域", value: "1" },
      { label: "敵に制空権を握られた空域", value: "2" },
    ]);
  });

  it("should say it builds no planes when none of its military factories are on aviation", () => {
    expect(
      airSummaryOf({ ...HANGAR, airForce: NO_AIR_FORCE }).at(0)
    ).toStrictEqual({ label: "航空機の生産", value: "作らない" });
  });

  it("should read the plane being built as finished when more has been put in than it costs", () => {
    expect(
      airSummaryOf({
        ...HANGAR,
        airForce: { ...AIR_FORCE, order: "naval-bomber", progress: 40 },
      }).at(0)
    ).toStrictEqual({
      label: "航空機の生産",
      value: "軍需工場の20%で雷撃機（100%）",
    });
  });

  it("should read the progress against the nation's design when it builds a newer fighter", () => {
    expect(
      airSummaryOf({
        ...HANGAR,
        airForce: { ...AIR_FORCE, progress: 7 },
        models: { ...HANGAR.models, fighter: "fighter-3" },
      }).at(0)
    ).toStrictEqual({
      label: "航空機の生産",
      value: "軍需工場の20%で戦闘機（25%）",
    });
  });
});
