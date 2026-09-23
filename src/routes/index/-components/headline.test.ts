import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { NationEconomy } from "@/shared/entities/world/economy";
import { NO_ECONOMY } from "@/shared/entities/world/economy";
import { headlineOf } from "./headline";
import { summaryOf } from "./nation-summary";
import { TWO_NATIONS } from "./world-fixture";

const ECONOMIES: readonly NationEconomy[] = [
  NO_ECONOMY,
  {
    ...NO_ECONOMY,
    civilianFactories: 25,
    construction: 2700,
    equipment: 12_500,
    manpower: 1_352_004,
    militaryFactories: 5,
  },
];

describe(headlineOf, () => {
  it("should count the world when no nation is picked", () => {
    expect(headlineOf(TWO_NATIONS, Option.none())).toStrictEqual({
      stats: [
        { label: "国", value: "2" },
        { label: "州", value: "3" },
        { label: "seed", value: "1" },
      ],
      title: "世界",
    });
  });

  it("should read the picked nation's economy when one is picked", () => {
    const selection = Option.some(summaryOf(TWO_NATIONS, ECONOMIES, 1));

    expect(headlineOf(TWO_NATIONS, selection)).toStrictEqual({
      stats: [
        { label: "人的資源", value: "1,352,004" },
        { label: "工場", value: "民 25 / 軍 5" },
        { label: "装備", value: "12,500" },
        { label: "建設", value: "25%" },
      ],
      title: "国1",
    });
  });
});
