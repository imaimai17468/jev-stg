import { describe, expect, it } from "vite-plus/test";
import type { SupplyNetwork } from "@/shared/entities/world/supply";
import { tintFor } from "./map-mode";

const NETWORK: SupplyNetwork = {
  capacity: [],
  demand: new Map(),
  nations: 0,
  upkeepMet: [],
};

describe(tintFor, () => {
  it("should carry the supply network when the map shows supply", () => {
    expect(tintFor("supply", NETWORK)).toStrictEqual({
      mode: "supply",
      network: NETWORK,
    });
  });

  it("should hand back the same political tint whatever the network when the map shows who holds what", () => {
    expect(tintFor("political", NETWORK)).toBe(
      tintFor("political", { ...NETWORK, nations: 3 })
    );
  });
});
