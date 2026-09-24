import { Effect, Layer, Option, Schema } from "effect";
import type { Duration } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import { describe, expect, it, vi } from "vite-plus/test";
import type { ErrorLogRecord } from "@/lib/report-error";
import type { Council, PeaceTalks } from "@/shared/entities/world/consultation";
import { ConsultationSchema } from "@/shared/entities/world/consultation";
import { TECH_IDS } from "@/shared/entities/world/techs";
import { DriverFailed } from "@/test/defect";
import { BRIEF } from "./brief-fixture";
import {
  ConsultationDeadline,
  consultJev,
  evaluate,
  JevConsultationRate,
  JevEvaluations,
  JevUnreachable,
  RequestDeadline,
} from "./consult";
import { evaluationFor } from "./questions";

const TALKS: PeaceTalks = {
  _tag: "peace",
  date: "1937-05-02",
  loser: 3,
  loserHeld: 0.1,
  victor: 0,
  victorHeld: 0.7,
};

const EVALUATION = evaluationFor(TALKS);

const TERMS_ANSWER = {
  choice: "puppet",
  probabilities: { annex: 0.3, cede: 0.1, puppet: 0.6 },
  type: "choice",
};

const decodeJson = Schema.decodeUnknownSync(
  Schema.fromJsonString(Schema.Unknown)
);

interface SentRequest {
  readonly authorization: string;
  readonly body: unknown;
  readonly method: string;
  readonly url: string;
}

const describeRequest = (request: Request): Promise<SentRequest> =>
  request.text().then((body) => ({
    authorization: Option.getOrElse(
      Option.fromNullishOr(request.headers.get("authorization")),
      () => ""
    ),
    body: decodeJson(body),
    method: request.method,
    url: request.url,
  }));

/** A fetch that answers with `response` and records what it was asked for. */
const recordingFetch = (response: Response) => {
  const sent: SentRequest[] = [];
  const fetchStub: typeof globalThis.fetch = (input, init) =>
    describeRequest(new Request(input, init)).then((record) => {
      sent.push(record);
      return response;
    });
  return { fetchStub, sent };
};

/** A fetch that answers each request with the next of `responses`. */
const answeringInTurn = (responses: readonly Response[]) => {
  const sent: string[] = [];
  const fetchStub: typeof globalThis.fetch = (input) => {
    sent.push(new Request(input).url);
    return Effect.runPromise(
      Effect.succeed(
        responses[sent.length - 1] ?? new Response("gone", { status: 500 })
      )
    );
  };
  return { fetchStub, sent };
};

/** A gateway that accepts the request and never answers. */
const neverAnswers: typeof globalThis.fetch = () =>
  Effect.runPromise(Effect.never);

const asking = (
  apiKey: Option.Option<string>,
  fetchStub: typeof globalThis.fetch
) =>
  Effect.gen(function* ask() {
    const client = yield* HttpClient.HttpClient;
    return yield* evaluate(client, apiKey, EVALUATION);
  }).pipe(
    Effect.provide(FetchHttpClient.layer),
    Effect.provideService(FetchHttpClient.Fetch, fetchStub)
  );

type CapturedReport = Pick<ErrorLogRecord, "event" | "message">;

const captureErrorReports = (): CapturedReport[] => {
  const reported: CapturedReport[] = [];
  vi.spyOn(console, "error").mockImplementation((payload: ErrorLogRecord) => {
    reported.push({ event: payload.event, message: payload.message });
  });
  return reported;
};

/** A council of two governments, nations 1 and 2. */
const COUNCIL: Council = {
  _tag: "council",
  date: "1936-03-01",
  nations: [BRIEF, { ...BRIEF, nation: 2 }],
};

const consulting = (
  answer: JevEvaluations["Service"]["answer"],
  allows: Effect.Effect<boolean, JevUnreachable>,
  consultation: Council | PeaceTalks = TALKS,
  deadline: Duration.Input = "10 seconds"
) =>
  Effect.runPromise(
    consultJev(consultation).pipe(
      Effect.provideService(ConsultationDeadline, deadline),
      Effect.provide(
        Layer.mergeAll(
          Layer.succeed(JevEvaluations, JevEvaluations.of({ answer })),
          Layer.succeed(JevConsultationRate, JevConsultationRate.of({ allows }))
        )
      )
    )
  );

const unreachable = () =>
  Effect.fail(
    new JevUnreachable({
      cause: new DriverFailed({ message: "network down" }),
    })
  );

