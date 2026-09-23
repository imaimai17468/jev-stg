import { describe, expect, it } from "vite-plus/test";
import { LINE_OWNERS } from "./army-fixture";
import { startCompliance } from "./compliance";
import { UNASSIGNED } from "./spread";
import type { Unrest } from "./unrest";
import {
  stirredBy,
  unrestAgainst,
  unrestOneDay,
  unrestStarted,
} from "./unrest";

/** Nation 1's operatives working against nation 0, with whatever a test needs changed. */
const work = (patch: Partial<Unrest>): Unrest => ({
  daysLeft: 10,
  kind: "contacts",
  occupier: 0,
  share: 0.1,
  spy: 1,
  ...patch,
});

const SIDES = { occupier: 0, spy: 1 };

describe(unrestStarted, () => {
  it("should leave contacts at what they give when the spy's agency raises resistance work", () => {
    expect(unrestStarted("contacts", SIDES, 0.25)).toStrictEqual(
      work({ daysLeft: 60 })
    );
  });

  it("should raise strengthening by the spy's agency when the agency raises resistance work", () => {
    expect(unrestStarted("strengthened", SIDES, 0.25)).toStrictEqual(
      work({ daysLeft: 60, kind: "strengthened", share: 0.125 })
    );
  });

  it("should run sabotage for ninety days when it is started", () => {
    expect(unrestStarted("sabotage", SIDES, 0)).toStrictEqual(
      work({ daysLeft: 90, kind: "sabotage", share: 0.5 })
    );
  });
});

describe(unrestOneDay, () => {
  it("should take a day off running work and drop work on its last day when a day passes", () => {
    expect(
      unrestOneDay([work({ daysLeft: 1 }), work({ daysLeft: 5 })])
    ).toStrictEqual([work({ daysLeft: 4 })]);
  });
});

describe(unrestAgainst, () => {
  it("should name only the spy's work against that occupier when others run work too", () => {
    expect(
      unrestAgainst(
        [
          work({ kind: "sabotage" }),
          work({ kind: "strengthened", spy: 2 }),
          work({ kind: "contacts", occupier: 2 }),
        ],
        1,
        0
      )
    ).toStrictEqual(new Set(["sabotage"]));
  });
});

describe(stirredBy, () => {
  it("should reach only the occupied ground where the spy's network counts when the occupier holds home and foreign ground", () => {
    const owners = Int32Array.from([0, 0, 0, 0, UNASSIGNED]);
    const networks = [
      new Float32Array(5),
      Float32Array.from([50, 50, 50, 5, 50]),
    ];

    expect(
      stirredBy(
        [
          work({}),
          work({ kind: "strengthened" }),
          work({ kind: "sabotage", share: 0.75 }),
          work({ kind: "sabotage", share: 0.75 }),
        ],
        networks,
        owners,
        startCompliance(LINE_OWNERS)
      )
    ).toStrictEqual({
      resistance: Float32Array.from([0, 0, 0.2, 0, 0]),
      sabotage: Float32Array.from([0, 0, 1, 0, 0]),
    });
  });
});
