import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { Effect } from "effect";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useState } from "react";
import { describe, expect, it, onTestFinished, vi } from "vite-plus/test";
import type {
  Consultation,
  JevReply,
} from "@/shared/entities/world/consultation";
import { standingOf, warDeclared } from "@/shared/entities/world/diplomacy";
import {
  ROW_SIMULATION,
  ROW_WORLD,
} from "@/shared/entities/world/diplomacy-fixture";
import type { Simulation } from "@/shared/entities/world/simulation";
import { UNASSIGNED } from "@/shared/entities/world/spread";
import { DriverFailed } from "@/test/defect";
import type { Consult, Heard } from "./use-jev-council";
import { latestHeard, useJevCouncil } from "./use-jev-council";

/** Nations 0 and 1 at war, so the rules would call up a heavier law. */
const AT_WAR: Simulation = {
  ...ROW_SIMULATION,
  diplomacy: warDeclared(ROW_SIMULATION.diplomacy, 0, 1),
};

/** The same war with nation 1 beaten and waiting for its terms. */
const TALKING: Simulation = {
  ...AT_WAR,
  negotiations: [
    { fallback: { terms: "annex", victor: 0 }, loser: 1, openedOn: 0 },
  ],
  owners: Int32Array.from([0, 0, 1, 3, UNASSIGNED]),
};

/** A consult that answers every consultation with `reply`. */
const answering = (reply: JevReply) =>
  vi.fn<Consult>().mockResolvedValue(reply);

/** What a consultation asked about, the loser's id included for talks. */
const subjectOf = (consultation: Consultation): string => {
  if (consultation._tag === "peace") {
    return `peace:${consultation.loser}`;
  }
  return consultation._tag;
};

/** Gives each render its own query client, as each page load has. */
const withQueries = ({ children }: { readonly children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

/** Runs the hook over its own state, starting from `start`. */
const councilOver = (start: Simulation, consult: Consult) => {
  onTestFinished(cleanup);
  return renderHook(
    () => {
      const [simulation, setSimulation] = useState(start);
      const voice = useJevCouncil(
        ROW_WORLD,
        simulation,
        setSimulation,
        consult
      );
      return { simulation, voice };
    },
    { wrapper: withQueries }
  );
};

describe(useJevCouncil, () => {
  it("should carry out Jev's verdicts on the month when Jev answers", () => {
    const consult = answering({
      _tag: "answered",
      verdicts: [
        {
          choice: "extensive",
          nation: 0,
          probability: 0.9,
          question: "conscription",
          weights: [],
        },
      ],
    });

    const { result } = councilOver(AT_WAR, consult);

    return waitFor(() => {
      expect({
        law: result.current.simulation.economies[0]?.conscription,
        voice: result.current.voice,
      }).toStrictEqual({ law: "extensive", voice: "jev" });
    });
  });

  it("should decide the month by the rules when Jev answers that it cannot", () => {
    const { result } = councilOver(AT_WAR, answering({ _tag: "unavailable" }));

    return waitFor(() => {
      expect({
        law: result.current.simulation.economies[0]?.conscription,
        voice: result.current.voice,
      }).toStrictEqual({ law: "limited", voice: "rules" });
    });
  });

  it("should decide the month by the rules when the consultation throws", () => {
    const consult = vi
      .fn<Consult>()
      .mockRejectedValue(new DriverFailed({ message: "offline" }));

    const { result } = councilOver(AT_WAR, consult);

    return waitFor(() => {
      expect(result.current.voice).toBe("rules");
    });
  });

  it("should report consulting when the month's reply is still out", () => {
    const { result } = councilOver(AT_WAR, () =>
      Effect.runPromise(Effect.never)
    );

    expect(result.current.voice).toBe("consulting");
  });

  it("should ask about each surrender once when a second one opens", () => {
    const consult = answering({ _tag: "answered", verdicts: [] });
    const setSimulation = vi.fn<Dispatch<SetStateAction<Simulation>>>();
    onTestFinished(cleanup);
    const { rerender } = renderHook(
      ({ simulation }) =>
        useJevCouncil(ROW_WORLD, simulation, setSimulation, consult),
      { initialProps: { simulation: TALKING }, wrapper: withQueries }
    );

    rerender({
      simulation: {
        ...TALKING,
        negotiations: [
          ...TALKING.negotiations,
          { fallback: { terms: "annex", victor: 0 }, loser: 3, openedOn: 0 },
        ],
      },
    });

    return waitFor(() => {
      expect(
        consult.mock.calls.map(([asked]) => subjectOf(asked))
      ).toStrictEqual(["council", "peace:1", "peace:3"]);
    });
  });

  it("should sign the terms Jev names when it answers the talks", () => {
    const consult = answering({
      _tag: "answered",
      verdicts: [
        {
          choice: "puppet",
          nation: 1,
          probability: 0.8,
          question: "terms",
          weights: [],
        },
      ],
    });

    const { result } = councilOver(TALKING, consult);

    return waitFor(() => {
      expect(standingOf(result.current.simulation.diplomacy, 1)).toStrictEqual({
        kind: "puppet",
        overlord: 0,
      });
    });
  });
});

describe(latestHeard, () => {
  it("should keep what was heard when a reply for an earlier month lands late", () => {
    const heard: Heard = { councilDay: 31, voice: "jev" };

    expect(latestHeard(heard, 0, { _tag: "unavailable" })).toBe(heard);
  });
});
