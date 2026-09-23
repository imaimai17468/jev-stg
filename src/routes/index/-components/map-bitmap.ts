import { Option } from "effect";
import type { World } from "@/shared/entities/world";
import type { Grid } from "@/shared/entities/world/grid";
import { cellX, cellY, valueAt } from "@/shared/entities/world/grid";
import { itemAt } from "@/shared/entities/world/lookup";
import type { Colour, Nation } from "@/shared/entities/world/nations";
import type { Province } from "@/shared/entities/world/provinces";
import { MAP_COLOURS, TERRAIN_SHADE } from "./map-palette";

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

/**
 * The colour one province is painted, given the nation holding it.
 *
 * The painter builds a table of these once per repaint, so the pass over the
 * grid is a lookup per cell rather than a walk through the province and its
 * nation.
 */
const provinceColour = (
  nations: readonly Nation[],
  holder: number,
  highlighted: Option.Option<number>,
  province: Province
): Colour => {
  if (province.kind === "sea") {
    return MAP_COLOURS.sea;
  }
  // An unowned province carries `UNASSIGNED`, and a negative index has to miss
  // rather than reach the last nation the way `Array.prototype.at` would.
  const owner = itemAt(nations, holder, UNOWNED_NATION);
  // The comparison is on nation ids rather than through a sentinel, because the
  // id an unowned province carries is itself negative and any sentinel would
  // have to dodge it.
  const lift = LIFT_FOR[`${Option.contains(highlighted, holder)}`];
  return shaded(owner.colour, TERRAIN_SHADE[province.terrain] * lift);
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
  colours: readonly Colour[],
  cell: number
): Colour => {
  const province = valueAt(world.cellProvince, cell);
  const fill = itemAt(colours, province, MAP_COLOURS.unowned);
  const differing = rightAndBelow(world.grid, cell).filter(
    (neighbour) => valueAt(world.cellProvince, neighbour) !== province
  );
  if (differing.length === 0) {
    return fill;
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
  highlighted: Option.Option<number>
): Uint8ClampedArray<ArrayBuffer> => {
  const colours = world.provinces.map((province) =>
    provinceColour(
      world.nations,
      valueAt(owners, province.id),
      highlighted,
      province
    )
  );
  const pixels = new Uint8ClampedArray(world.cellProvince.length * CHANNELS);
  for (const [cell] of world.cellProvince.entries()) {
    const colour = cellColour(world, owners, colours, cell);
    const at = cell * CHANNELS;
    pixels[at] = colour.red;
    pixels[at + 1] = colour.green;
    pixels[at + 2] = colour.blue;
    pixels[at + 3] = OPAQUE;
  }
  return pixels;
};
