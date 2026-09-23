import { describe, expect, it } from "vite-plus/test";
import { startCompliance } from "@/shared/entities/world/compliance";
import type { SupplyNetwork } from "@/shared/entities/world/supply";
import type { Readings } from "./map-mode";
import { resourceTintOf, tintFor } from "./map-mode";

const NETWORK: SupplyNetwork = {
  capacity: [],
  demand: new Map(),
  nations: 0,
  upkeepMet: [],
};

const READINGS: Readings = {
  compliance: startCompliance(new Int32Array(0)),
  network: NETWORK,
  resources: resourceTintOf([
    { chromium: 1, steel: 2, tungsten: 3 },
    { chromium: 4, steel: 5, tungsten: 6 },
  ]),
  waters: [Float32Array.from([1])],
};

describe(tintFor, () => {
  it("should carry the supply network when the map shows supply", () => {
    expect(tintFor("supply", READINGS)).toStrictEqual({
      mode: "supply",
      network: NETWORK,
    });
  });

  it("should carry the compliance when the map shows compliance", () => {
    expect(tintFor("compliance", READINGS)).toStrictEqual({
      compliance: READINGS.compliance,
      mode: "compliance",
    });
  });

  it("should carry every nation's weight at sea when the map shows naval supremacy", () => {
    expect(tintFor("naval", READINGS)).toStrictEqual({
      mode: "naval",
      waters: READINGS.waters,
    });
  });

  it("should hand back the resource tint the readings carry when the map shows resources", () => {
    expect(tintFor("resources", READINGS)).toBe(READINGS.resources);
  });

  it("should hand back the same political tint whatever the network when the map shows who holds what", () => {
    expect(tintFor("political", READINGS)).toBe(
      tintFor("political", { ...READINGS, network: { ...NETWORK, nations: 3 } })
    );
  });
});

describe(resourceTintOf, () => {
  it("should carry the deposits and the world's total when a world's deposits are read", () => {
    const deposits = [
      { chromium: 1, steel: 2, tungsten: 3 },
      { chromium: 4, steel: 5, tungsten: 6 },
    ];

    expect(resourceTintOf(deposits)).toStrictEqual({
      deposits,
      mode: "resources",
      world: { chromium: 5, steel: 7, tungsten: 9 },
    });
  });
});
