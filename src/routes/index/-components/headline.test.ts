import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  INDEPENDENT,
  openingDiplomacy,
  warDeclared,
} from "@/shared/entities/world/diplomacy";
import type { NationEconomy } from "@/shared/entities/world/economy";
import { NO_ECONOMY } from "@/shared/entities/world/economy";
import { supplyOf } from "@/shared/entities/world/simulation";
import { headlineOf } from "./headline";
import { summaryOf } from "./nation-summary";
import { FIXTURE_WORLD, fixtureSimulation, HELD_BY_TWO } from "./world-fixture";

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
  it("should count the nations still standing and their wars when no nation is picked", () => {
    const diplomacy = warDeclared(
      {
        ...openingDiplomacy(HELD_BY_TWO, 3, []),
        standings: [INDEPENDENT, INDEPENDENT, { by: 0, kind: "annexed" }],
      },
      0,
      1
    );

    expect(headlineOf(FIXTURE_WORLD, diplomacy, Option.none())).toStrictEqual({
      stats: [
        { label: "国", value: "2" },
        { label: "戦争", value: "1" },
        { label: "州", value: "3" },
        { label: "seed", value: "1" },
      ],
      title: "世界",
    });
  });

  it("should read the picked nation's economy when one is picked", () => {
    const selection = Option.some(
      summaryOf(
        FIXTURE_WORLD,
        fixtureSimulation({ economies: ECONOMIES }),
        supplyOf(FIXTURE_WORLD, fixtureSimulation({ economies: ECONOMIES })),
        1
      )
    );

    expect(
      headlineOf(FIXTURE_WORLD, fixtureSimulation().diplomacy, selection)
    ).toStrictEqual({
      stats: [
        { label: "人的資源", value: "1,352,004" },
        { label: "師団", value: "0" },
        { label: "工場", value: "民 25 / 軍 5" },
        { label: "装備", value: "12,500" },
        { label: "建設", value: "25%" },
      ],
      title: "国1",
    });
  });
});
