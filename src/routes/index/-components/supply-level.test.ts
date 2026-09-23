import { describe, expect, it } from "vite-plus/test";
import type { SupplyNetwork } from "@/shared/entities/world/supply";
import { supplyLevelOf } from "./supply-level";

/** One nation over five provinces, each supplying and holding a different load. */
const NETWORK: SupplyNetwork = {
  capacity: [Float32Array.from([20, 5, 2, 3, 1])],
  demand: new Map([
    [0, 2],
    [1, 1],
    [2, 1],
    [3, 5],
    [4, 4],
  ]),
  nations: 1,
  upkeepMet: [1],
};

describe(supplyLevelOf, () => {
  it("should read plenty when the province could supply ten more divisions than stand in it", () => {
    expect(supplyLevelOf(NETWORK, 0, 0)).toBe("plenty");
  });

  it("should read some when it could supply a couple more", () => {
    expect(supplyLevelOf(NETWORK, 0, 1)).toBe("some");
  });

  it("should read stretched when it supplies what stands in it and hardly more", () => {
    expect(supplyLevelOf(NETWORK, 0, 2)).toBe("stretched");
  });

  it("should read short when the divisions standing in it get at least half of what they need", () => {
    expect(supplyLevelOf(NETWORK, 0, 3)).toBe("short");
  });

  it("should read starved when they get less than half of it", () => {
    expect(supplyLevelOf(NETWORK, 0, 4)).toBe("starved");
  });

  it("should read starved when an attacker standing in the holder's province is far short", () => {
    const invaded: SupplyNetwork = {
      capacity: [Float32Array.from([20]), Float32Array.from([0])],
      demand: new Map([[1, 3]]),
      nations: 2,
      upkeepMet: [1, 1],
    };

    expect(supplyLevelOf(invaded, 0, 0)).toBe("starved");
  });
});
