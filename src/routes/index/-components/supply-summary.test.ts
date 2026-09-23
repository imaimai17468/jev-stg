import { describe, expect, it } from "vite-plus/test";
import { division } from "@/shared/entities/world/army-fixture";
import { NO_ECONOMY } from "@/shared/entities/world/economy";
import type { SupplyNetwork } from "@/shared/entities/world/supply";
import { supplySummaryOf } from "./supply-summary";

/** Province 0 keeps one division supplied, province 1 two, and province 2 none. */
const NETWORK: SupplyNetwork = {
  capacity: [Float32Array.from([1, 2, 0])],
  demand: new Map([
    [0, 2],
    [1, 1],
    [2, 1],
  ]),
  nations: 1,
  upkeepMet: [1],
};

describe(supplySummaryOf, () => {
  it("should count the short, the cut-off and the day's upkeep when some divisions stand past their supply", () => {
    const divisions = [
      division({ province: 0 }),
      division({ province: 0 }),
      division({ province: 1 }),
      division({ province: 2 }),
    ];

    expect(
      supplySummaryOf(
        NETWORK,
        divisions,
        { ...NO_ECONOMY, upkeepMet: 0.755 },
        0
      )
    ).toStrictEqual([
      { label: "補給が足りない師団", value: "3 / 4" },
      { label: "補給が届かない師団", value: "1" },
      { label: "装備の維持費", value: "8 / 日" },
      { label: "維持費の充足", value: "76%" },
    ]);
  });
});
