import { Option } from "effect";
import type { World } from "@/shared/entities/world";
import { occupancyOf } from "@/shared/entities/world/compliance";
import type { Grid } from "@/shared/entities/world/grid";
import { cellX, cellY, valueAt } from "@/shared/entities/world/grid";
import { itemAt } from "@/shared/entities/world/lookup";
import type { Colour, Nation } from "@/shared/entities/world/nations";
import type { LandProvince, Province } from "@/shared/entities/world/provinces";
import { NO_RESOURCES } from "@/shared/entities/world/resources";
import { UNASSIGNED } from "@/shared/entities/world/spread";
import { complianceLevelOf } from "./compliance-level";
import type { Tint } from "./map-mode";
import {
  COMPLIANCE_COLOURS,
  COMPLIANCE_HATCH,
  HATCH_SHADE,
  MAP_COLOURS,
  NAVAL_LAND_SHADE,
  NETWORK_COLOURS,
  NETWORK_HATCH,
  RESOURCE_COLOURS,
  SEA_HOLD_HATCH,
  SUPPLY_COLOURS,
  SUPPLY_HATCH,
  TERRAIN_SHADE,
} from "./map-palette";
import { networkLevelOf, strengthShown } from "./network-level";
import { richestResourceOf } from "./resource-level";
import { seaHoldOf } from "./sea-hold";
import { supplyLevelOf } from "./supply-level";

/** Stands in for the nation an unowned land province would name. */
const UNOWNED_NATION: Nation = {
  capital: 0,
  colour: MAP_COLOURS.unowned,
  id: -1,
  name: "",
};

/** How much brighter the nation the viewer picked is drawn. */
const HIGHLIGHT_LIFT = 1.3;

const CHANNEL_MAX = 255;

const LIFT_FOR = {
  false: 1,
  true: HIGHLIGHT_LIFT,
} satisfies Record<`${boolean}`, number>;
const CHANNELS = 4;
const OPAQUE = 255;

const shaded = (colour: Colour, factor: number): Colour => ({
  blue: Math.min(CHANNEL_MAX, Math.round(colour.blue * factor)),
  green: Math.min(CHANNEL_MAX, Math.round(colour.green * factor)),
  red: Math.min(CHANNEL_MAX, Math.round(colour.red * factor)),
});

/** A colour, how much to darken or lighten it by, and its stripes. */
interface Paint {
  readonly colour: Colour;
  readonly shade: number;
  /** The cells between the stripes across the province, zero for none. */
  readonly hatch: number;
}

/** What one province is filled with: a colour and its stripes. */
interface Fill {
  readonly colour: Colour;
  readonly hatch: number;
}

const UNOWNED_FILL: Fill = { colour: MAP_COLOURS.unowned, hatch: 0 };

/** How much each map mode that paints the land by its holder dims it. */
const LAND_SHADE_FOR = {
  air: NAVAL_LAND_SHADE,
  naval: NAVAL_LAND_SHADE,
  political: 1,
} satisfies Readonly<Record<"air" | "naval" | "political", number>>;

/**
 * What the air map paints a province under a sky someone flies in: the colour
 * of the nation flying the most there, striped where another's planes share
 * it, over the region the province lies in.
 */
const skyFill = (
  nations: readonly Nation[],
  province: number,
  tint: Extract<Tint, { readonly mode: "air" }>
): Option.Option<Fill> => {
  const hold = seaHoldOf(tint.power, valueAt(tint.regionOf, province));
  if (hold.level === "empty") {
    return Option.none();
  }
  return Option.some({
    colour: itemAt(nations, hold.leader, UNOWNED_NATION).colour,
    hatch: SEA_HOLD_HATCH[hold.level],
  });
};

/**
 * The paint a land province takes under `tint`: its holder's colour shaded by
 * its terrain on the political map, its supply level's colour, flat, on the
 * supply map, and on the intelligence map the level of the network the
 * `picked` nation has there, or the strongest foreign one with nobody picked.
 */
