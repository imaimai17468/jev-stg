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