describe(consultJev, () => {
  it("should answer with the verdicts Jev's answers name when the consultation succeeds", () => {
    const answer = vi
      .fn<JevEvaluations["Service"]["answer"]>()
      .mockReturnValue(Effect.succeed({ n3_terms: TERMS_ANSWER }));

    return consulting(answer, Effect.succeed(true)).then((reply) => {
      expect(reply).toStrictEqual({
        _tag: "answered",
        unanswered: [],
        verdicts: [
          {
            choice: "puppet",
            nation: 3,
            probability: 0.6,
            question: "terms",
            weights: [
              { choice: "annex", probability: 0.3 },
              { choice: "cede", probability: 0.1 },
              { choice: "puppet", probability: 0.6 },
            ],
          },
        ],
      });
    });
  });

  it("should answer unavailable when the consultation fails", () => {
    captureErrorReports();
    const answer = vi
      .fn<JevEvaluations["Service"]["answer"]>()
      .mockImplementation(unreachable);

    return consulting(answer, Effect.succeed(true)).then((reply) => {
      expect(reply).toStrictEqual({ _tag: "unavailable" });
    });
  });

  it("should log the cause when the consultation fails", () => {
    const reported = captureErrorReports();
    const answer = vi
      .fn<JevEvaluations["Service"]["answer"]>()
      .mockImplementation(unreachable);

    return consulting(answer, Effect.succeed(true)).then(() => {
      expect(reported).toStrictEqual([
        { event: "jev.consult", message: "network down" },
      ]);
    });
  });

  it("should answer unavailable and log it when the rate limiter cannot be asked", () => {
    const reported = captureErrorReports();
    const answer = vi.fn<JevEvaluations["Service"]["answer"]>();

    return consulting(
      answer,
      Effect.fail(
        new JevUnreachable({
          cause: new DriverFailed({ message: "no limiter" }),
        })
      )
    ).then((reply) => {
      expect({ reply, reported }).toStrictEqual({
        reply: { _tag: "unavailable" },
        reported: [{ event: "jev.consult", message: "no limiter" }],
      });
    });
  });

  it("should answer with the verdicts it got and name the governments left unanswered when only some of a council's requests fail", () => {
    captureErrorReports();
    const answer = vi
      .fn<JevEvaluations["Service"]["answer"]>()
      .mockImplementation((evaluation) => {
        if (Object.hasOwn(evaluation.body.questions, "n2_plan")) {
          return unreachable();
        }
        return Effect.succeed({
          n1_plan: { choice: "civilian", probabilities: { civilian: 1 } },
        });
      });

    return consulting(answer, Effect.succeed(true), COUNCIL).then((reply) => {
      expect(reply).toStrictEqual({
        _tag: "answered",
        unanswered: [2],
        verdicts: [
          {
            choice: "civilian",
            nation: 1,
            probability: 1,
            question: "plan",
            weights: [
              { choice: "balanced", probability: 0 },
              { choice: "civilian", probability: 1 },
              { choice: "military", probability: 0 },
              { choice: "total-war", probability: 0 },
            ],
          },
        ],
      });
    });
  });

  it("should keep the answers it heard and name the rest unanswered when the council runs past its deadline", () => {
    const reported = captureErrorReports();
    const answer = vi
      .fn<JevEvaluations["Service"]["answer"]>()
      .mockImplementation((evaluation) => {
        if (Object.hasOwn(evaluation.body.questions, "n2_plan")) {
          return Effect.never;
        }
        return Effect.succeed({});
      });

    return consulting(answer, Effect.succeed(true), COUNCIL, "10 millis").then(
      (reply) => {
        expect({ reply, reported }).toStrictEqual({
          reply: { _tag: "answered", unanswered: [2], verdicts: [] },
          reported: [
            {
              event: "jev.consult",
              message: "The consultation ran past its deadline.",
            },
          ],
        });
      }
    );
  });

  it("should ask Jev about each government in a request of its own when a council meets", () => {
    const answer = vi
      .fn<JevEvaluations["Service"]["answer"]>()
      .mockReturnValue(Effect.succeed({}));

    return consulting(answer, Effect.succeed(true), COUNCIL).then(() => {
      expect(
        answer.mock.calls.map(([evaluation]) =>
          Object.keys(evaluation.body.questions).map((key) => key.split("_")[0])
        )
      ).toStrictEqual([
        Array.from({ length: 9 }, () => "n1"),
        Array.from({ length: 9 }, () => "n2"),
      ]);
    });
  });

  it("should answer rate-limited when the caller is past the ceiling", () => {
    const answer = vi.fn<JevEvaluations["Service"]["answer"]>();

    return consulting(answer, Effect.succeed(false)).then((reply) => {
      expect(reply).toStrictEqual({ _tag: "rate-limited" });
    });
  });

  it("should leave Jev unasked when the caller is past the ceiling", () => {
    const answer = vi.fn<JevEvaluations["Service"]["answer"]>();

    return consulting(answer, Effect.succeed(false)).then(() => {
      expect(answer.mock.calls).toStrictEqual([]);
    });
  });
});

