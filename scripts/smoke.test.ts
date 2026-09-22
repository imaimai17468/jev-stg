// @vitest-environment node

/**
 * Exercise the judgements the smoke run makes about one route's answer.
 * The process and network side lives in smoke.entry.ts and is not reached here.
 */

import { describe, expect, it } from "vite-plus/test";
import {
  EXPECTED_DOCUMENT_HEADERS,
  messageOf,
  missedBy,
  missingFrom,
  missingHeaders,
  readyUrlIn,
  report,
  ROUTES,
  served,
} from "./smoke";
import type { Route, RouteResult } from "./smoke";

const ROUTE: Route = {
  headers: {},
  marker: "世界はまだ生成されていません",
  path: "/",
  status: 200,
};

const answered = (
  overrides: Partial<Extract<RouteResult, { kind: "answered" }>> = {}
): RouteResult => ({
  expectedStatus: 200,
  kind: "answered",
  missing: [],
  path: "/",
  status: 200,
  ...overrides,
});

const unanswered: RouteResult = {
  kind: "unanswered",
  path: "/",
  reason: "timed out",
};

describe("smoke", () => {
  it("should find nothing missing when the body closes the document and holds the marker", () => {
    expect(
      missingFrom("<html>世界はまだ生成されていません</html>", ROUTE)
    ).toStrictEqual([]);
  });

  it("should find the closing tag missing when the body is cut short", () => {
    expect(
      missingFrom("<html>世界はまだ生成されていません", ROUTE)
    ).toStrictEqual(["</html>"]);
  });

  it("should find the marker missing when the route's own content is absent", () => {
    expect(missingFrom("<html>elsewhere</html>", ROUTE)).toStrictEqual([
      "世界はまだ生成されていません",
    ]);
  });

  it("should give the address when a complete ready line is present", () => {
    expect(
      readyUrlIn("[wrangler:info] Ready on http://localhost:53402\n")
    ).toBe("http://localhost:53402");
  });

  it("should give no address when the text holds no ready line", () => {
    expect(readyUrlIn("⎔ Starting local server...\n")).toBeNull();
  });

  it("should give the message when an Error was thrown", () => {
    expect(messageOf(new Error("socket hang up"))).toBe("socket hang up");
  });

  it("should give the string form when a non-Error was thrown", () => {
    expect(messageOf("socket hang up")).toBe("socket hang up");
  });

  it("should count a route as served when it answered with the expected status and a whole body", () => {
    expect(served(answered())).toBeTruthy();
  });

  it("should not count a route as served when it did not answer", () => {
    expect(served(unanswered)).toBeFalsy();
  });

  it("should not count a route as served when the status differs from the expected one", () => {
    expect(served(answered({ status: 500 }))).toBeFalsy();
  });

  it("should not count a route as served when the body lacks what the route must render", () => {
    expect(served(answered({ missing: ["</html>"] }))).toBeFalsy();
  });

  it("should name the reason when the route did not answer", () => {
    expect(report(unanswered)).toBe("/ -> no response (timed out)");
  });

  it("should name the status and the expected one when the body is whole", () => {
    expect(report(answered({ status: 500 }))).toBe("/ -> 500 (expected 200)");
  });

  it("should name every missing part when the body lacks more than one", () => {
    expect(
      report(answered({ missing: ["</html>", "世界はまだ生成されていません"] }))
    ).toBe(
      "/ -> 200 (expected 200, missing </html> and 世界はまだ生成されていません)"
    );
  });

  it("should find nothing missing when the route renders no document", () => {
    const asset: Route = {
      headers: {},
      marker: null,
      path: "/favicon.svg",
      status: 200,
    };

    expect(missingFrom("", asset)).toStrictEqual([]);
  });

  it("should find both the marker and the header when the answer carries neither", () => {
    const route: Route = { ...ROUTE, headers: EXPECTED_DOCUMENT_HEADERS };

    expect(missedBy("<html></html>", new Headers(), route)).toStrictEqual([
      "世界はまだ生成されていません",
      ...Object.entries(EXPECTED_DOCUMENT_HEADERS).map(
        ([name, value]) => `${name}: ${value}`
      ),
    ]);
  });

  it("should find nothing missing when the answer carries every header the route names", () => {
    const route: Route = { ...ROUTE, headers: EXPECTED_DOCUMENT_HEADERS };

    expect(
      missingHeaders(new Headers(EXPECTED_DOCUMENT_HEADERS), route)
    ).toStrictEqual([]);
  });

  it("should name the header when the answer omits one the route requires", () => {
    const route: Route = { ...ROUTE, headers: EXPECTED_DOCUMENT_HEADERS };
    const withoutFrameOptions = new Headers(EXPECTED_DOCUMENT_HEADERS);
    withoutFrameOptions.delete("X-Frame-Options");

    expect(missingHeaders(withoutFrameOptions, route)).toStrictEqual([
      "X-Frame-Options: DENY",
    ]);
  });

  it("should name the header when the answer carries another value for it", () => {
    const route: Route = {
      ...ROUTE,
      headers: { "Cache-Control": "private, no-store" },
    };

    expect(
      missingHeaders(new Headers({ "Cache-Control": "public" }), route)
    ).toStrictEqual(["Cache-Control: private, no-store"]);
  });

  it("should require the document headers when the route is a rendered page", () => {
    expect(
      ROUTES.filter((route) => route.marker !== null).map(
        (route) => route.headers
      )
    ).toStrictEqual([EXPECTED_DOCUMENT_HEADERS]);
  });

  it("should request every page route and the favicon when the smoke run boots the Worker", () => {
    expect(ROUTES.map((route) => route.path)).toStrictEqual([
      "/",
      "/favicon.svg",
    ]);
  });
});
