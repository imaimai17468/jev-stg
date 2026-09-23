import { describe, expect, it } from "vite-plus/test";
import { stripeOffsets } from "./legend-stripes";

describe(stripeOffsets, () => {
  it("should draw no stripe when the level is not striped", () => {
    expect(stripeOffsets(0, 12)).toStrictEqual([]);
  });

  it("should space the diagonals by the hatch across twice the swatch when the level is striped", () => {
    expect(stripeOffsets(4, 12)).toStrictEqual([4, 8, 12, 16, 20, 24]);
  });
});
