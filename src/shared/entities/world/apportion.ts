/**
 * `total` split into whole parts in proportion to `weights`, by the largest
 * remainder: each part takes the whole of its quota, and what is left goes
 * one each to the parts whose quotas lost the most to rounding, the earlier
 * part first on a tie. Weights that sum to nothing split `total` evenly.
 */
export const apportioned = (
  total: number,
  weights: readonly number[]
): readonly number[] => {
  const sum = weights.reduce((whole, weight) => whole + weight, 0);
  const shares = weights.map((weight) => {
    if (sum <= 0) {
      return 1 / weights.length;
    }
    return weight / sum;
  });
  const quotas = shares.map((share) => total * share);
  const parts = quotas.map((quota) => Math.floor(quota));
  const left = total - parts.reduce((whole, part) => whole + part, 0);
  const byRemainder = quotas
    .map((quota, index) => ({ index, remainder: quota - Math.floor(quota) }))
    .toSorted(
      (one, other) => other.remainder - one.remainder || one.index - other.index
    )
    .slice(0, left);
  const topped = new Set(byRemainder.map((part) => part.index));
  return parts.map((part, index) => part + Number(topped.has(index)));
};
