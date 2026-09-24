import { describe, expect, it } from "vite-plus/test";
import type { Random } from "../random";
import type { Leaning } from "./leaning";
import { drawnLeaning } from "./leaning";

/** A source whose every integer draw is `index`. */
const always = (index: number): Random => ({
  below: () => index,
  unit: () => 0.5,
});

const DRAWS: readonly (readonly [number, Leaning])[] = [
  [0, "army"],
  [1, "navy"],
  [2, "industry"],
];

describe(drawnLeaning, () => {
  it.each(DRAWS)(
    "should draw the leaning at %i when the source names it",
    (index, leaning) => {
      expect(drawnLeaning(always(index))).toBe(leaning);
    }
  );
});
