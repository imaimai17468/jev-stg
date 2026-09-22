import type { World } from "@/shared/entities/world";
import type { Grid } from "@/shared/entities/world/grid";
import { cellX, cellY, valueAt } from "@/shared/entities/world/grid";
import { itemAt } from "@/shared/entities/world/lookup";
import type { Colour, Nation } from "@/shared/entities/world/nations";
import { MAP_COLOURS, TERRAIN_SHADE } from "./map-palette";

/** Stands in for the nation an unowned land province would name. */
const UNOWNED_NATION: Nation = {
  capital: 0,
  colour: MAP_COLOURS.unowned,
  id: -1,
  name: "",
};

const CHANNEL_MAX = 255;
const CHANNELS = 4;
const OPAQUE = 255;

const shaded = (colour: Colour, factor: number): Colour => ({
  blue: Math.min(CHANNEL_MAX, Math.round(colour.blue * factor)),
  green: Math.min(CHANNEL_MAX, Math.round(colour.green * factor)),
  red: Math.min(CHANNEL_MAX, Math.round(colour.red * factor)),
});

/**
 * The colour of every province, by province id.
 *
 * Built once so the pass over the grid below is a table lookup per cell rather
 * than a walk through the province and the nation that holds it.
 */
const provinceColours = (world: World): readonly Colour[] =>
  world.provinces.map((province) => {
    if (province.kind === "sea") {
      return MAP_COLOURS.sea;
    }
    // An unowned province carries `UNASSIGNED`, and a negative index has to miss
    // rather than reach the last nation the way `Array.prototype.at` would.
    const owner = itemAt(
      world.nations,
      valueAt(world.owners, province.id),
      UNOWNED_NATION
    );
    return shaded(owner.colour, TERRAIN_SHADE[province.terrain]);
  });

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
const ownerOfCell = (world: World, cell: number): number =>
  valueAt(world.owners, valueAt(world.cellProvince, cell));

/**
 * What one cell is painted: its province's colour, or a border where the
 * province to its right or below it differs.
 */
const cellColour = (
  world: World,
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
  const owner = ownerOfCell(world, cell);
  const crossesNation = differing.some(
    (neighbour) => ownerOfCell(world, neighbour) !== owner
  );
  if (crossesNation) {
    return MAP_COLOURS.nationBorder;
  }
  return MAP_COLOURS.provinceBorder;
};

/**
 * The world as RGBA pixels, one pixel per cell, ready for an `ImageData`.
 *
 * The caller scales it to the screen, so this runs once per world rather than
 * once per frame.
 */
export const paintWorld = (world: World): Uint8ClampedArray<ArrayBuffer> => {
  const colours = provinceColours(world);
  const pixels = new Uint8ClampedArray(world.cellProvince.length * CHANNELS);
  for (const [cell] of world.cellProvince.entries()) {
    const colour = cellColour(world, colours, cell);
    const at = cell * CHANNELS;
    pixels[at] = colour.red;
    pixels[at + 1] = colour.green;
    pixels[at + 2] = colour.blue;
    pixels[at + 3] = OPAQUE;
  }
  return pixels;
};
