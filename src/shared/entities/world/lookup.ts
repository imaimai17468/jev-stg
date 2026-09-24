/**
 * The item at `index`, or `fallback` where the list does not reach it.
 *
 * `noUncheckedIndexedAccess` types every list read as possibly absent, so the
 * whole world reads through this one function and through `valueAt` for
 * buffers, rather than each call site carrying its own fallback and its own
 * branch for a index that cannot be out of range.
 */
export const itemAt = <T>(items: readonly T[], index: number, fallback: T): T =>
  items[index] ?? fallback;

/** The last of `items` that `keep` holds for, or `fallback` where it holds for none. */
export const lastWhere = <T>(
  items: readonly T[],
  keep: (item: T) => boolean,
  fallback: T
): T => {
  const kept = items.filter(keep);
  return itemAt(kept, kept.length - 1, fallback);
};

/**
 * What picks, for a kind of design, the newest of `designs` in the tree's
 * order whose kind `kindOf` gives and whose technology is researched, and
 * the kind's entry in `firsts` where none is.
 */
export const newestPicker =
  <D extends string, K extends string>(
    designs: readonly D[],
    kindOf: (design: D) => K,
    firsts: Readonly<Record<K, D>>
  ) =>
  (researched: ReadonlySet<string>, kind: K): D =>
    lastWhere(
      designs,
      (design) => kindOf(design) === kind && researched.has(design),
      firsts[kind]
    );

/** The list with `item` in place of the one at `index`. */
export const replacedAt = <T>(
  items: readonly T[],
  index: number,
  item: T
): readonly T[] =>
  items.map((held, other) => {
    if (other === index) {
      return item;
    }
    return held;
  });

/** `start` with `step` applied for each of `items` in turn. */
export const foldedWith = <T, R>(
  items: readonly T[],
  start: R,
  step: (sum: R, item: T) => R
): R => {
  let sum = start;
  for (const item of items) {
    sum = step(sum, item);
  }
  return sum;
};