const paintOf = (
  nations: readonly Nation[],
  holder: number,
  province: LandProvince,
  tint: Tint,
  picked: Option.Option<number>
): Paint => {
  if (tint.mode === "intel") {
    const level = networkLevelOf(
      strengthShown(tint.networks, province.id, holder, picked)
    );
    return {
      colour: NETWORK_COLOURS[level],
      hatch: NETWORK_HATCH[level],
      shade: 1,
    };
  }
  if (tint.mode === "supply") {
    const level = supplyLevelOf(tint.network, holder, province.id);
    return {
      colour: SUPPLY_COLOURS[level],
      hatch: SUPPLY_HATCH[level],
      shade: 1,
    };
  }
  if (tint.mode === "resources") {
    return {
      colour:
        RESOURCE_COLOURS[
          richestResourceOf(
            itemAt(tint.deposits, province.id, NO_RESOURCES),
            tint.world
          )
        ],
      hatch: 0,
      shade: 1,
    };
  }
  if (tint.mode === "air") {
    const sky = skyFill(nations, province.id, tint);
    if (Option.isSome(sky)) {
      return { ...sky.value, shade: 1 };
    }
  }
  if (tint.mode === "compliance" && holder === UNASSIGNED) {
    return { colour: MAP_COLOURS.unowned, hatch: 0, shade: 1 };
  }
  if (tint.mode === "compliance") {
    const level = complianceLevelOf(
      occupancyOf(tint.compliance, holder, province.id)
    );
    return {
      colour: COMPLIANCE_COLOURS[level],
      hatch: COMPLIANCE_HATCH[level],
      shade: 1,
    };
  }
  // An unowned province carries `UNASSIGNED`, and a negative index has to miss
  // rather than reach the last nation the way `Array.prototype.at` would.
  return {
    colour: itemAt(nations, holder, UNOWNED_NATION).colour,
    hatch: 0,
    shade: TERRAIN_SHADE[province.terrain] * LAND_SHADE_FOR[tint.mode],
  };
};

/**
 * What a sea zone is filled with: the flat sea, on the naval map the colour
 * of the nation that holds it, striped where another's ships share it, and on
 * the air map the colour of its sky.
 */
const seaFill = (
  nations: readonly Nation[],
  zone: number,
  tint: Tint
): Fill => {
  if (tint.mode === "air") {
    return Option.getOrElse(skyFill(nations, zone, tint), () => ({
      colour: MAP_COLOURS.sea,
      hatch: 0,
    }));
  }
  if (tint.mode !== "naval") {
    return { colour: MAP_COLOURS.sea, hatch: 0 };
  }
  const hold = seaHoldOf(tint.waters, zone);
  if (hold.level === "empty") {
    return { colour: MAP_COLOURS.sea, hatch: 0 };
  }
  return {
    colour: itemAt(nations, hold.leader, UNOWNED_NATION).colour,
    hatch: SEA_HOLD_HATCH[hold.level],
  };
};

/**
 * The colour one province is painted, given the nation holding it.
 *
 * The painter builds a table of these once per repaint, so the pass over the
 * grid is a lookup per cell rather than a walk through the province and its
 * nation.
 */
const provinceFill = (
  nations: readonly Nation[],
  holder: number,
  highlighted: Option.Option<number>,
  province: Province,
  tint: Tint
): Fill => {
  if (province.kind === "sea") {
    return seaFill(nations, province.id, tint);
  }
  const paint = paintOf(nations, holder, province, tint, highlighted);
  // The comparison is on nation ids rather than through a sentinel, because the
  // id an unowned province carries is itself negative and any sentinel would
  // have to dodge it.
  const lift = LIFT_FOR[`${Option.contains(highlighted, holder)}`];
  return {
    colour: shaded(paint.colour, paint.shade * lift),
    hatch: paint.hatch,
  };
};

