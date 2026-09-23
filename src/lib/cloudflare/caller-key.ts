import "@tanstack/react-start/server-only";
import { getRequest } from "@tanstack/react-start/server";
import { Option } from "effect";

/**
 * What a per-caller ceiling is counted against.
 *
 * These endpoints take no session, so the caller's address is the only thing
 * separating one player from the next, and a request that arrives without one
 * shares a bucket rather than escaping it.
 */
export const callerKey = (): string =>
  Option.getOrElse(
    Option.fromNullishOr(getRequest().headers.get("cf-connecting-ip")),
    () => "unaddressed"
  );
