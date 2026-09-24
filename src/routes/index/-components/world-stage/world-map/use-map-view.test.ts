import { act, cleanup, renderHook } from "@testing-library/react";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import type { Grid } from "@/shared/entities/world/grid";
import type { Surface } from "../viewport";
import { useMapView } from "./use-map-view";

const GRID: Grid = { height: 400, width: 800 };
const SURFACE: Surface = { height: 400, width: 800 };
const WIDER: Surface = { height: 400, width: 1600 };

/** The hook mounted on a surface, unmounted once the test finishes. */
const mounted = () => {
  onTestFinished(cleanup);
  return renderHook(({ surface }) => useMapView(GRID, surface), {
    initialProps: { surface: SURFACE },
  });
};

describe(useMapView, () => {
  it("should show the whole world when the viewer has not moved the map", () => {
    const { result } = mounted();

    expect(result.current.view).toStrictEqual({ scale: 1, x: 0, y: 0 });
  });

  it("should keep the cell under the pointer in place when zooming at a point", () => {
    const { result } = mounted();

    act(() => {
      result.current.zoomAt(2, 0, 0);
    });

    expect(result.current.view).toStrictEqual({ scale: 2, x: 0, y: 0 });
  });

  it("should fold a pan onto the zoom before it when both arrive before a render", () => {
    const { result } = mounted();

    act(() => {
      result.current.zoomAt(2, 0, 0);
      result.current.panBy(-100, 0);
    });

    expect(result.current.view).toStrictEqual({ scale: 2, x: 50, y: 0 });
  });

  it("should zoom about the surface's centre when steered", () => {
    const { result } = mounted();

    act(() => {
      result.current.steer(0, 0, 2);
    });

    expect(result.current.view).toStrictEqual({ scale: 2, x: 200, y: 100 });
  });

  it("should return to the whole world when fitted after zooming in", () => {
    const { result } = mounted();

    act(() => {
      result.current.zoomAt(2, 0, 0);
    });
    act(() => {
      result.current.fit();
    });

    expect(result.current.view).toStrictEqual({ scale: 1, x: 0, y: 0 });
  });

  it("should refit to the new surface when it resizes before the viewer moves the map", () => {
    const { rerender, result } = mounted();

    rerender({ surface: WIDER });

    expect(result.current.view).toStrictEqual({ scale: 1, x: -400, y: 0 });
  });
});
