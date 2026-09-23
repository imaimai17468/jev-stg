import type { World } from "@/shared/entities/world";
import { valueAt } from "@/shared/entities/world/grid";
import { itemAt } from "@/shared/entities/world/lookup";
import type { Nation } from "@/shared/entities/world/nations";
import { UNASSIGNED } from "@/shared/entities/world/spread";
import type { Terrain } from "@/shared/entities/world/terrain";

/** How much of a nation's ground is one kind of terrain. */
export interface TerrainShare {
  readonly terrain: Terrain;
  readonly provinces: number;
}

/** What the panels say about one nation. */
export interface NationSummary {
  readonly id: number;
  readonly name: string;
  readonly provinces: number;
  /** The nation's area, in map cells. */
  readonly cells: number;
  /** Its terrain, the most of it first. */
  readonly terrain: readonly TerrainShare[];
  /** The nations it shares a land border with, by name. */
  readonly neighbours: readonly string[];
}

/** Stands in for a nation the world does not hold, which its id gives away. */
const UNKNOWN: Nation = {
  capital: 0,
  colour: { blue: 0, green: 0, red: 0 },
  id: -1,
  name: "",
};

const EMPTY: NationSummary = {
  cells: 0,
  id: -1,
  name: "",
  neighbours: [],
  provinces: 0,
  terrain: [],
};

const terrainShares = (
  counts: ReadonlyMap<Terrain, number>
): readonly TerrainShare[] =>
  [...counts]
    .map(([terrain, provinces]) => ({ provinces, terrain }))
    .toSorted((left, right) => right.provinces - left.provinces);

/**
 * Everything the HUD says about a nation, read off the world in one pass.
 *
 * A nation the world does not hold comes back empty rather than absent, because
 * the panel that reads this is only rendered for a nation the map named.
 */
export const summaryOf = (world: World, nation: number): NationSummary => {
  const named = itemAt(world.nations, nation, UNKNOWN);
  if (named.id < 0) {
    return EMPTY;
  }
  const counts = new Map<Terrain, number>();
  const neighbours = new Set<number>();
  let provinces = 0;
  let cells = 0;
  for (const province of world.provinces) {
    if (province.kind !== "land") {
      continue;
    }
    if (valueAt(world.owners, province.id) !== nation) {
      continue;
    }
    provinces += 1;
    cells += province.cells;
    counts.set(province.terrain, (counts.get(province.terrain) ?? 0) + 1);
    for (const beside of province.neighbours) {
      const owner = valueAt(world.owners, beside);
      if (owner === nation || owner === UNASSIGNED) {
        continue;
      }
      neighbours.add(owner);
    }
  }
  return {
    cells,
    id: nation,
    name: named.name,
    neighbours: [...neighbours].map(
      (id) => itemAt(world.nations, id, named).name
    ),
    provinces,
    terrain: terrainShares(counts),
  };
};
