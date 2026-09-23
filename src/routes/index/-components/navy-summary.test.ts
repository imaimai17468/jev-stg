import { describe, expect, it } from "vite-plus/test";
import { division } from "@/shared/entities/world/army-fixture";
import { NO_ECONOMY } from "@/shared/entities/world/economy";
import type { Navy } from "@/shared/entities/world/navy";
import { NO_NAVY } from "@/shared/entities/world/navy";
import { SHIPS_1936 } from "@/shared/entities/world/sea-fixture";
import { launched } from "@/shared/entities/world/ships";
import { navySummaryOf } from "./navy-summary";

/**
 * A navy half way through a 1936 destroyer, with a battleship and two destroyers
 * in its battle fleet, 40 convoys of which 12 run a lane, and a third of what
 * its cut-off ground and its trade over the sea needed arriving.
 */
const NAVY: Navy = {
  ...NO_NAVY,
  convoys: 40,
  fleets: [
    {
      mission: "patrol",
      role: "main",
      ships: [
        launched("battleship-2"),
        launched("destroyer-2"),
        launched("destroyer-2"),
      ],
      zone: 3,
    },
  ],
  lanes: [{ cargo: "supply", convoys: 12, zones: [3, 4] }],
  order: "destroyer",
  overseas: 0.334,
  progress: 592.25,
  traded: 0.5,
};

describe(navySummaryOf, () => {
  it("should read the yards, the ships by class, the convoys and the crossings when a nation has a navy", () => {
    expect(
      navySummaryOf(
        NAVY,
        { ...NO_ECONOMY, dockyards: 6 },
        [
          {
            convoys: 10,
            crossing: "landing",
            divisions: [division({}), division({})],
            lane: [3],
            nation: 0,
            readyOn: 20,
            target: 5,
          },
        ],
        SHIPS_1936
      )
    ).toStrictEqual([
      { label: "造船所", value: "6" },
      { label: "建造中", value: "駆逐艦（50%）" },
      { label: "駆逐艦", value: "2" },
      { label: "巡洋艦", value: "0" },
      { label: "戦艦", value: "1" },
      { label: "空母", value: "0" },
      { label: "潜水艦", value: "0" },
      { label: "輸送船（航路で使用中）", value: "40（12）" },
      { label: "飛び地に届いた補給", value: "33%" },
      { label: "海越しの輸入の到着", value: "50%" },
      { label: "準備中の海上輸送", value: "1（2師団）" },
    ]);
  });
});
