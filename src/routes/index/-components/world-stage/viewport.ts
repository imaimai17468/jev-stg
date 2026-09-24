import type { Grid } from "@/shared/entities/world/grid";

/** Where the map is looked at from. */
export interface Viewport {
  /** Screen pixels per grid cell. */
  readonly scale: number;
  /** The grid cell sitting at the canvas's top-left corner. */
  readonly x: number;
  readonly y: number;
}

/** The drawing surface's size in CSS pixels. */
export interface Surface {
  readonly width: number;
  readonly height: number;
}

/** Past this a cell is a tile rather than a pixel and the map reads as noise. */
const MAX_SCALE = 16;

/** The scale at which the whole world is on screen at once. */
export const fitScale = (grid: Grid, surface: Surface): number =>
  Math.min(surface.width / grid.width, surface.height / grid.height);

const clampScale = (scale: number, grid: Grid, surface: Surface): number =>
  Math.min(MAX_SCALE, Math.max(fitScale(grid, surface), scale));

/**
 * Where an axis may start, so the world never slides off the far side.
 *
 * Once the world is narrower than the surface the offset stops being a choice:
 * it centres, which is what puts the letterbox on both sides rather than one.
 */
const clampAxis = (
  offset: number,
  worldCells: number,
  visibleCells: number
): number => {
  if (visibleCells >= worldCells) {
    return (worldCells - visibleCells) / 2;
  }
  return Math.min(Math.max(offset, 0), worldCells - visibleCells);
};

/** The nearest viewport to this one that the surface and the world allow. */
export const clamped = (
  viewport: Viewport,
  grid: Grid,
  surface: Surface
): Viewport => {
  const scale = clampScale(viewport.scale, grid, surface);
  return {
    scale,
    x: clampAxis(viewport.x, grid.width, surface.width / scale),
    y: clampAxis(viewport.y, grid.height, surface.height / scale),
  };
};

/** The whole world, centred, which is where a session starts. */
export const fitViewport = (grid: Grid, surface: Surface): Viewport =>
  clamped({ scale: fitScale(grid, surface), x: 0, y: 0 }, grid, surface);

/** The viewport after dragging the map by a distance in screen pixels. */
export const pannedBy = (
  viewport: Viewport,
  grid: Grid,
  surface: Surface,
  byX: number,
  byY: number
): Viewport =>
  clamped(
    {
      scale: viewport.scale,
      x: viewport.x - byX / viewport.scale,
      y: viewport.y - byY / viewport.scale,
    },
    grid,
    surface
  );

/**
 * The viewport after zooming by `factor` about a point on the surface.
 *
 * The cell under the pointer stays under the pointer, which is what makes a
 * wheel zoom feel like it is aimed rather than like the map jumping.
 */
export const zoomedAt = (
  viewport: Viewport,
  grid: Grid,
  surface: Surface,
  factor: number,
  atX: number,
  atY: number
): Viewport => {
  const scale = clampScale(viewport.scale * factor, grid, surface);
  const cellUnderX = viewport.x + atX / viewport.scale;
  const cellUnderY = viewport.y + atY / viewport.scale;
  return clamped(
    { scale, x: cellUnderX - atX / scale, y: cellUnderY - atY / scale },
    grid,
    surface
  );
};
