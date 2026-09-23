import { describe, expect, it } from "vite-plus/test";
import { startCompliance } from "@/shared/entities/world/compliance";
import { NO_RESOURCES } from "@/shared/entities/world/resources";
import type { SupplyNetwork } from "@/shared/entities/world/supply";
import type { Readings } from "./map-mode";
import { airTintOf, resourceTintOf, tintFor } from "./map-mode";

const NETWORK: SupplyNetwork = {
  capacity: [],
  demand: new Map(),
  nations: 0,
  upkeepMet: [],
};

/** Two provinces' deposits, the second holding more of everything. */
const DEPOSITS = [
  { ...NO_RESOURCES, chromium: 1, steel: 2, tungsten: 3 },
  { ...NO_RESOURCES, chromium: 4, oil: 1, steel: 5, tungsten: 6 },
];

const READINGS: Readings = {
  air: airTintOf([Float32Array.from([2])], Int32Array.from([0, 0])),
  compliance: startCompliance(new Int32Array(0)),
  network: NETWORK,
  networks: [Float32Array.from([12, 0])],
  resources: resourceTintOf(DEPOSITS),
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

  it("should hand back the air tint the readings carry when the map shows air superiority", () => {
    expect(tintFor("air", READINGS)).toBe(READINGS.air);
  });

  it("should hand back the resource tint the readings carry when the map shows resources", () => {
    expect(tintFor("resources", READINGS)).toBe(READINGS.resources);
  });

  it("should carry every nation's intelligence network when the map shows intelligence", () => {
    expect(tintFor("intel", READINGS)).toStrictEqual({
      mode: "intel",
      networks: READINGS.networks,
    });
  });

  it("should hand back the same political tint whatever the network when the map shows who holds what", () => {
    expect(tintFor("political", READINGS)).toBe(
      tintFor("political", { ...READINGS, network: { ...NETWORK, nations: 3 } })
    );
  });
});

describe(resourceTintOf, () => {
  it("should carry the deposits and the world's total when a world's deposits are read", () => {
    expect(resourceTintOf(DEPOSITS)).toStrictEqual({
      deposits: DEPOSITS,
      mode: "resources",
      world: { ...NO_RESOURCES, chromium: 5, oil: 1, steel: 7, tungsten: 9 },
    });
  });
});

describe(airTintOf, () => {
  it("should carry every nation's air power and the region of each province when the day's air battles are read", () => {
    const power = [Float32Array.from([3, 0])];
    const regionOf = Int32Array.from([1, 0]);

    expect(airTintOf(power, regionOf)).toStrictEqual({
      mode: "air",
      power,
      regionOf,
    });
  });
});
