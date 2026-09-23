import { describe, expect, it } from "vite-plus/test";
import { NO_ECONOMY } from "@/shared/entities/world/economy";
import { tradeSummaryOf } from "./trade-summary";

describe(tradeSummaryOf, () => {
  it("should read the law, each resource's day and the factories traded when a nation buys abroad", () => {
    expect(
      tradeSummaryOf(
        { ...NO_ECONOMY, tradeLaw: "free-trade" },
        {
          balance: {
            exported: { chromium: 2, steel: 0, tungsten: 0 },
            factories: 3,
            imported: { chromium: 0, steel: 12.4, tungsten: 0 },
          },
          extracted: { chromium: 6, steel: 30, tungsten: 1 },
          need: { chromium: 0, steel: 44, tungsten: 5 },
          shortage: 0.256,
        }
      )
    ).toStrictEqual([
      { label: "交易法", value: "自由貿易" },
      { label: "鋼鉄", value: "採掘 30・必要 44・輸入 12・輸出 0" },
      { label: "タングステン", value: "採掘 1・必要 5・輸入 0・輸出 0" },
      { label: "クロム", value: "採掘 6・必要 0・輸入 0・輸出 2" },
      { label: "資源不足による軍需生産の低下", value: "26%" },
      { label: "交易で増減した民需工場", value: "+3" },
    ]);
  });

  it("should write the factories handed over with a minus when the trade paid them out", () => {
    expect(
      tradeSummaryOf(NO_ECONOMY, {
        balance: {
          exported: { chromium: 0, steel: 0, tungsten: 0 },
          factories: -2,
          imported: { chromium: 0, steel: 0, tungsten: 0 },
        },
        extracted: { chromium: 0, steel: 0, tungsten: 0 },
        need: { chromium: 0, steel: 0, tungsten: 0 },
        shortage: 0,
      }).at(-1)
    ).toStrictEqual({ label: "交易で増減した民需工場", value: "-2" });
  });
});
