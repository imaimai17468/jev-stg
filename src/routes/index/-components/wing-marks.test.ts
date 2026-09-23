import { describe, expect, it } from "vite-plus/test";
import type { AirForce } from "@/shared/entities/world/air-force";
import { NO_AIR_FORCE } from "@/shared/entities/world/air-force";
import { wingMarks } from "./wing-marks";
import { FIXTURE_WORLD } from "./world-fixture";

/** An air force with one wing of `planes` fighters flying for the sky over `region`. */
const flyingOver = (region: number, planes: number): AirForce => ({
  ...NO_AIR_FORCE,
  wings: [
    { base: 0, mission: "superiority", model: "fighter-1", planes, region },
  ],
});

describe(wingMarks, () => {
  it("should draw no counter when no nation flies over any region", () => {
    expect(
      wingMarks(FIXTURE_WORLD, [NO_AIR_FORCE, NO_AIR_FORCE])
    ).toStrictEqual([]);
  });

  it("should draw no counter when the planes over a region add up to less than one", () => {
    expect(
      wingMarks(FIXTURE_WORLD, [flyingOver(0, 0.6), NO_AIR_FORCE])
    ).toStrictEqual([]);
  });

  it("should draw the region's counter for the nation flying the most when two fly over it", () => {
    expect(
      wingMarks(FIXTURE_WORLD, [flyingOver(1, 12), flyingOver(1, 29.6)])
    ).toStrictEqual([
      {
        colour: { blue: 0, green: 0, red: 100 },
        count: 30,
        x: 2.5,
        y: 0,
      },
    ]);
  });
});
