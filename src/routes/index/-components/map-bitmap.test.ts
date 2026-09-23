import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { paintWorld } from "./map-bitmap";
import { MAP_COLOURS } from "./map-palette";
import {
  FIXTURE_WORLD,
  HELD_BY_NOBODY,
  HELD_BY_ONE,
  HELD_BY_TWO,
} from "./world-fixture";

/** Nothing picked, so no nation is drawn brighter. */
const NO_HIGHLIGHT = Option.none<number>();

const channelsAt = (
  pixels: Uint8ClampedArray,
  cell: number
): readonly number[] => [
  pixels[cell * 4] ?? 0,
  pixels[cell * 4 + 1] ?? 0,
  pixels[cell * 4 + 2] ?? 0,
  pixels[cell * 4 + 3] ?? 0,
];

describe(paintWorld, () => {
  it("should fill a cell with its owner's colour when nothing beside it differs", () => {
    expect(
      channelsAt(paintWorld(FIXTURE_WORLD, HELD_BY_ONE, NO_HIGHLIGHT), 0)
    ).toStrictEqual([200, 0, 0, 255]);
  });

  it("should draw a province border when the neighbour belongs to the same nation", () => {
    expect(
      channelsAt(paintWorld(FIXTURE_WORLD, HELD_BY_ONE, NO_HIGHLIGHT), 1)
    ).toStrictEqual([
      MAP_COLOURS.provinceBorder.red,
      MAP_COLOURS.provinceBorder.green,
      MAP_COLOURS.provinceBorder.blue,
      255,
    ]);
  });

  it("should draw a nation border when the neighbour belongs to another nation", () => {
    expect(
      channelsAt(paintWorld(FIXTURE_WORLD, HELD_BY_TWO, NO_HIGHLIGHT), 1)
    ).toStrictEqual([
      MAP_COLOURS.nationBorder.red,
      MAP_COLOURS.nationBorder.green,
      MAP_COLOURS.nationBorder.blue,
      255,
    ]);
  });

  it("should draw a nation border along the coast when the neighbour is water", () => {
    expect(
      channelsAt(paintWorld(FIXTURE_WORLD, HELD_BY_ONE, NO_HIGHLIGHT), 3)
    ).toStrictEqual([
      MAP_COLOURS.nationBorder.red,
      MAP_COLOURS.nationBorder.green,
      MAP_COLOURS.nationBorder.blue,
      255,
    ]);
  });

  it("should fill water with the sea colour when the cell ends the last row", () => {
    expect(
      channelsAt(paintWorld(FIXTURE_WORLD, HELD_BY_ONE, NO_HIGHLIGHT), 11)
    ).toStrictEqual([
      MAP_COLOURS.sea.red,
      MAP_COLOURS.sea.green,
      MAP_COLOURS.sea.blue,
      255,
    ]);
  });

  it("should draw the picked nation brighter than the rest when one is picked", () => {
    const plain =
      channelsAt(paintWorld(FIXTURE_WORLD, HELD_BY_ONE, NO_HIGHLIGHT), 0).at(
        0
      ) ?? 0;
    const picked =
      channelsAt(paintWorld(FIXTURE_WORLD, HELD_BY_ONE, Option.some(0)), 0).at(
        0
      ) ?? 0;

    expect(picked).toBeGreaterThan(plain);
  });

  it("should fill land nobody holds with the unowned colour when no nation answers to it", () => {
    expect(
      channelsAt(paintWorld(FIXTURE_WORLD, HELD_BY_NOBODY, NO_HIGHLIGHT), 0)
    ).toStrictEqual([
      MAP_COLOURS.unowned.red,
      MAP_COLOURS.unowned.green,
      MAP_COLOURS.unowned.blue,
      255,
    ]);
  });
});
