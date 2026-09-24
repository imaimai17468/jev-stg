import { describe, expect, it } from "vite-plus/test";
import { LINE_WORLD } from "./army-fixture";
import type { World } from "./index";
import {
  infrastructureSupply,
  meanInfrastructureOf,
  openingInfrastructure,
} from "./infrastructure";

describe(openingInfrastructure, () => {
  it("should open mountains lower than plains and every capital built all the way when the world opens", () => {
    const mountainous: World = {
      ...LINE_WORLD,
      provinces: LINE_WORLD.provinces.map((province) => {
        if (province.kind === "land" && province.id === 1) {
          return { ...province, terrain: "mountains" };
        }
        return province;
      }),
    };

    expect(openingInfrastructure(mountainous)).toStrictEqual(
      Uint8Array.from([5, 1, 3, 5, 0])
    );
  });
});

describe(infrastructureSupply, () => {
  it.each([
    { level: 0, share: 0.7 },
    { level: 3, share: 1 },
    { level: 5, share: 1.2 },
  ])(
    "should let through $share of the supply when the province is at level $level",
    ({ level, share }) => {
      expect(infrastructureSupply(level)).toBeCloseTo(share);
    }
  );
});

describe(meanInfrastructureOf, () => {
  const LEVELS = Uint8Array.from([5, 2, 3, 1]);
  const OWNERS = Int32Array.from([0, 0, 1, 1]);

  it.each([
    { mean: 3.5, nation: 0 },
    { mean: 2, nation: 1 },
    { mean: 0, nation: 2 },
  ])(
    "should read a mean of $mean when nation $nation holds that ground",
    ({ mean, nation }) => {
      expect(meanInfrastructureOf(LEVELS, OWNERS, nation)).toBe(mean);
    }
  );
});
