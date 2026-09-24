import { describe, expect, it } from "vite-plus/test";
import type { Grid } from "../grid";
import {
  elevationAt,
  heightAt,
  heightField,
  latitudeAt,
  moistureAt,
  peakOf,
  seaLevelFor,
  terrainAt,
} from "./terrain";

const GRID: Grid = { height: 20, width: 40 };

describe(terrainAt, () => {
  it("should be mountains when the elevation is above the mountain line", () => {
    expect(terrainAt(0.9, 0.5, 0.1)).toBe("mountains");
  });

  it("should be hills when the elevation clears the hill line but not the mountain one", () => {
    expect(terrainAt(0.45, 0.5, 0.1)).toBe("hills");
  });

  it("should be tundra when the lowland sits near a pole", () => {
    expect(terrainAt(0.2, 0.5, 0.9)).toBe("tundra");
  });

  it("should be desert when the lowland is dry", () => {
    expect(terrainAt(0.2, 0.2, 0.1)).toBe("desert");
  });

  it("should be forest when the lowland is wet", () => {
    expect(terrainAt(0.2, 0.7, 0.1)).toBe("forest");
  });

  it("should be plains when the lowland is neither dry nor wet", () => {
    expect(terrainAt(0.2, 0.45, 0.1)).toBe("plains");
  });
});

describe(heightAt, () => {
  it("should answer the same height when the cell and the seed are the same", () => {
    expect(heightAt(GRID, 123, 7)).toBe(heightAt(GRID, 123, 7));
  });

  it("should answer a different height when the seed differs", () => {
    expect(heightAt(GRID, 123, 7)).not.toBe(heightAt(GRID, 123, 8));
  });

  it("should answer nothing when the cell sits on the rim the falloff takes to zero", () => {
    expect(heightAt(GRID, 0, 7)).toBe(0);
  });
});

describe(moistureAt, () => {
  it("should stay inside the unit interval when sampled across the grid", () => {
    const sampled = Array.from({ length: 100 }, (_, cell) =>
      moistureAt(GRID, cell * 7, 3)
    );

    expect(sampled.every((value) => value > 0 && value < 1)).toBeTruthy();
  });
});

describe(latitudeAt, () => {
  it("should be zero on the middle row and one at the top when read at both", () => {
    expect({
      middle: latitudeAt(GRID, GRID.width * 10),
      top: latitudeAt(GRID, 0),
    }).toStrictEqual({ middle: 0, top: 1 });
  });
});

describe(heightField, () => {
  it("should hold one height per cell when the grid is sampled", () => {
    expect(heightField(GRID, 5)).toHaveLength(800);
  });
});

describe(peakOf, () => {
  it("should answer the highest value when the field holds several", () => {
    expect(peakOf(Float32Array.from([0.1, 0.9, 0.4]))).toBeCloseTo(0.9, 5);
  });
});

describe(elevationAt, () => {
  it("should be half way up when the height sits between sea level and the peak", () => {
    expect(elevationAt(0.5, 0.2, 0.8)).toBeCloseTo(0.5, 5);
  });

  it("should be nothing when the height is below sea level", () => {
    expect(elevationAt(0.1, 0.2, 0.8)).toBe(0);
  });

  it("should be nothing when the peak and sea level meet", () => {
    expect(elevationAt(0.2, 0.2, 0.2)).toBe(0);
  });

  it("should be whole when the height is the peak", () => {
    expect(elevationAt(0.8, 0.2, 0.8)).toBe(1);
  });
});

describe(seaLevelFor, () => {
  it("should leave the asked-for share above it when the field is uniform", () => {
    const heights = Float32Array.from({ length: 100 }, (_, step) => step / 100);

    expect(seaLevelFor(heights, 0.25)).toBeCloseTo(0.75, 5);
  });
});
