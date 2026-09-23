/**
 * The items still running one day on: every one on its last day gone, and
 * every other a day nearer its end.
 */
export const countedDown = <T extends { readonly daysLeft: number }>(
  items: readonly T[]
): readonly T[] =>
  items.flatMap((item) => {
    if (item.daysLeft <= 1) {
      return [];
    }
    return [{ ...item, daysLeft: item.daysLeft - 1 }];
  });
