import { describe, expect, it } from "vite-plus/test";
import {
  buildNations,
  growOwners,
  nationColour,
  pickCapitals,
} from "./nations";
import type { Province } from "./provinces";
import { randomFromSeed } from "./random";
import { UNASSIGNED } from "./spread";

const land = (
  id: number,
  x: number,
  neighbours: readonly number[]
): Province => ({
  cells: 1,
  id,
  kind: "land",
  neighbours,
  terrain: "plains",
  x,
  y: 0,
});

const sea = (
  id: number,
  x: number,
  neighbours: readonly number[]
): Province => ({
  cells: 1,
  id,
  kind: "sea",
  neighbours,
  x,
  y: 0,
});

/**
 * A chain of four land provinces, a sea zone beyond them, and an island that
 * only the sea touches. The island sits between two of the chain's provinces,
 * so the search for its owner meets a province no closer than the one it
 * already holds.
 */
const WORLD: readonly Province[] = [
  land(0, 0, [1]),
  land(1, 1, [0, 2]),
  land(2, 2, [1, 3]),
  land(3, 3, [2, 4]),
  sea(4, 4, [3, 5]),
  land(5, 2.5, [4]),
];

describe(nationColour, () => {
  it("should answer the same colour when the slot is the same", () => {
    expect(nationColour(3)).toStrictEqual(nationColour(3));
  });

  it("should answer a different colour when the slot differs", () => {
    expect(nationColour(3)).not.toStrictEqual(nationColour(4));
  });

  it("should keep every channel inside a byte when the wheel is walked", () => {
    const channels = Array.from({ length: 14 }, (_, slot) =>
      nationColour(slot)
    ).flatMap((colour) => [colour.red, colour.green, colour.blue]);

    expect(
      channels.every(
        (value) => Number.isInteger(value) && value >= 0 && value <= 255
      )
    ).toBeTruthy();
  });
});

describe(pickCapitals, () => {
  it("should pick as many capitals as asked when the world holds enough land", () => {
    expect(pickCapitals(WORLD, 3, randomFromSeed(2))).toHaveLength(3);
  });

  it("should pick only land when the world holds water too", () => {
    const capitals = pickCapitals(WORLD, 4, randomFromSeed(2));

    expect(capitals.includes(4)).toBeFalsy();
  });

  it("should pick the far end second when the first capital sits at one end", () => {
    const capitals = pickCapitals(
      [land(0, 0, []), land(1, 9, [])],
      2,
      randomFromSeed(2)
    );

    expect(capitals.toSorted((left, right) => left - right)).toStrictEqual([
      0, 1,
    ]);
  });

  it("should pick nothing when the world holds no land at all", () => {
    expect(pickCapitals([sea(0, 0, [])], 2, randomFromSeed(2))).toStrictEqual(
      []
    );
  });

  it("should pick each province once when more capitals are asked for than the land holds", () => {
    const capitals = pickCapitals(WORLD, 9, randomFromSeed(2));

    expect(new Set(capitals).size).toBe(capitals.length);
  });

  it("should stop at the land it has when more capitals are asked for than it holds", () => {
    expect(pickCapitals(WORLD, 9, randomFromSeed(2))).toHaveLength(5);
  });
});

describe(growOwners, () => {
  it("should split the connected land between the capitals when both can reach it", () => {
    expect([...growOwners(WORLD, [0, 3])]).toStrictEqual([
      0,
      0,
      1,
      1,
      UNASSIGNED,
      1,
    ]);
  });

  it("should leave the sea unheld when every capital sits on land", () => {
    const owners = growOwners(WORLD, [0]);

    expect(owners.at(4)).toBe(UNASSIGNED);
  });
});

describe(buildNations, () => {
  it("should build one nation per capital when the capitals are listed", () => {
    expect(
      buildNations([3, 7], randomFromSeed(5)).map((nation) => nation.capital)
    ).toStrictEqual([3, 7]);
  });

  it("should number the nations from zero when they are built", () => {
    expect(
      buildNations([3, 7], randomFromSeed(5)).map((nation) => nation.id)
    ).toStrictEqual([0, 1]);
  });

  it("should name every nation when the capitals are listed", () => {
    expect(
      buildNations([3, 7], randomFromSeed(5)).every(
        (nation) => nation.name.length > 0
      )
    ).toBeTruthy();
  });
});
