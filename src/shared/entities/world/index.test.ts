import { describe, expect, it } from "vite-plus/test";
import { generateWorld, NATION_COUNT } from "./index";
import { UNASSIGNED } from "./spread";

describe(generateWorld, () => {
  it("should give every cell a province when the world is drawn", () => {
    const world = generateWorld(31);

    expect(
      [...world.cellProvince].some((province) => province < 0)
    ).toBeFalsy();
  });

  it("should raise one nation per capital when the world is drawn", () => {
    expect(generateWorld(31).nations).toHaveLength(NATION_COUNT);
  });

  it("should leave no land unheld when the world is drawn", () => {
    const world = generateWorld(31);
    const unheld = world.provinces.filter(
      (province) =>
        province.kind === "land" && world.owners.at(province.id) === UNASSIGNED
    );

    expect(unheld).toStrictEqual([]);
  });

  it("should leave every nation holding ground when the world is drawn", () => {
    const world = generateWorld(4242);
    const held = world.nations.map((nation) =>
      world.provinces
        .filter((province) => world.owners.at(province.id) === nation.id)
        .reduce((cells, province) => cells + province.cells, 0)
    );

    expect(held.filter((cells) => cells === 0)).toStrictEqual([]);
  });

  it("should draw the same nations when the seed is the same", () => {
    expect(generateWorld(31).nations).toStrictEqual(generateWorld(31).nations);
  });
});
