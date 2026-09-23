import { valueAt } from "./grid";
import type { World } from "./index";
import type { Nation } from "./nations";
import { landProvinces } from "./provinces";
import { UNASSIGNED } from "./spread";

/**
 * Where a nation musters, which is its capital while it still holds it and
 * whatever else it holds after that, or nowhere once it holds nothing.
 */
export const musteringAt = (
  world: World,
  owners: Int32Array,
  nation: Nation
): number => {
  if (valueAt(owners, nation.capital) === nation.id) {
    return nation.capital;
  }
  const held = landProvinces(world.provinces).find(
    (province) => valueAt(owners, province.id) === nation.id
  );
  return held?.id ?? UNASSIGNED;
};
