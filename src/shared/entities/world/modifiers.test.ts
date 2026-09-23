import { describe, expect, it } from "vite-plus/test";
import { NO_MODIFIERS, shareOf, summed } from "./modifiers";

describe(shareOf, () => {
  it("should read the share when the bonus names the modifier", () => {
    expect(shareOf({ attack: 0.1 }, "attack")).toBe(0.1);
  });

  it("should read nothing when the bonus leaves the modifier out", () => {
    expect(shareOf({ attack: 0.1 }, "defence")).toBe(0);
  });
});

describe(summed, () => {
  it("should add every bonus's shares together when several name the same modifier", () => {
    expect(
      summed([{ attack: 0.25 }, { attack: 0.5, research: 0.125 }])
    ).toStrictEqual({ ...NO_MODIFIERS, attack: 0.75, research: 0.125 });
  });

  it("should add the dockyards, extraction and refining shares together when bonuses name them", () => {
    expect(
      summed([
        { dockyards: 0.1, extraction: 0.2 },
        { dockyards: 0.1, refining: 0.3 },
      ])
    ).toStrictEqual({
      ...NO_MODIFIERS,
      dockyards: 0.2,
      extraction: 0.2,
      refining: 0.3,
    });
  });

  it("should come to nothing when there are no bonuses", () => {
    expect(summed([])).toStrictEqual(NO_MODIFIERS);
  });
});
