import { describe, expect, it } from "vite-plus/test";
import { LINE_OWNERS, LINE_WORLD } from "./army-fixture";
import type { World } from "./index";
import { NO_NATION } from "./nations";
import type { Province } from "./provinces";
import { randomFromSeed } from "./random";
import { atWar, declared, enemiesOf, noWars, startWars } from "./wars";

describe(atWar, () => {
  it("should read peace when nobody has declared anything", () => {
    expect(atWar(noWars(3), 0, 1)).toBeFalsy();
  });
});

describe(declared, () => {
  it("should put both nations at war when one declares on the other", () => {
    const wars = declared(noWars(3), { one: 2, other: 0 });

    expect([atWar(wars, 0, 2), atWar(wars, 2, 0)]).toStrictEqual([true, true]);
  });

  it("should leave the nations outside the pair at peace when one is declared", () => {
    const wars = declared(noWars(3), { one: 2, other: 0 });

    expect(atWar(wars, 0, 1)).toBeFalsy();
  });
});

describe(enemiesOf, () => {
  it("should name every nation a nation is fighting when it has more than one", () => {
    const wars = declared(declared(noWars(3), { one: 0, other: 1 }), {
      one: 0,
      other: 2,
    });

    expect(enemiesOf(wars, 0)).toStrictEqual([1, 2]);
  });
});

describe(startWars, () => {
  it("should set the two nations that share a border against each other when a world opens", () => {
    const wars = startWars(LINE_WORLD, LINE_OWNERS, randomFromSeed(7));

    expect(atWar(wars, 0, 1)).toBeTruthy();
  });

  it("should leave a world at peace when no two nations touch", () => {
    const apart = Int32Array.from([0, 0, 0, 0, -1]);

    const wars = startWars(LINE_WORLD, apart, randomFromSeed(7));

    expect(enemiesOf(wars, 0)).toStrictEqual([]);
  });
});

describe("startWars on a crowded border", () => {
  /** Eight nations in a row, one province each, so every neighbour pair overlaps. */
  const CHAIN: World = {
    ...LINE_WORLD,
    nations: Array.from({ length: 8 }, (_, id) => ({
      ...NO_NATION,
      capital: id,
      id,
    })),
    provinces: Array.from({ length: 8 }, (_, id): Province => ({
      cells: 1,
      id,
      kind: "land",
      neighbours: [id - 1, id + 1].filter(
        (beside) => beside >= 0 && beside < 8
      ),
      terrain: "plains",
      x: id,
      y: 0,
    })),
  };

  it("should stop at three wars with no nation in two when more pairs touch", () => {
    const wars = startWars(
      CHAIN,
      Int32Array.from([0, 1, 2, 3, 4, 5, 6, 7]),
      randomFromSeed(3)
    );

    expect(
      Array.from({ length: 8 }, (_, nation) => enemiesOf(wars, nation).length)
        .filter((count) => count > 0)
        .toSorted((left, right) => left - right)
    ).toStrictEqual([1, 1, 1, 1, 1, 1]);
  });
});
