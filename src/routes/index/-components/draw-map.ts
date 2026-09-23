import type { World } from "@/shared/entities/world";
import type { Colour } from "@/shared/entities/world/nations";
import type { SupplyState } from "@/shared/entities/world/supply";
import type { CounterMark } from "./counter-mark";
import type { DivisionMark } from "./division-marks";
import type { NationLabel } from "./nation-labels";
import type { Surface, Viewport } from "./viewport";

/**
 * What the map needs a drawing surface to do.
 *
 * The canvas API is wider than this and harder to stand in for, so the layout
 * decisions below are written against these four calls and a test drives them
 * with a recorder.
 */
export interface MapPen {
  readonly clear: (width: number, height: number) => void;
  /** Draws the painted world, scaled and offset into place. */
  readonly world: (x: number, y: number, width: number, height: number) => void;
  readonly text: (value: string, x: number, y: number) => void;
  /**
   * Draws one army counter, centred on the point, in its nation's colour, with
   * a crate on it where its divisions are not fully supplied.
   */
  readonly counter: (
    value: string,
    x: number,
    y: number,
    colour: Colour,
    supply: SupplyState
  ) => void;
  /**
   * Draws one fleet counter, centred on the point, in its nation's colour,
   * shaped apart from an army counter so the two never read as one.
   */
  readonly fleet: (value: string, x: number, y: number, colour: Colour) => void;
  /**
   * Draws one air wing counter, centred on the point, in its nation's colour,
   * shaped as a plane so it reads apart from an army's and a fleet's.
   */
  readonly wing: (value: string, x: number, y: number, colour: Colour) => void;
}

/** What the map draws over the painted world. */
export interface MapOverlay {
  readonly labels: readonly NationLabel[];
  readonly marks: readonly DivisionMark[];
  readonly fleets: readonly CounterMark[];
  readonly wings: readonly CounterMark[];
}

/**
 * The land a nation needs before its name is written on the map.
 *
 * Every nation carrying a name turns a crowded continent into a wall of text,
 * and the ones this hides are the ones whose territory the name would not fit
 * inside anyway.
 */
const LABEL_MIN_CELLS = 900;

/**
 * Draws one frame: the painted world at the current viewport, the names over
 * it, an army counter on every province that holds one, a fleet counter on
 * every sea zone that holds warships, and a wing counter over every region
 * planes fly a mission over.
 */
export const drawMap = (
  pen: MapPen,
  world: World,
  view: Viewport,
  surface: Surface,
  overlay: MapOverlay
): void => {
  pen.clear(surface.width, surface.height);
  pen.world(
    -view.x * view.scale,
    -view.y * view.scale,
    world.grid.width * view.scale,
    world.grid.height * view.scale
  );
  for (const label of overlay.labels) {
    if (label.weight < LABEL_MIN_CELLS) {
      continue;
    }
    pen.text(
      label.name,
      (label.x - view.x) * view.scale,
      (label.y - view.y) * view.scale
    );
  }
  for (const mark of overlay.marks) {
    pen.counter(
      String(mark.count),
      (mark.x - view.x) * view.scale,
      (mark.y - view.y) * view.scale,
      mark.colour,
      mark.supply
    );
  }
  const placed = (
    marks: readonly CounterMark[],
    draw: MapPen["fleet"]
  ): void => {
    for (const mark of marks) {
      draw(
        String(mark.count),
        (mark.x - view.x) * view.scale,
        (mark.y - view.y) * view.scale,
        mark.colour
      );
    }
  };
  placed(overlay.fleets, pen.fleet);
  placed(overlay.wings, pen.wing);
};
