import type { World } from "@/shared/entities/world";
import type { Colour } from "@/shared/entities/world/nations";
import type { SupplyState } from "@/shared/entities/world/supply";
import type { CounterMark } from "./counter-mark";
import type { DivisionMark } from "./division-marks";
import type { Edge, FrontMark, Point } from "./front-marks";
import type { NationLabel } from "./nation-labels";
import type { UnitSymbol } from "./unit-symbols";
import type { Surface, Viewport } from "./viewport";

/** A straight line on the screen, in screen pixels. */
export interface Segment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/** What a run of segments is drawn as: the front solid, the fallback line dashed. */
export type LineKind = "front" | "fallback";

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
   * Draws one army counter, centred on the point: the land frame in its
   * nation's colour with the unit symbol inside, and a crate beside it where
   * its divisions are not fully supplied.
   */
  readonly counter: (
    value: string,
    x: number,
    y: number,
    colour: Colour,
    supply: SupplyState,
    symbol: UnitSymbol
  ) => void;
  /**
   * Draws one fleet counter, centred on the point, in the sea frame in its
   * nation's colour, so its shape alone reads apart from an army counter.
   */
  readonly fleet: (value: string, x: number, y: number, colour: Colour) => void;
  /**
   * Draws one air wing counter, centred on the point, in the air frame in its
   * nation's colour, so its shape alone reads apart from an army's and a fleet's.
   */
  readonly wing: (value: string, x: number, y: number, colour: Colour) => void;
  /** Draws a nation's front or fallback line, every segment of it in one stroke. */
  readonly lines: (segments: readonly Segment[], kind: LineKind) => void;
  /** Draws an offensive's arrow along the points, its head on the last of them. */
  readonly arrow: (points: readonly Point[]) => void;
}

/** What the map draws over the painted world. */
export interface MapOverlay {
  readonly labels: readonly NationLabel[];
  readonly marks: readonly DivisionMark[];
  readonly fleets: readonly CounterMark[];
  readonly wings: readonly CounterMark[];
  readonly fronts: readonly FrontMark[];
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
 * How far a line is drawn off the border into its own nation's ground, in
 * screen pixels, so two enemies' fronts lie side by side rather than over
 * each other.
 */
const SIDE_OFFSET = 2;

/**
 * Draws one frame: the painted world at the current viewport, every nation's
 * fallback line, front and offensive arrows over it, the names over those, an
 * army counter on every province that holds one, a fleet counter on
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
  const toScreen = (point: Point): Point => ({
    x: (point.x - view.x) * view.scale,
    y: (point.y - view.y) * view.scale,
  });
  const offsetOf = (edge: Edge): Segment => {
    const from = toScreen({ x: edge.x1, y: edge.y1 });
    const to = toScreen({ x: edge.x2, y: edge.y2 });
    const byX = edge.towardX * SIDE_OFFSET;
    const byY = edge.towardY * SIDE_OFFSET;
    return {
      x1: from.x + byX,
      x2: to.x + byX,
      y1: from.y + byY,
      y2: to.y + byY,
    };
  };
  for (const front of overlay.fronts) {
    pen.lines(front.fallback.map(offsetOf), "fallback");
  }
  for (const front of overlay.fronts) {
    pen.lines(front.front.map(offsetOf), "front");
  }
  for (const front of overlay.fronts) {
    for (const offensive of front.offensives) {
      pen.arrow(offensive.map(toScreen));
    }
  }
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
      mark.supply,
      mark.symbol
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
