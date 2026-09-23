import { describe, expect, it } from "vite-plus/test";
import { startCompliance } from "@/shared/entities/world/compliance";
import type { SupplyNetwork } from "@/shared/entities/world/supply";
import type { Readings } from "./map-mode";
import { tintFor } from "./map-mode";

const NETWORK: SupplyNetwork = {
  capacity: [],
  demand: new Map(),
  nations: 0,
  upkeepMet: [],
};

const READINGS: Readings = {
  compliance: startCompliance(new Int32Array(0)),
  network: NETWORK,
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

  it("should hand back the same political tint whatever the network when the map shows who holds what", () => {
    expect(tintFor("political", READINGS)).toBe(
      tintFor("political", { ...READINGS, network: { ...NETWORK, nations: 3 } })
    );
  });
});
