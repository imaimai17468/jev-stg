/**
 * Where the stripes cross a legend swatch `size` wide for a level striped
 * every `hatch` cells, as the offsets of each diagonal from the top-left
 * corner, and none where the level is not striped.
 */
export const stripeOffsets = (
  hatch: number,
  size: number
): readonly number[] => {
  if (hatch === 0) {
    return [];
  }
  return Array.from(
    { length: Math.floor((size * 2) / hatch) },
    (_, index) => (index + 1) * hatch
  );
};
