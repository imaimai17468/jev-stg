import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { startCompliance } from "@/shared/entities/world/compliance";
import type { Colour } from "@/shared/entities/world/geography/nations";
import { NO_RESOURCES } from "@/shared/entities/world/resources";
import { paintWorld } from "./map-bitmap";
import { airTintOf } from "./map-mode";
import type { Tint } from "./map-mode";
import {
  COMPLIANCE_COLOURS,
  HATCH_SHADE,
  MAP_COLOURS,
  NAVAL_LAND_SHADE,
  NETWORK_COLOURS,
  RESOURCE_COLOURS,
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

/** Each province of the fixture in a strategic region of its own. */
const REGION_EACH = Int32Array.from([0, 1, 2]);

/** The air map over the fixture with `first` and `second` the air power the two nations fly over each region. */
const skies = (
  first: readonly number[],
  second: readonly number[],
  regionOf: Int32Array = REGION_EACH
): Tint =>
  airTintOf([Float32Array.from(first), Float32Array.from(second)], regionOf);

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

/** The channels of a cell painted `colour` at full opacity. */
const opaque = (colour: Colour): readonly number[] => [
  colour.red,
  colour.green,
  colour.blue,
  255,
];

/**
 * The intelligence map over the fixture with nation 1 holding province 1, and
 * each of `strengths` the network nation 0, 1 and 2 have there.
 */
const intelOver = (
  strengths: readonly number[],
  picked: Option.Option<number>
): readonly number[] =>
  channelsAt(
    paintWorld(FIXTURE_WORLD, HELD_BY_TWO, picked, {
      mode: "intel",
      networks: strengths.map((strength) =>
        Float32Array.from([0, strength, 0])
      ),
    }),
    2
  );

describe("paintWorld on the intelligence map", () => {
  it("should paint a province by the strongest foreign network there when nobody is picked", () => {
    expect(intelOver([30, 0, 70], NO_HIGHLIGHT)).toStrictEqual(
      opaque(NETWORK_COLOURS.strong)
    );
  });

  it("should paint a province by the picked nation's own network there when a nation is picked", () => {
    expect(intelOver([30, 0, 70], Option.some(0))).toStrictEqual(
      opaque(NETWORK_COLOURS.counts)
    );
  });

  it("should leave out the holder's own network when nobody is picked", () => {
    expect(intelOver([0, 70, 0], NO_HIGHLIGHT)).toStrictEqual(
      opaque(NETWORK_COLOURS.none)
    );
  });
});

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
        stationed: new Map(),
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
        stationed: new Map([[0, 5]]),
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

  it("should paint a sea zone in its holder's colour when one nation's ships cover it on the naval map", () => {
    const naval: Tint = {
      mode: "naval",
      waters: [Float32Array.from([0, 0, 10]), Float32Array.from([0, 0, 0])],
    };

    expect(
      channelsAt(
        paintWorld(FIXTURE_WORLD, HELD_BY_TWO, NO_HIGHLIGHT, naval),
        11
      )
    ).toStrictEqual([200, 0, 0, 255]);
  });

  it("should stripe a sea zone when two nations share it on the naval map", () => {
    const naval: Tint = {
      mode: "naval",
      waters: [Float32Array.from([0, 0, 6]), Float32Array.from([0, 0, 4])],
    };

    expect(
      channelsAt(
        paintWorld(FIXTURE_WORLD, HELD_BY_TWO, NO_HIGHLIGHT, naval),
        11
      )
    ).toStrictEqual([Math.round(200 * HATCH_SHADE), 0, 0, 255]);
  });

  it("should leave a sea zone the sea's colour when no warship covers it on the naval map", () => {
    const naval: Tint = {
      mode: "naval",
      waters: [Float32Array.from([0, 0, 0]), Float32Array.from([0, 0, 0])],
    };

    expect(
      channelsAt(
        paintWorld(FIXTURE_WORLD, HELD_BY_TWO, NO_HIGHLIGHT, naval),
        11
      )
    ).toStrictEqual([
      MAP_COLOURS.sea.red,
      MAP_COLOURS.sea.green,
      MAP_COLOURS.sea.blue,
      255,
    ]);
  });

  it("should dim the land in its holder's colour when the map shows naval supremacy", () => {
    const naval: Tint = { mode: "naval", waters: [] };

    expect(
      channelsAt(paintWorld(FIXTURE_WORLD, HELD_BY_TWO, NO_HIGHLIGHT, naval), 0)
    ).toStrictEqual([Math.round(200 * NAVAL_LAND_SHADE), 0, 0, 255]);
  });

  it("should fill a province with its richest resource's colour when the map shows resources", () => {
    const resources: Tint = {
      deposits: [{ ...NO_RESOURCES, tungsten: 4 }, NO_RESOURCES, NO_RESOURCES],
      mode: "resources",
      world: {
        aluminium: 10,
        chromium: 10,
        oil: 10,
        rubber: 10,
        steel: 10,
        tungsten: 10,
      },
    };

    expect(
      channelsAt(
        paintWorld(FIXTURE_WORLD, HELD_BY_TWO, NO_HIGHLIGHT, resources),
        0
      )
    ).toStrictEqual([
      RESOURCE_COLOURS.tungsten.red,
      RESOURCE_COLOURS.tungsten.green,
      RESOURCE_COLOURS.tungsten.blue,
      255,
    ]);
  });

  it("should dim the land in its holder's colour when nobody flies over its region on the air map", () => {
    expect(
      channelsAt(
        paintWorld(
          FIXTURE_WORLD,
          HELD_BY_TWO,
          NO_HIGHLIGHT,
          skies([0, 0, 0], [0, 0, 0])
        ),
        0
      )
    ).toStrictEqual([Math.round(200 * NAVAL_LAND_SHADE), 0, 0, 255]);
  });

  it("should leave a sea zone the sea's colour when nobody flies over its region on the air map", () => {
    expect(
      channelsAt(
        paintWorld(
          FIXTURE_WORLD,
          HELD_BY_TWO,
          NO_HIGHLIGHT,
          skies([0, 0, 0], [0, 0, 0])
        ),
        11
      )
    ).toStrictEqual([
      MAP_COLOURS.sea.red,
      MAP_COLOURS.sea.green,
      MAP_COLOURS.sea.blue,
      255,
    ]);
  });

  it("should paint the land in the colour of the nation flying the most when it holds the sky on the air map", () => {
    expect(
      channelsAt(
        paintWorld(
          FIXTURE_WORLD,
          HELD_BY_TWO,
          NO_HIGHLIGHT,
          skies([0, 0, 0], [10, 0, 0])
        ),
        0
      )
    ).toStrictEqual([100, 0, 0, 255]);
  });

  it("should paint a sea zone in the colour of the nation flying the most when it holds the sky on the air map", () => {
    expect(
      channelsAt(
        paintWorld(
          FIXTURE_WORLD,
          HELD_BY_TWO,
          NO_HIGHLIGHT,
          skies([0, 0, 0], [0, 0, 10])
        ),
        11
      )
    ).toStrictEqual([100, 0, 0, 255]);
  });

  it("should stripe the land when two nations fight for its sky on the air map", () => {
    expect(
      channelsAt(
        paintWorld(
          FIXTURE_WORLD,
          HELD_BY_TWO,
          NO_HIGHLIGHT,
          skies([6, 0, 0], [4, 0, 0])
        ),
        0
      )
    ).toStrictEqual([Math.round(200 * HATCH_SHADE), 0, 0, 255]);
  });

  it("should draw a region border when the neighbouring province lies in another region on the air map", () => {
    expect(
      channelsAt(
        paintWorld(
          FIXTURE_WORLD,
          HELD_BY_ONE,
          NO_HIGHLIGHT,
          skies([0, 0, 0], [0, 0, 0])
        ),
        1
      )
    ).toStrictEqual([
      MAP_COLOURS.airBorder.red,
      MAP_COLOURS.airBorder.green,
      MAP_COLOURS.airBorder.blue,
      255,
    ]);
  });

  it("should draw a province border when the neighbouring province lies in the same region on the air map", () => {
    expect(
      channelsAt(
        paintWorld(
          FIXTURE_WORLD,
          HELD_BY_ONE,
          NO_HIGHLIGHT,
          skies([0, 0, 0], [0, 0, 0], Int32Array.from([0, 0, 1]))
        ),
        1
      )
    ).toStrictEqual([
      MAP_COLOURS.provinceBorder.red,
      MAP_COLOURS.provinceBorder.green,
      MAP_COLOURS.provinceBorder.blue,
      255,
    ]);
  });
});
