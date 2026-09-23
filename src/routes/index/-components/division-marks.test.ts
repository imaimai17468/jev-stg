import { describe, expect, it } from "vite-plus/test";
import type { Division } from "@/shared/entities/world/divisions";
import { raisedAt } from "@/shared/entities/world/divisions";
import { divisionMarks } from "./division-marks";
import { FIXTURE_WORLD } from "./world-fixture";

const standing = (nation: number, province: number): Division =>
  raisedAt(nation, province);

describe(divisionMarks, () => {
  it("should count a nation's divisions when they stand in one province", () => {
    expect(
      divisionMarks(FIXTURE_WORLD, [standing(0, 1), standing(0, 1)])
    ).toStrictEqual([
      {
        colour: { blue: 0, green: 0, red: 200 },
        count: 2,
        province: 1,
        x: 2.5,
        y: 0,
      },
    ]);
  });

  it("should draw the heavier side when two nations stand in one province", () => {
    const present = [standing(1, 0), standing(1, 0), standing(0, 0)];

    expect(divisionMarks(FIXTURE_WORLD, present).at(0)?.count).toBe(2);
  });

  it("should draw nothing when no division stands anywhere", () => {
    expect(divisionMarks(FIXTURE_WORLD, [])).toStrictEqual([]);
  });

  it("should fall back to black when the world holds no nation with that id", () => {
    expect(
      divisionMarks(FIXTURE_WORLD, [standing(9, 0)]).at(0)?.colour
    ).toStrictEqual({ blue: 0, green: 0, red: 0 });
  });
});
