import { describe, expect, it } from "vite-plus/test";
import { NO_LEDGER } from "@/shared/entities/world/economy/commerce";
import { NO_ECONOMY } from "@/shared/entities/world/economy/economy";
import { NO_RESOURCES } from "@/shared/entities/world/economy/resources";
import { tradeSummaryOf } from "./trade-summary";

describe(tradeSummaryOf, () => {
  it("should read the law, each resource's day and the factories traded when a nation buys abroad", () => {
    expect(
      tradeSummaryOf(
        { ...NO_ECONOMY, tradeLaw: "free-trade" },
        {
          balance: {
            exported: { ...NO_RESOURCES, chromium: 2 },
            factories: 3,
            imported: { ...NO_RESOURCES, oil: 7, steel: 12.4 },
          },
          extracted: {
            aluminium: 4,
            chromium: 6,
            oil: 9,
            rubber: 2,
            steel: 30,
            tungsten: 1,
          },
          need: {
            ...NO_RESOURCES,
            aluminium: 8,
            rubber: 3,
            steel: 44,
            tungsten: 5,
          },
          shortage: 0.256,
        }
      )
    ).toStrictEqual([
      { label: "交易法", value: "自由貿易" },
      { label: "鋼鉄", value: "採掘 30・必要 44・輸入 12・輸出 0" },
      { label: "タングステン", value: "採掘 1・必要 5・輸入 0・輸出 0" },
      { label: "クロム", value: "採掘 6・必要 0・輸入 0・輸出 2" },
      { label: "アルミ", value: "採掘 4・必要 8・輸入 0・輸出 0" },
      { label: "ゴム", value: "採掘 2・必要 3・輸入 0・輸出 0" },
      { label: "石油", value: "採掘 9・必要 0・輸入 7・輸出 0" },
      { label: "資源不足による軍需生産の低下", value: "26%" },
      { label: "交易で増減した民需工場", value: "+3" },
    ]);
  });

  it("should write the factories handed over with a minus when the trade paid them out", () => {
    expect(
      tradeSummaryOf(NO_ECONOMY, {
        ...NO_LEDGER,
        balance: { ...NO_LEDGER.balance, factories: -2 },
      }).at(-1)
    ).toStrictEqual({ label: "交易で増減した民需工場", value: "-2" });
  });
});
