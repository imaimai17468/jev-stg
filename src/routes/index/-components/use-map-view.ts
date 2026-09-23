import { Option } from "effect";
import { useState } from "react";
import type { Grid } from "@/shared/entities/world/grid";
import type { Surface, Viewport } from "./viewport";
import { clamped, fitViewport, pannedBy, zoomedAt } from "./viewport";

const FIT = Option.none<Viewport>();

/** Where the viewer has moved the map to, and the moves they can make. */
export interface MapView {
  readonly view: Viewport;
  /** Drags the map by a distance in screen pixels. */
  readonly panBy: (byX: number, byY: number) => void;
  /** Zooms by `factor` keeping the point at `atX`, `atY` under the pointer. */
  readonly zoomAt: (factor: number, atX: number, atY: number) => void;
  /** Pans by a distance, then zooms by `factor` about the surface's centre. */
  readonly steer: (byX: number, byY: number, factor: number) => void;
  /** Drops the viewer's choice, so the whole world is on screen again. */
  readonly fit: () => void;
}

export const useMapView = (grid: Grid, surface: Surface): MapView => {
  const [chosen, setChosen] = useState(FIT);

  const viewOf = (from: Option.Option<Viewport>): Viewport =>
    clamped(
      Option.getOrElse(from, () => fitViewport(grid, surface)),
      grid,
      surface
    );

  /**
   * Folds the previous viewport rather than the one this render holds, because
   * a burst of pointer or wheel events is delivered before React renders the
   * first of them.
   */
  const move = (to: (from: Viewport) => Viewport) => {
    setChosen((from) => Option.some(to(viewOf(from))));
  };

  const panBy = (byX: number, byY: number) => {
    move((from) => pannedBy(from, grid, surface, byX, byY));
  };

  const zoomAt = (factor: number, atX: number, atY: number) => {
    move((from) => zoomedAt(from, grid, surface, factor, atX, atY));
  };

  const steer = (byX: number, byY: number, factor: number) => {
    move((from) =>
      zoomedAt(
        pannedBy(from, grid, surface, byX, byY),
        grid,
        surface,
        factor,
        surface.width / 2,
        surface.height / 2
      )
    );
  };

  const fit = () => {
    setChosen(FIT);
  };

  return { fit, panBy, steer, view: viewOf(chosen), zoomAt };
};
