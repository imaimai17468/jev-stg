import "@tanstack/react-start/server-only";
import { Context, Effect, Layer, Option, Schedule, Schema } from "effect";
import type { Duration } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import type {
  HttpClientError,
  HttpClientResponse as HttpClientResponseType,
} from "effect/unstable/http";
import { callerKey } from "@/lib/cloudflare/caller-key";
import { getCloudflareEnv } from "@/lib/cloudflare/env";
import { reportError } from "@/lib/report-error";
import type {
  Consultation,
  JevReply,
} from "@/shared/entities/world/consultation";
import { makeRunHandler } from "../runtime";
import type { ChoiceAnswer, Evaluation } from "./questions";
import { evaluationFor, verdictsFrom } from "./questions";

const EVALUATE_URL = "https://ai-gateway.vercel.sh/v1/evaluate";

/**
 * How long a consultation may run. A month of game time passes in 2.5 seconds
 * at the fastest speed, and a reply later than a few months is of little use,
 * so this stays short. A reference so a test can wait for none.
 */
export const ConsultationDeadline = Context.Reference<Duration.Input>(
  "app/gateways/jev/ConsultationDeadline",
  { defaultValue: () => "10 seconds" }
);

/** The consultation did not produce an answer, whatever stopped it. */
export class JevUnreachable extends Schema.TaggedError<JevUnreachable>()(
  "JevUnreachable",
  { cause: Schema.Defect() }
) {}

class ApiKeyMissing extends Schema.TaggedError<ApiKeyMissing>()(
  "ApiKeyMissing",
  { message: Schema.String }
) {}

/**
 * The gateway answered but refused the request. It carries the body because the
 * status alone does not say whether the key, the account or the model was the
 * problem, and Workers Logs is where that has to be readable.
 */
class GatewayRefused extends Schema.TaggedError<GatewayRefused>()(
  "GatewayRefused",
  { message: Schema.String, status: Schema.Number }
) {}

/** The first status that means the gateway's side failed rather than the request. */
const SERVER_ERROR = 500;

/**
 * Whether a failure is the gateway's own and worth asking again. Jev answers
 * 503 on a share of requests that succeed when repeated a moment later, while
 * a refused key or a malformed body fails the same way every time.
 */
const worthRetrying = (
  error: GatewayRefused | HttpClientError.HttpClientError
): boolean => error._tag === "GatewayRefused" && error.status >= SERVER_ERROR;

/**
 * The `choice` answers `/v1/evaluate` returns. The gateway's envelope also
 * carries usage and routing metadata this app does not read, and a `Struct`
 * takes the fields it names.
 */
const EvaluationSchema = Schema.Struct({
  answers: Schema.Record(
    Schema.String,
    Schema.Struct({
      choice: Schema.String,
      probabilities: Schema.Record(Schema.String, Schema.Finite),
      type: Schema.Literal("choice"),
    })
  ),
});

const acceptedOrRefused = (
  response: HttpClientResponseType.HttpClientResponse
) => {
  if (response.status < 400) {
    return Effect.succeed(response);
  }
  return response.text.pipe(
    Effect.flatMap((body) =>
      Effect.fail(
        new GatewayRefused({
          message: `AI Gateway answered ${response.status}: ${body}`,
          status: response.status,
        })
      )
    )
  );
};

/**
 * Posts `evaluation` to the AI Gateway and returns the answers by question key.
 *
 * The client and the key arrive as arguments rather than being read here, so a
 * test drives the configured and the unconfigured arm without a Worker binding.
 */
