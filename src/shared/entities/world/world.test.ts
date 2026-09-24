import { describe, expect, it } from "vite-plus/test";
import { airspaceOf } from "./airspace";
import { initialOwners } from "./nations";
import { UNASSIGNED } from "./spread";
import { generateWorld, NATION_COUNT } from "./world";

/**
 * Drawn once for the whole file, because one draw takes seconds and a test that
 * draws twice runs into the per-test timeout.
 */
const WORLD = generateWorld(31);

describe(generateWorld, () => {
  it("should give every cell a province when the world is drawn", () => {
    expect(
      [...WORLD.cellProvince].some((province) => province < 0)
    ).toBeFalsy();
  });

  it("should raise one nation per capital when the world is drawn", () => {
    expect(WORLD.nations).toHaveLength(NATION_COUNT);
  });

  it("should leave no land unheld when the world is spread into owners", () => {
    const owners = initialOwners(WORLD.provinces, WORLD.nations);
    const unheld = WORLD.provinces.filter(
      (province) =>
        province.kind === "land" && owners.at(province.id) === UNASSIGNED
    );

    expect(unheld).toStrictEqual([]);
  });

  it("should leave every nation holding ground when the world is spread into owners", () => {
    const world = generateWorld(4242);
    const owners = initialOwners(world.provinces, world.nations);
    const held = world.nations.map((nation) =>
      world.provinces
        .filter((province) => owners.at(province.id) === nation.id)
        .reduce((cells, province) => cells + province.cells, 0)
    );

    expect(held.filter((cells) => cells === 0)).toStrictEqual([]);
  });

  it("should draw the same nations when the seed is the same", () => {
    expect(generateWorld(31).nations).toStrictEqual(WORLD.nations);
  });

  it("should divide the world's own provinces into its strategic regions when the world is drawn", () => {
    expect(WORLD.airspace).toStrictEqual(airspaceOf(WORLD.provinces, 31));
  });
});
