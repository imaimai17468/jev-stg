/** What the URL says about which world to draw. */
export interface WorldSearch {
  readonly seed?: number;
}

/**
 * The seed a world falls back to.
 *
 * A world has to be reproducible from its address, and `effect/noGlobals` keeps
 * the clock and the random source out of `src/`, so the seed arrives in the URL
 * rather than being drawn on load. This is the one an address without a seed
 * lands on, and leaving it off the search keeps that address `/`.
 */
export const DEFAULT_SEED = 120;

/**
 * The seed a URL's search carries, where it carries a usable one.
 *
 * `Number` answers `NaN` for an absent or unparseable value, and 0 is the one
 * integer the generator cannot start from, so both fall back together.
 */
export const parseWorldSearch = (search: {
  readonly seed?: unknown;
}): WorldSearch => {
  const seed = Math.trunc(Number(search.seed));
  if (!Number.isFinite(seed)) {
    return {};
  }
  if (seed === 0) {
    return {};
  }
  return { seed };
};
