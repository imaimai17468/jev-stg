import { describe, expect, it } from "vite-plus/test";
import { NO_INTEL } from "./intel";
import type { Random } from "./random";
import { sightingOf } from "./sightings";

/** A source whose every draw sits three quarters of the way up the unit interval. */
const THREE_QUARTERS: Random = {
  below: () => 0,
  unit: () => 0.75,
};

describe(sightingOf, () => {
  it("should see nothing when there is nobody to look at", () => {
    expect(sightingOf("army", [], THREE_QUARTERS)).toStrictEqual({
      estimate: 0,
      margin: 0,
      unseen: 0,
    });
  });

  it("should read each nation off within its margin and count the ones it cannot see when its intel varies", () => {
    expect(
      sightingOf(
        "army",
        [
          { amount: 100, known: { ...NO_INTEL, army: 0.3 } },
          { amount: 50, known: { ...NO_INTEL, army: 0.8 } },
          { amount: 70, known: { ...NO_INTEL, army: 0.01 } },
        ],
        THREE_QUARTERS
      )
    ).toStrictEqual({ estimate: 175, margin: 0.5, unseen: 1 });
  });
});
