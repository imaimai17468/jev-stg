import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { nationAt } from "./pick-nation";
import type { Viewport } from "./viewport";
import { FIXTURE_WORLD, HELD_BY_TWO } from "./world-fixture";

/** One screen pixel per cell, looking at the world's top-left corner. */
const VIEW: Viewport = { scale: 1, x: 0, y: 0 };

describe(nationAt, () => {
  it("should name the holder when the point lands on its ground", () => {
    expect(nationAt(FIXTURE_WORLD, HELD_BY_TWO, VIEW, 0.5, 0.5)).toStrictEqual(
      Option.some(0)
    );
  });

  it("should name the other holder when the point lands further along", () => {
    expect(nationAt(FIXTURE_WORLD, HELD_BY_TWO, VIEW, 2.5, 0.5)).toStrictEqual(
      Option.some(1)
    );
  });

  it("should name nobody when the point lands on water", () => {
    expect(nationAt(FIXTURE_WORLD, HELD_BY_TWO, VIEW, 4.5, 0.5)).toStrictEqual(
      Option.none()
    );
  });

  it("should name nobody when the point sits left of the world", () => {
    expect(nationAt(FIXTURE_WORLD, HELD_BY_TWO, VIEW, -1, 0.5)).toStrictEqual(
      Option.none()
    );
  });

  it("should name nobody when the point sits right of the world", () => {
    expect(nationAt(FIXTURE_WORLD, HELD_BY_TWO, VIEW, 99, 0.5)).toStrictEqual(
      Option.none()
    );
  });

  it("should name nobody when the point sits above the world", () => {
    expect(nationAt(FIXTURE_WORLD, HELD_BY_TWO, VIEW, 0.5, -1)).toStrictEqual(
      Option.none()
    );
  });

  it("should name nobody when the point sits below the world", () => {
    expect(nationAt(FIXTURE_WORLD, HELD_BY_TWO, VIEW, 0.5, 99)).toStrictEqual(
      Option.none()
    );
  });
});