/** The colour of a cell inside its province, darkened where a stripe crosses it. */
const striped = (grid: Grid, fill: Fill, cell: number): Colour => {
  if (
    fill.hatch === 0 ||
    (cellX(grid, cell) + cellY(grid, cell)) % fill.hatch !== 0
  ) {
    return fill.colour;
  }
  return shaded(fill.colour, HATCH_SHADE);
};

/** The cells a border check compares against, so each border is drawn once. */
const rightAndBelow = (grid: Grid, cell: number): readonly number[] => {
  const cells: number[] = [];
  if (cellX(grid, cell) + 1 < grid.width) {
    cells.push(cell + 1);
  }
  if (cellY(grid, cell) + 1 < grid.height) {
    cells.push(cell + grid.width);
  }
  return cells;
};

/** Which nation holds the province a cell belongs to, negative at sea. */
const ownerOfCell = (world: World, owners: Int32Array, cell: number): number =>
  valueAt(owners, valueAt(world.cellProvince, cell));

/** The region the province a cell belongs to lies in, where the map draws the regions. */
const regionOfCell = (
  world: World,
  regions: Int32Array,
  cell: number
): number => valueAt(regions, valueAt(world.cellProvince, cell));

/**
 * What one cell is painted: its province's colour, or a border where the
 * province to its right or below it differs, drawn pale where the two lie in
 * different `regions`.
 */
const cellColour = (
  world: World,
  owners: Int32Array,
  fills: readonly Fill[],
  cell: number,
  regions: Int32Array
): Colour => {
  const province = valueAt(world.cellProvince, cell);
  const fill = itemAt(fills, province, UNOWNED_FILL);
  const differing = rightAndBelow(world.grid, cell).filter(
    (neighbour) => valueAt(world.cellProvince, neighbour) !== province
  );
  if (differing.length === 0) {
    return striped(world.grid, fill, cell);
  }
  const region = regionOfCell(world, regions, cell);
  if (
    differing.some(
      (neighbour) => regionOfCell(world, regions, neighbour) !== region
    )
  ) {
    return MAP_COLOURS.airBorder;
  }
  const owner = ownerOfCell(world, owners, cell);
  const crossesNation = differing.some(
    (neighbour) => ownerOfCell(world, owners, neighbour) !== owner
  );
  if (crossesNation) {
    return MAP_COLOURS.nationBorder;
  }
  return MAP_COLOURS.provinceBorder;
};

/** No province of a map that does not draw the regions lies apart from another. */
const NO_REGIONS = new Int32Array(0);

/** The regions the map in `tint` draws the borders of: the strategic regions on the air map, and none otherwise. */
const regionsDrawnUnder = (tint: Tint): Int32Array => {
  if (tint.mode === "air") {
    return tint.regionOf;
  }
  return NO_REGIONS;
};

/**
 * The world as RGBA pixels, one pixel per cell, ready for an `ImageData`.
 *
 * The caller scales it to the screen, so this runs once per world and once per
 * change of which nation is picked out, rather than once per frame.
 */
export const paintWorld = (
  world: World,
  owners: Int32Array,
  highlighted: Option.Option<number>,
  tint: Tint
): Uint8ClampedArray<ArrayBuffer> => {
  const fills = world.provinces.map((province) =>
    provinceFill(
      world.nations,
      valueAt(owners, province.id),
      highlighted,
      province,
      tint
    )
  );
  const regions = regionsDrawnUnder(tint);
  const pixels = new Uint8ClampedArray(world.cellProvince.length * CHANNELS);
  for (const [cell] of world.cellProvince.entries()) {
    const colour = cellColour(world, owners, fills, cell, regions);
    const at = cell * CHANNELS;
    pixels[at] = colour.red;
    pixels[at + 1] = colour.green;
    pixels[at + 2] = colour.blue;
    pixels[at + 3] = OPAQUE;
  }
  return pixels;
};
