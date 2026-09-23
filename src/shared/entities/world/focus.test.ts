import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { NO_ECONOMY } from "./economy";
import type { FocusId, Focuses } from "./focus";
import {
  availableFocuses,
  FOCUS_DAYS,
  FocusIdSchema,
  focusBonuses,
  focusedOneDay,
  focusOf,
  focusStandingsOf,
  focusStarted,
  grantedBy,
  researchSlotsOf,
  START_FOCUSES,
} from "./focus";
import type { TreeStanding } from "./tree-standing";

/** A government that finished its political effort and pursues militarism. */
const MILITARIST: Focuses = {
  current: Option.some({ focus: "militarism", progress: 10 }),
  done: ["political-effort"],
};

describe(focusStandingsOf, () => {
  it.each<{ focus: FocusId; standing: TreeStanding }>([
    { focus: "political-effort", standing: "done" },
    { focus: "militarism", standing: "underway" },
    { focus: "neutrality", standing: "excluded" },
    { focus: "national-unity", standing: "open" },
    { focus: "war-propaganda", standing: "locked" },
  ])(
    "should place $focus as $standing when the political effort is finished and militarism pursued",
    ({ focus, standing }) => {
      expect(focusStandingsOf(MILITARIST)(focus)).toBe(standing);
    }
  );
});

describe(availableFocuses, () => {
  it("should offer every focus with no prerequisite when none is finished", () => {
    expect(availableFocuses(START_FOCUSES)).toStrictEqual([
      "industrialisation",
      "research-bureau",
      "army-effort",
      "political-effort",
    ]);
  });

  it("should offer nothing when a focus is being pursued", () => {
    expect(
      availableFocuses(focusStarted(START_FOCUSES, "industrialisation"))
    ).toStrictEqual([]);
  });

  it("should offer a focus whose prerequisites are all finished when they are", () => {
    const focuses: Focuses = {
      current: Option.none(),
      done: ["industrialisation", "construction-effort", "production-effort"],
    };

    expect(availableFocuses(focuses)).toContain("total-mobilisation");
  });

  it("should hold a focus back when only some of its prerequisites are finished", () => {
    const focuses: Focuses = {
      current: Option.none(),
      done: ["industrialisation", "construction-effort"],
    };

    expect(availableFocuses(focuses)).not.toContain("total-mobilisation");
  });

  it("should leave out the other of an exclusive pair when one of them is finished", () => {
    const focuses: Focuses = {
      current: Option.none(),
      done: ["political-effort", "neutrality"],
    };

    expect(availableFocuses(focuses)).not.toContain("militarism");
  });
});

describe(focusOf, () => {
  it("should name only focuses of the tree when any focus lists a prerequisite or an exclusion", () => {
    const known = new Set<string>(FocusIdSchema.literals);

    expect(
      FocusIdSchema.literals
        .flatMap((focus) => [
          ...focusOf(focus).requires,
          ...focusOf(focus).excludes,
        ])
        .filter((named) => !known.has(named))
    ).toStrictEqual([]);
  });
});

describe(focusedOneDay, () => {
  it("should change nothing when no focus is being pursued", () => {
    expect(focusedOneDay(START_FOCUSES)).toStrictEqual({
      finished: Option.none(),
      focuses: START_FOCUSES,
    });
  });

  it("should put a day into the focus when it is not finished yet", () => {
    expect(
      focusedOneDay(focusStarted(START_FOCUSES, "army-effort"))
    ).toStrictEqual({
      finished: Option.none(),
      focuses: {
        current: Option.some({ focus: "army-effort", progress: 1 }),
        done: [],
      },
    });
  });

  it("should finish the focus when its last day passes", () => {
    const focuses: Focuses = {
      current: Option.some({ focus: "army-effort", progress: FOCUS_DAYS - 1 }),
      done: [],
    };

    expect(focusedOneDay(focuses)).toStrictEqual({
      finished: Option.some("army-effort"),
      focuses: { current: Option.none(), done: ["army-effort"] },
    });
  });
});

describe(grantedBy, () => {
  it("should add the factories a focus hands over when it finishes", () => {
    expect(grantedBy(NO_ECONOMY, "total-mobilisation")).toStrictEqual({
      ...NO_ECONOMY,
      civilianFactories: 2,
      militaryFactories: 2,
    });
  });
});

describe(researchSlotsOf, () => {
  it("should add a slot for each finished focus that grants one when some are finished", () => {
    const focuses: Focuses = {
      current: Option.none(),
      done: ["research-bureau", "technical-schools", "secret-projects"],
    };

    expect(researchSlotsOf(focuses)).toBe(5);
  });
});

describe(focusBonuses, () => {
  it("should list what each finished focus adds when some are finished", () => {
    const focuses: Focuses = {
      current: Option.none(),
      done: ["army-effort", "industrialisation"],
    };

    expect(focusBonuses(focuses)).toStrictEqual([{ organisation: 0.05 }, {}]);
  });
});
