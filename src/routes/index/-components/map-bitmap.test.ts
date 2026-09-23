import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { startCompliance } from "@/shared/entities/world/compliance";
import { paintWorld } from "./map-bitmap";
import type { Tint } from "./map-mode";
import {
  COMPLIANCE_COLOURS,
  HATCH_SHADE,
  MAP_COLOURS,
  SUPPLY_COLOURS,
} from "./map-palette";
import {
  FIXTURE_WORLD,
  HELD_BY_NOBODY,
  HELD_BY_ONE,
  HELD_BY_TWO,
} from "./world-fixture";

/** The map coloured by who holds what. */
const POLITICAL: Tint = { mode: "political" };

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
      channelsAt(
        paintWorld(FIXTURE_WORLD, HELD_BY_ONE, NO_HIGHLIGHT, POLITICAL),
        0
      )
    ).toStrictEqual([200, 0, 0, 255]);
  });

  it("should draw a province border when the neighbour belongs to the same nation", () => {
    expect(
      channelsAt(
        paintWorld(FIXTURE_WORLD, HELD_BY_ONE, NO_HIGHLIGHT, POLITICAL),
        1
      )
    ).toStrictEqual([
      MAP_COLOURS.provinceBorder.red,
      MAP_COLOURS.provinceBorder.green,
      MAP_COLOURS.provinceBorder.blue,
      255,
    ]);
  });

  it("should draw a nation border when the neighbour belongs to another nation", () => {
    expect(
      channelsAt(
        paintWorld(FIXTURE_WORLD, HELD_BY_TWO, NO_HIGHLIGHT, POLITICAL),
        1
      )
    ).toStrictEqual([
      MAP_COLOURS.nationBorder.red,
      MAP_COLOURS.nationBorder.green,
      MAP_COLOURS.nationBorder.blue,
      255,
    ]);
  });

  it("should draw a nation border along the coast when the neighbour is water", () => {
    expect(
      channelsAt(
        paintWorld(FIXTURE_WORLD, HELD_BY_ONE, NO_HIGHLIGHT, POLITICAL),
        3
      )
    ).toStrictEqual([
      MAP_COLOURS.nationBorder.red,
      MAP_COLOURS.nationBorder.green,
      MAP_COLOURS.nationBorder.blue,
      255,
    ]);
  });

  it("should fill water with the sea colour when the cell ends the last row", () => {
    expect(
      channelsAt(
        paintWorld(FIXTURE_WORLD, HELD_BY_ONE, NO_HIGHLIGHT, POLITICAL),
        11
      )
    ).toStrictEqual([
      MAP_COLOURS.sea.red,
      MAP_COLOURS.sea.green,
      MAP_COLOURS.sea.blue,
      255,
    ]);
  });

  it("should draw the picked nation brighter than the rest when one is picked", () => {
    const plain =
      channelsAt(
        paintWorld(FIXTURE_WORLD, HELD_BY_ONE, NO_HIGHLIGHT, POLITICAL),
        0
      ).at(0) ?? 0;
    const picked =
      channelsAt(
        paintWorld(FIXTURE_WORLD, HELD_BY_ONE, Option.some(0), POLITICAL),
        0
      ).at(0) ?? 0;

    expect(picked).toBeGreaterThan(plain);
  });

  it("should fill land nobody holds with the unowned colour when no nation answers to it", () => {
    expect(
      channelsAt(
        paintWorld(FIXTURE_WORLD, HELD_BY_NOBODY, NO_HIGHLIGHT, POLITICAL),
        0
      )
    ).toStrictEqual([
      MAP_COLOURS.unowned.red,
      MAP_COLOURS.unowned.green,
      MAP_COLOURS.unowned.blue,
      255,
    ]);
  });

  it("should fill a province with its supply level's colour when the map shows supply", () => {
    const supply: Tint = {
      mode: "supply",
      network: {
        capacity: [Float32Array.from([100, 100, 0]), new Float32Array(3)],
        demand: new Map(),
        nations: 2,
        upkeepMet: [1, 1],
      },
    };

    expect(
      channelsAt(
        paintWorld(FIXTURE_WORLD, HELD_BY_ONE, NO_HIGHLIGHT, supply),
        0
      )
    ).toStrictEqual([
      SUPPLY_COLOURS.plenty.red,
      SUPPLY_COLOURS.plenty.green,
      SUPPLY_COLOURS.plenty.blue,
      255,
    ]);
  });

  it("should darken the cells a stripe crosses when a province on the supply map is far short", () => {
    const starved: Tint = {
      mode: "supply",
      network: {
        capacity: [new Float32Array(3), new Float32Array(3)],
        demand: new Map([[0, 5]]),
        nations: 2,
        upkeepMet: [1, 1],
      },
    };

    expect(
      channelsAt(
        paintWorld(FIXTURE_WORLD, HELD_BY_ONE, NO_HIGHLIGHT, starved),
        0
      )
    ).toStrictEqual([
      Math.round(SUPPLY_COLOURS.starved.red * HATCH_SHADE),
      Math.round(SUPPLY_COLOURS.starved.green * HATCH_SHADE),
      Math.round(SUPPLY_COLOURS.starved.blue * HATCH_SHADE),
      255,
    ]);
  });

  it("should fill a province with its compliance level's colour when the map shows compliance", () => {
    const compliance: Tint = {
      compliance: startCompliance(HELD_BY_TWO),
      mode: "compliance",
    };

    expect(
      channelsAt(
        paintWorld(FIXTURE_WORLD, HELD_BY_TWO, NO_HIGHLIGHT, compliance),
        0
      )
    ).toStrictEqual([
      COMPLIANCE_COLOURS.home.red,
      COMPLIANCE_COLOURS.home.green,
      COMPLIANCE_COLOURS.home.blue,
      255,
    ]);
  });

  it("should paint land nobody holds as unowned when the map shows compliance", () => {
    const compliance: Tint = {
      compliance: startCompliance(HELD_BY_NOBODY),
      mode: "compliance",
    };

    expect(
      channelsAt(
        paintWorld(FIXTURE_WORLD, HELD_BY_NOBODY, NO_HIGHLIGHT, compliance),
        0
      )
    ).toStrictEqual([
      MAP_COLOURS.unowned.red,
      MAP_COLOURS.unowned.green,
      MAP_COLOURS.unowned.blue,
      255,
    ]);
  });
});
