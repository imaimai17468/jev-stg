/**
 * The security headers the root route puts on every HTML document.
 *
 * The document is where these matter: it is the response a third-party page
 * can frame, and the one a shared cache is most likely to consider storable.
 * The framework sets none of them, and it merges a route's headers over its
 * own `Content-Type`.
 *
 * `Strict-Transport-Security` is deliberately absent: it belongs to every
 * response rather than to the rendered ones, which is the zone's setting and
 * not this record's, and a year-long pin from a dev build would outlive
 * whoever next serves that host over plain http.
 */
export const DOCUMENT_HEADERS = {
  "Cache-Control": "private, no-store",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} satisfies Record<string, string>;