export const evaluate = Effect.fn("evaluate")(function* evaluate(
  client: HttpClient.HttpClient,
  apiKey: Option.Option<string>,
  evaluation: Evaluation
): Effect.fn.Return<Readonly<Record<string, ChoiceAnswer>>, JevUnreachable> {
  const key = yield* Option.match(apiKey, {
    onNone: () =>
      Effect.fail(
        new JevUnreachable({
          cause: new ApiKeyMissing({
            message:
              "AI_GATEWAY_API_KEY is not set. Register it with `wrangler secret put AI_GATEWAY_API_KEY` for a deployed Worker, or set it in the local env file for development.",
          }),
        })
      ),
    onSome: (value) => Effect.succeed(value),
  });

  const deadline = yield* ConsultationDeadline;
  const reply = yield* HttpClientRequest.post(EVALUATE_URL).pipe(
    HttpClientRequest.setHeader("Authorization", `Bearer ${key}`),
    HttpClientRequest.bodyJsonUnsafe(evaluation.body),
    client.execute,
    Effect.flatMap(acceptedOrRefused),
    Effect.retry({
      schedule: Schedule.spaced("500 millis"),
      times: 2,
      while: worthRetrying,
    }),
    Effect.flatMap(HttpClientResponse.schemaBodyJson(EvaluationSchema)),
    // A gateway that accepts the connection and never answers would otherwise
    // hold the Worker subrequest until the platform tears it down, and the
    // browser would wait with it instead of deciding the month by the rules.
    Effect.timeout(deadline),
    Effect.mapError((cause) => new JevUnreachable({ cause }))
  );

  return reply.answers;
});

/**
 * Jev's answers to one request.
 *
 * A service rather than a direct call so a test substitutes the reply and the
 * mapping below stays the only thing under test.
 */
export class JevEvaluations extends Context.Service<
  JevEvaluations,
  {
    readonly answer: (
      evaluation: Evaluation
    ) => Effect.Effect<Readonly<Record<string, ChoiceAnswer>>, JevUnreachable>;
  }
>()("app/gateways/jev/JevEvaluations") {
  static readonly layer = Layer.effect(
    JevEvaluations,
    Effect.gen(function* buildJevEvaluations() {
      const client = yield* HttpClient.HttpClient;
      return JevEvaluations.of({
        answer: (evaluation) =>
          evaluate(
            client,
            Option.fromNullishOr(getCloudflareEnv().AI_GATEWAY_API_KEY),
            evaluation
          ),
      });
    })
  ).pipe(Layer.provide(FetchHttpClient.layer));
}

/**
 * Whether this caller may spend another consultation. A limiter that cannot
 * be asked fails the consultation like any other failure, so it is logged.
 *
 * A service so a test drives the refused arm without a Worker binding.
 */
export class JevConsultationRate extends Context.Service<
  JevConsultationRate,
  { readonly allows: Effect.Effect<boolean, JevUnreachable> }
>()("app/gateways/jev/JevConsultationRate") {
  static readonly layer = Layer.succeed(
    JevConsultationRate,
    JevConsultationRate.of({
      allows: Effect.tryPromise({
        catch: (cause) => new JevUnreachable({ cause }),
        try: () =>
          getCloudflareEnv()
            .JEV_RATE_LIMITER.limit({ key: callerKey() })
            .then((outcome) => outcome.success),
      }),
    })
  );
}

const UNAVAILABLE: JevReply = { _tag: "unavailable" };

const RATE_LIMITED: JevReply = { _tag: "rate-limited" };

/**
 * Jev's verdicts on `consultation`, or why there are none.
 *
 * A caller past its ceiling is answered without the gateway being asked, and
 * a consultation that fails for any reason is logged and answered as
 * unavailable, so the browser decides that month by the rules either way.
 */
export const consultJev = (
  consultation: Consultation
): Effect.Effect<JevReply, never, JevEvaluations | JevConsultationRate> =>
  Effect.gen(function* consult() {
    const rate = yield* JevConsultationRate;
    const allowed = yield* rate.allows;
    if (!allowed) {
      return RATE_LIMITED;
    }
    const jev = yield* JevEvaluations;
    const evaluation = evaluationFor(consultation);
    const answers = yield* jev.answer(evaluation);
    const reply: JevReply = {
      _tag: "answered",
      verdicts: verdictsFrom(evaluation.asked, answers),
    };
    return reply;
  }).pipe(
    Effect.catchTags({
      JevUnreachable: (error) =>
        reportError("jev.consult", error.cause).pipe(Effect.as(UNAVAILABLE)),
    })
  );

const runJevHandler = makeRunHandler(
  Layer.mergeAll(JevEvaluations.layer, JevConsultationRate.layer)
);

export const getJevReply = (consultation: Consultation): Promise<JevReply> =>
  runJevHandler(consultJev(consultation));
