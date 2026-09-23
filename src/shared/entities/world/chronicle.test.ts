import { describe, expect, it } from "vite-plus/test";
import type { Decision, Entry } from "./chronicle";
import { BY_RULES, chronicled } from "./chronicle";

const DECLARATION: Decision = { kind: "declare", nation: 0, target: 1 };

const RESEARCH: Decision = {
  kind: "research",
  nation: 0,
  tech: "basic-machine-tools",
};

const FOCUS: Decision = { focus: "army-effort", kind: "focus", nation: 0 };

const AGENCY: Decision = { kind: "agency", nation: 0, project: "found" };

const STANCE: Decision = { kind: "stance", nation: 0, stance: "offensive" };

/** The numbers of the 60 entries a full strand keeps once a 61st arrives. */
const KEPT_SEQS = Array.from({ length: 60 }, (_, place) => 61 - place);

/** `count` entries of `decision`, the newest first, numbered down from `count`. */
const entriesOf = (decision: Decision, count: number): readonly Entry[] =>
  Array.from({ length: count }, (_, place) => ({
    day: 0,
    ruling: { decision, source: BY_RULES },
    seq: count - place,
  }));

describe(chronicled, () => {
  it("should number the first entry zero when the chronicle is empty", () => {
    expect(
      chronicled([], {
        day: 3,
        ruling: { decision: DECLARATION, source: BY_RULES },
      })
    ).toStrictEqual([
      { day: 3, ruling: { decision: DECLARATION, source: BY_RULES }, seq: 0 },
    ]);
  });

  it.each<{ condition: string; crowd: Decision; next: Decision }>([
    {
      condition: "research and focus entries fill their own cap",
      crowd: RESEARCH,
      next: FOCUS,
    },
    {
      condition: "stance changes fill their own cap",
      crowd: STANCE,
      next: STANCE,
    },
    {
      condition: "agency entries fill their own cap",
      crowd: AGENCY,
      next: AGENCY,
    },
  ])("should keep a declaration when $condition", ({ crowd, next }) => {
    const crowded = [...entriesOf(crowd, 59), ...entriesOf(DECLARATION, 1)].map(
      (entry, place) => ({ ...entry, seq: 100 - place })
    );

    const after = chronicled(crowded, {
      day: 1,
      ruling: { decision: next, source: BY_RULES },
    });

    expect(
      after.filter((entry) => entry.ruling.decision.kind === "declare")
    ).toHaveLength(1);
  });

  it("should drop the oldest research entry when its strand passes the cap", () => {
    const full = entriesOf(RESEARCH, 60);

    const after = chronicled(full, {
      day: 1,
      ruling: { decision: RESEARCH, source: BY_RULES },
    });

    expect(after.map((entry) => entry.seq)).toStrictEqual(KEPT_SEQS);
  });

  it.each<{ decision: Decision }>([
    { decision: { aircraft: "fighter", kind: "aircraft", nation: 0 } },
    { decision: { aviation: "heavy", kind: "aviation", nation: 0 } },
  ])(
    "should drop the oldest stance change when a $decision.kind decision passes the policy strand's cap",
    ({ decision }) => {
      const full = entriesOf(STANCE, 60);

      const after = chronicled(full, {
        day: 1,
        ruling: { decision, source: BY_RULES },
      });

      expect(after.map((entry) => entry.seq)).toStrictEqual(KEPT_SEQS);
    }
  );

  it.each<{ decision: Decision }>([
    { decision: { kind: "espionage", nation: 0, target: 1 } },
    {
      decision: {
        captured: 1,
        kind: "operation",
        nation: 0,
        operation: "infiltrate-army",
        target: 1,
      },
    },
    { decision: { kind: "captured", nation: 1, spy: 0 } },
    { decision: { kind: "cipher", nation: 0, target: 1 } },
  ])(
    "should drop the oldest agency entry when a $decision.kind entry passes the intelligence strand's cap",
    ({ decision }) => {
      const full = entriesOf(AGENCY, 60);

      const after = chronicled(full, {
        day: 1,
        ruling: { decision, source: BY_RULES },
      });

      expect(after.map((entry) => entry.seq)).toStrictEqual(KEPT_SEQS);
    }
  );

  it("should drop the oldest declaration when its strand passes the cap", () => {
    const full = entriesOf(DECLARATION, 60);

    const after = chronicled(full, {
      day: 1,
      ruling: { decision: DECLARATION, source: BY_RULES },
    });

    expect(after.map((entry) => entry.seq)).toStrictEqual(KEPT_SEQS);
  });
});
