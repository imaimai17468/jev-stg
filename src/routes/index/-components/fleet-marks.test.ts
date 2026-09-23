import { describe, expect, it } from "vite-plus/test";
import type { Navy } from "@/shared/entities/world/navy";
import { NO_NAVY } from "@/shared/entities/world/navy";
import { launched } from "@/shared/entities/world/ships";
import { fleetMarks } from "./fleet-marks";
import { FIXTURE_WORLD } from "./world-fixture";

/** A navy with a task force of `ships` destroyers in `zone`. */
const navyAt = (zone: number, ships: number): Navy => ({
  ...NO_NAVY,
  fleets: [
    {
      mission: "patrol",
      role: "main",
      ships: Array.from({ length: ships }, () => launched("destroyer-2")),
      zone,
    },
  ],
});

describe(fleetMarks, () => {
  it("should draw no counter when no nation has a ship at sea", () => {
    expect(fleetMarks(FIXTURE_WORLD, [NO_NAVY, NO_NAVY])).toStrictEqual([]);
  });

  it("should draw the zone's counter for the nation with the most ships when two share it", () => {
    expect(
      fleetMarks(FIXTURE_WORLD, [navyAt(2, 1), navyAt(2, 3)])
    ).toStrictEqual([
      {
        colour: { blue: 0, green: 0, red: 100 },
        count: 3,
        x: 4.5,
        y: 0.5,
      },
    ]);
  });
});
