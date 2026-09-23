import { Option } from "effect";
import type { World } from "@/shared/entities/world";
import { occupancyOf } from "@/shared/entities/world/compliance";
import type { Grid } from "@/shared/entities/world/grid";
import { cellX, cellY, valueAt } from "@/shared/entities/world/grid";
import { itemAt } from "@/shared/entities/world/lookup";
import type { Colour, Nation } from "@/shared/entities/world/nations";
import type { LandProvince, Province } from "@/shared/entities/world/provinces";
import { UNASSIGNED } from "@/shared/entities/world/spread";
import { complianceLevelOf } from "./compliance-level";
import type { Tint } from "./map-mode";
import {
  COMPLIANCE_COLOURS,
  COMPLIANCE_HATCH,
  HATCH_SHADE,
  MAP_COLOURS,
  SUPPLY_COLOURS,
  SUPPLY_HATCH,
  TERRAIN_SHADE,
} from "./map-palette";
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

/**
 * The paint a land province takes under `tint`: its holder's colour shaded by
 * its terrain on the political map, and its supply level's colour, flat, on
 * the supply map.
 */
const paintOf = (
  nations: readonly Nation[],
  holder: number,
  province: LandProvince,
  tint: Tint
): Paint => {
  if (tint.mode === "supply") {
    const level = supplyLevelOf(tint.network, holder, province.id);
    return {
      colour: SUPPLY_COLOURS[level],
      hatch: SUPPLY_HATCH[level],
      shade: 1,
    };
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
    shade: TERRAIN_SHADE[province.terrain],
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
    return { colour: MAP_COLOURS.sea, hatch: 0 };
  }
  const paint = paintOf(nations, holder, province, tint);
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

/**
 * What one cell is painted: its province's colour, or a border where the
 * province to its right or below it differs.
 */
const cellColour = (
  world: World,
  owners: Int32Array,
  fills: readonly Fill[],
  cell: number
): Colour => {
  const province = valueAt(world.cellProvince, cell);
  const fill = itemAt(fills, province, UNOWNED_FILL);
  const differing = rightAndBelow(world.grid, cell).filter(
    (neighbour) => valueAt(world.cellProvince, neighbour) !== province
  );
  if (differing.length === 0) {
    return striped(world.grid, fill, cell);
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
  const pixels = new Uint8ClampedArray(world.cellProvince.length * CHANNELS);
  for (const [cell] of world.cellProvince.entries()) {
    const colour = cellColour(world, owners, fills, cell);
    const at = cell * CHANNELS;
    pixels[at] = colour.red;
    pixels[at + 1] = colour.green;
    pixels[at + 2] = colour.blue;
    pixels[at + 3] = OPAQUE;
  }
  return pixels;
};
