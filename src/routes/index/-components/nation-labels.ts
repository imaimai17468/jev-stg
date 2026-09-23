import type { World } from "@/shared/entities/world";
import { valueAt } from "@/shared/entities/world/grid";

/** A nation's name and where the map writes it, in grid cells. */
export interface NationLabel {
  readonly id: number;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  /** The nation's land, in cells, which decides whether the name is drawn. */
  readonly weight: number;
}

/**
 * Where each nation's name belongs, weighted by how much land sits there.
 *
 * A plain average over the provinces would put a name in the sea for a nation
 * whose territory straddles one, and weighting by cells at least keeps it over
 * the larger half.
 */
export const nationLabels = (
  world: World,
  owners: Int32Array
): readonly NationLabel[] => {
  const sumX = new Float64Array(world.nations.length);
  const sumY = new Float64Array(world.nations.length);
  const weights = new Float64Array(world.nations.length);
  for (const province of world.provinces) {
    const owner = valueAt(owners, province.id);
    if (province.kind !== "land") {
      continue;
    }
    if (owner < 0) {
      continue;
    }
    sumX[owner] = valueAt(sumX, owner) + province.x * province.cells;
    sumY[owner] = valueAt(sumY, owner) + province.y * province.cells;
    weights[owner] = valueAt(weights, owner) + province.cells;
  }
  return world.nations.map((nation) => {
    const weight = valueAt(weights, nation.id);
    const spread = Math.max(1, weight);
    return {
      id: nation.id,
      name: nation.name,
      weight,
      x: valueAt(sumX, nation.id) / spread,
      y: valueAt(sumY, nation.id) / spread,
    };
  });
};
