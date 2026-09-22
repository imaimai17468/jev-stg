import { describe, expect, it } from "vite-plus/test";
import { fractalNoise, valueNoise } from "./noise";

describe(valueNoise, () => {
  it("should answer the same value when the point and the seed are the same", () => {
    expect(valueNoise(3.25, 8.5, 99)).toBe(valueNoise(3.25, 8.5, 99));
  });

  it("should answer a different value when the seed differs", () => {
    expect(valueNoise(3.25, 8.5, 99)).not.toBe(valueNoise(3.25, 8.5, 100));
  });

  it("should answer a different value when the seeds are far apart", () => {
    expect(valueNoise(3.25, 8.5, 4242)).not.toBe(
      valueNoise(3.25, 8.5, 104_242)
    );
  });

  it("should stay inside the unit interval when swept across many points", () => {
    const sampled = Array.from({ length: 400 }, (_, step) =>
      valueNoise(step * 0.37, step * 0.11, 5)
    );

    expect(sampled.every((value) => value >= 0 && value < 1)).toBeTruthy();
  });
});

describe(fractalNoise, () => {
  it("should equal plain value noise when it sums a single octave", () => {
    expect(fractalNoise(2.5, 1.5, 3, 1)).toBe(valueNoise(2.5, 1.5, 3));
  });

  it("should stay inside the unit interval when swept across many points", () => {
    const sampled = Array.from({ length: 200 }, (_, step) =>
      fractalNoise(step * 0.19, step * 0.23, 8, 4)
    );

    expect(sampled.every((value) => value >= 0 && value < 1)).toBeTruthy();
  });

  it("should answer a different value when an octave is added", () => {
    expect(fractalNoise(2.5, 1.5, 3, 2)).not.toBe(fractalNoise(2.5, 1.5, 3, 1));
  });
});
