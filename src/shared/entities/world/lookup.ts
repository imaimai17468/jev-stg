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
