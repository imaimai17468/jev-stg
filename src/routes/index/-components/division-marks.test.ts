import { describe, expect, it } from "vite-plus/test";
import type { Division, DivisionKind } from "@/shared/entities/world/divisions";
import { raisedAt } from "@/shared/entities/world/divisions";
import type { SupplyNetwork } from "@/shared/entities/world/supply";
import { divisionMarks } from "./division-marks";
import { FIXTURE_WORLD } from "./world-fixture";

const standing = (nation: number, province: number): Division =>
  raisedAt(nation, province, "infantry");

const raised = (kind: DivisionKind): Division => raisedAt(0, 1, kind);

/** Every province supplying far more than anyone stands in it, for both nations. */
const SUPPLIED: SupplyNetwork = {
  capacity: [0, 1].map(() =>
    Float32Array.from(FIXTURE_WORLD.provinces, () => 100)
  ),
  demand: new Map(),
  stationed: new Map(),
  nations: 2,
  upkeepMet: [1, 1],
};

describe(divisionMarks, () => {
  it("should count a nation's divisions when they stand in one province", () => {
    expect(
      divisionMarks(FIXTURE_WORLD, [standing(0, 1), standing(0, 1)], SUPPLIED)
    ).toStrictEqual([
      {
        colour: { blue: 0, green: 0, red: 200 },
        count: 2,
        province: 1,
        supply: "supplied",
        symbol: "infantry",
        x: 2.5,
        y: 0,
      },
    ]);
  });

  it("should draw the heavier side when two nations stand in one province", () => {
    const present = [standing(1, 0), standing(1, 0), standing(0, 0)];

    expect(divisionMarks(FIXTURE_WORLD, present, SUPPLIED).at(0)?.count).toBe(
      2
    );
  });

  it("should draw nothing when no division stands anywhere", () => {
    expect(divisionMarks(FIXTURE_WORLD, [], SUPPLIED)).toStrictEqual([]);
  });

  it("should fall back to black when the world holds no nation with that id", () => {
    expect(
      divisionMarks(FIXTURE_WORLD, [standing(9, 0)], SUPPLIED).at(0)?.colour
    ).toStrictEqual({ blue: 0, green: 0, red: 0 });
  });

  it("should mark the counter short when the heavier side's depots meet only part of its upkeep", () => {
    expect(
      divisionMarks(FIXTURE_WORLD, [standing(0, 1)], {
        ...SUPPLIED,
        upkeepMet: [0.6, 1],
      }).at(0)?.supply
    ).toBe("short");
  });

  it("should draw the symbol most of a province's divisions share when their kinds differ", () => {
    const present = [
      raised("infantry"),
      raised("light-armour"),
      raised("heavy-armour"),
    ];

    expect(divisionMarks(FIXTURE_WORLD, present, SUPPLIED).at(0)?.symbol).toBe(
      "armour"
    );
  });

  it("should draw only the heavier side's symbol when the lighter side's kind differs", () => {
    const present = [
      raised("mountaineers"),
      raised("mountaineers"),
      raisedAt(1, 1, "paratroopers"),
    ];

    expect(divisionMarks(FIXTURE_WORLD, present, SUPPLIED).at(0)?.symbol).toBe(
      "mountain"
    );
  });
});
