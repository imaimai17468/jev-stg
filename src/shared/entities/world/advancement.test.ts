import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { Advancement } from "./advancement";
import {
  progressedOneDay,
  freeSlotsOf,
  modifiersOf,
  START_ADVANCEMENT,
} from "./advancement";
import { NO_ECONOMY } from "./economy";
import { FOCUS_DAYS } from "./focus";
import { NO_MODIFIERS } from "./modifiers";

/** Two technologies researched, one of them on research speed, and a focus a day from done. */
const ADVANCED: Advancement = {
  focuses: {
    current: Option.some({
      focus: "industrialisation",
      progress: FOCUS_DAYS - 1,
    }),
    done: ["army-effort"],
  },
  research: {
    researched: ["electronics-1", "tools-1"],
    studies: [{ progress: 0, tech: "artillery-1" }],
  },
};

describe(modifiersOf, () => {
  it("should add the technologies' and the focuses' bonuses together when both are finished", () => {
    expect(modifiersOf(ADVANCED)).toStrictEqual({
      ...NO_MODIFIERS,
      organisation: 0.05,
      production: 0.1,
      research: 0.03,
    });
  });
});

describe(freeSlotsOf, () => {
  it("should count the slots nothing is on when some are busy", () => {
    expect(freeSlotsOf(ADVANCED)).toBe(2);
  });
});

describe(progressedOneDay, () => {
  it("should research at the day's speed and hand over what a finished focus grants when the day passes", () => {
    expect(progressedOneDay(ADVANCED, NO_ECONOMY, 1936)).toStrictEqual({
      advancement: {
        focuses: {
          current: Option.none(),
          done: ["army-effort", "industrialisation"],
        },
        research: {
          researched: ["electronics-1", "tools-1"],
          studies: [{ progress: 1.03, tech: "artillery-1" }],
        },
      },
      economy: { ...NO_ECONOMY, civilianFactories: 3 },
    });
  });

  it("should leave the economy alone when no focus finishes", () => {
    expect(
      progressedOneDay(START_ADVANCEMENT, NO_ECONOMY, 1936).economy
    ).toStrictEqual(NO_ECONOMY);
  });
});
