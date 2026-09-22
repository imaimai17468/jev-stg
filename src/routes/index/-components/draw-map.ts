import type { World } from "@/shared/entities/world";
import type { NationLabel } from "./nation-labels";
import type { Surface, Viewport } from "./viewport";

/**
 * What the map needs a drawing surface to do.
 *
 * The canvas API is wider than this and harder to stand in for, so the layout
 * decisions below are written against these three calls and a test drives them
 * with a recorder.
 */
export interface MapPen {
  readonly clear: (width: number, height: number) => void;
  /** Draws the painted world, scaled and offset into place. */
  readonly world: (x: number, y: number, width: number, height: number) => void;
  readonly text: (value: string, x: number, y: number) => void;
}

/**
 * The land a nation needs before its name is written on the map.
 *
 * Every nation carrying a name turns a crowded continent into a wall of text,
 * and the ones this hides are the ones whose territory the name would not fit
 * inside anyway.
 */
const LABEL_MIN_CELLS = 900;

/** Draws one frame: the world at the current viewport, then the names over it. */
export const drawMap = (
  pen: MapPen,
  world: World,
  view: Viewport,
  surface: Surface,
  labels: readonly NationLabel[]
): void => {
  pen.clear(surface.width, surface.height);
  pen.world(
    -view.x * view.scale,
    -view.y * view.scale,
    world.grid.width * view.scale,
    world.grid.height * view.scale
  );
  for (const label of labels) {
    if (label.weight < LABEL_MIN_CELLS) {
      continue;
    }
    pen.text(
      label.name,
      (label.x - view.x) * view.scale,
      (label.y - view.y) * view.scale
    );
  }
};
