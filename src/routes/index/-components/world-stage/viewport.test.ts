import { describe, expect, it } from "vite-plus/test";
import type { Grid } from "@/shared/entities/world/grid";
import type { Surface } from "./viewport";
import { clamped, fitScale, fitViewport, pannedBy, zoomedAt } from "./viewport";

const GRID: Grid = { height: 400, width: 800 };
const SURFACE: Surface = { height: 400, width: 1600 };

describe(fitScale, () => {
  it("should take the tighter of the two sides when the surface is wider than the world", () => {
    expect(fitScale(GRID, SURFACE)).toBe(1);
  });
});

describe(fitViewport, () => {
  it("should centre the world on the axis it does not fill when it is fitted", () => {
    expect(fitViewport(GRID, SURFACE)).toStrictEqual({
      scale: 1,
      x: -400,
      y: 0,
    });
  });
});

describe(clamped, () => {
  it("should raise a scale below the fit when the viewport asks to zoom out further", () => {
    expect(clamped({ scale: 0.1, x: 0, y: 0 }, GRID, SURFACE).scale).toBe(1);
  });

  it("should cap the scale when the viewport asks to zoom past the ceiling", () => {
    expect(clamped({ scale: 99, x: 0, y: 0 }, GRID, SURFACE).scale).toBe(16);
  });

  it("should hold the offset inside the world when the surface shows part of it", () => {
    expect(clamped({ scale: 4, x: 9999, y: 0 }, GRID, SURFACE).x).toBe(400);
  });

  it("should keep an offset the world allows when the surface shows part of it", () => {
    expect(clamped({ scale: 4, x: 100, y: 0 }, GRID, SURFACE).x).toBe(100);
  });
});

describe(pannedBy, () => {
  it("should move the viewport against the drag when the world has room", () => {
    expect(
      pannedBy({ scale: 4, x: 100, y: 50 }, GRID, SURFACE, -40, -20)
    ).toStrictEqual({
      scale: 4,
      x: 110,
      y: 55,
    });
  });
});

describe(zoomedAt, () => {
  it("should keep the cell under the pointer when the viewport zooms in", () => {
    const before = { scale: 4, x: 100, y: 50 };
    const after = zoomedAt(before, GRID, SURFACE, 2, 200, 100);

    expect(before.x + 200 / before.scale).toBe(after.x + 200 / after.scale);
  });
});
