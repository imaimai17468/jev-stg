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
export const DEFAULT_SEED = 115;

/**
 * The widest seed the terrain can tell apart.
 *
 * The noise hash spreads a seed by taking the fractional part of a product with
 * it, and past 2^53 that product has no fractional part left, so every seed
 * above it draws one and the same world. This span is what the hash separates.
 */
const WIDEST_SEED = 2_147_483_647;

/**
 * The seed a URL's search carries, where it carries a usable one.
 *
 * `Number` answers `NaN` for an absent or unparseable value, 0 is the one
 * integer the generator cannot start from, and a seed outside the span above
 * would draw the same world as every other seed outside it. All three fall back
 * to the default rather than drawing something the address does not name.
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
  if (Math.abs(seed) > WIDEST_SEED) {
    return {};
  }
  return { seed };
};