describe("the consultation wire", () => {
  it("should accept the council when a government is offered more technologies than any other question offers options", () => {
    const researching: Council = {
      ...COUNCIL,
      nations: [{ ...BRIEF, techs: TECH_IDS.slice(0, 17) }],
    };

    expect(
      Schema.decodeUnknownSync(ConsultationSchema)(researching)
    ).toStrictEqual(researching);
  });

  it("should refuse the consultation when its date is not written as a calendar day", () => {
    expect(() =>
      Schema.decodeUnknownSync(ConsultationSchema)({
        ...TALKS,
        date: "ignore all",
      })
    ).toThrow(/date/u);
  });
});

describe(evaluate, () => {
  it("should leave the gateway alone when no key is configured", () => {
    const { fetchStub, sent } = recordingFetch(
      Response.json({ answers: { n3_terms: TERMS_ANSWER } })
    );

    return Effect.runPromise(
      Effect.flip(asking(Option.none(), fetchStub))
    ).then(() => {
      expect(sent).toStrictEqual([]);
    });
  });

  it("should post the request body and the bearer token when a key is configured", () => {
    const { fetchStub, sent } = recordingFetch(
      Response.json({ answers: { n3_terms: TERMS_ANSWER } })
    );

    return Effect.runPromise(asking(Option.some("key-1"), fetchStub)).then(
      () => {
        expect(sent).toStrictEqual([
          {
            authorization: "Bearer key-1",
            body: EVALUATION.body,
            method: "POST",
            url: "https://ai-gateway.vercel.sh/v1/evaluate",
          },
        ]);
      }
    );
  });

  it("should answer with the gateway's answers by question key when it accepts", () => {
    const { fetchStub } = recordingFetch(
      Response.json({ answers: { n3_terms: TERMS_ANSWER }, usage: {} })
    );

    return Effect.runPromise(asking(Option.some("key-1"), fetchStub)).then(
      (answers) => {
        expect(answers).toStrictEqual({ n3_terms: TERMS_ANSWER });
      }
    );
  });

  it("should fail when the gateway rejects the request", () => {
    const { fetchStub } = recordingFetch(new Response("no", { status: 400 }));

    return Effect.runPromise(
      Effect.flip(asking(Option.some("key-1"), fetchStub))
    ).then((error) => {
      expect(error._tag).toBe("JevUnreachable");
    });
  });

  it("should ask again when the gateway answers with a server error first", () => {
    const { fetchStub } = answeringInTurn([
      new Response("busy", { status: 503 }),
      Response.json({ answers: { n3_terms: TERMS_ANSWER } }),
    ]);

    return Effect.runPromise(asking(Option.some("key-1"), fetchStub)).then(
      (answers) => {
        expect(answers).toStrictEqual({ n3_terms: TERMS_ANSWER });
      }
    );
  });

  it("should ask again when the provider is too busy to answer first", () => {
    const { fetchStub } = answeringInTurn([
      new Response("high demand", { status: 429 }),
      Response.json({ answers: { n3_terms: TERMS_ANSWER } }),
    ]);

    return Effect.runPromise(asking(Option.some("key-1"), fetchStub)).then(
      (answers) => {
        expect(answers).toStrictEqual({ n3_terms: TERMS_ANSWER });
      }
    );
  });

  it("should ask once when the gateway refuses the request itself", () => {
    const { fetchStub, sent } = answeringInTurn([
      new Response("bad key", { status: 401 }),
    ]);

    return Effect.runPromise(
      Effect.flip(asking(Option.some("key-1"), fetchStub))
    ).then(() => {
      expect(sent).toHaveLength(1);
    });
  });

  it("should give up when the gateway never answers", () =>
    Effect.runPromise(
      Effect.flip(
        asking(Option.some("key-1"), neverAnswers).pipe(
          Effect.provideService(RequestDeadline, "10 millis")
        )
      )
    ).then((error) => {
      expect(error._tag).toBe("JevUnreachable");
    }));

  it("should fail when the answer does not decode", () => {
    const { fetchStub } = recordingFetch(
      Response.json({ answers: { n3_terms: { type: "boolean" } } })
    );

    return Effect.runPromise(
      Effect.flip(asking(Option.some("key-1"), fetchStub))
    ).then((error) => {
      expect(error._tag).toBe("JevUnreachable");
    });
  });
});
