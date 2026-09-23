import type { World } from "@/shared/entities/world";
import type { Division } from "@/shared/entities/world/divisions";
import { itemAt } from "@/shared/entities/world/lookup";
import type { Colour } from "@/shared/entities/world/nations";
import { NO_NATION } from "@/shared/entities/world/nations";
import type {
  SupplyNetwork,
  SupplyState,
} from "@/shared/entities/world/supply";
import { postOf, supplyStateOf } from "@/shared/entities/world/supply";

/** One counter the map draws over a province. */
export interface DivisionMark {
  readonly province: number;
  /** Where the counter sits, in cell coordinates. */
  readonly x: number;
  readonly y: number;
  readonly count: number;
  readonly colour: Colour;
  /** How well the divisions the counter stands for are supplied. */
  readonly supply: SupplyState;
}

const NO_COUNTS: ReadonlyMap<number, number> = new Map();

/** How many divisions each nation has in each province. */
const tally = (
  divisions: readonly Division[]
): ReadonlyMap<number, ReadonlyMap<number, number>> => {
  const byProvince = new Map<number, Map<number, number>>();
  for (const division of divisions) {
    const held = byProvince.get(division.province) ?? new Map<number, number>();
    held.set(division.nation, (held.get(division.nation) ?? 0) + 1);
    byProvince.set(division.province, held);
  }
  return byProvince;
};

/** The nation with the most divisions in a province, and how many it has. */
const strongestIn = (counts: ReadonlyMap<number, number>) => {
  let nation = NO_NATION.id;
  let count = 0;
  for (const [held, standing] of counts) {
    if (standing <= count) {
      continue;
    }
    count = standing;
    nation = held;
  }
  return { count, nation };
};

/**
 * A counter per province that holds divisions, in the colour of whoever has the
 * most of them there.
 *
 * A province two armies are fighting over shows the larger of them, because two
 * counters on one province overlap into a smudge at every zoom the map offers,
 * and the counter carries how well that army is supplied there.
 */
export const divisionMarks = (
  world: World,
  divisions: readonly Division[],
  supply: SupplyNetwork
): readonly DivisionMark[] => {
  const standing = tally(divisions);
  const marks: DivisionMark[] = [];
  for (const province of world.provinces) {
    const counts = standing.get(province.id) ?? NO_COUNTS;
    if (counts.size === 0) {
      continue;
    }
    const strongest = strongestIn(counts);
    marks.push({
      colour: itemAt(world.nations, strongest.nation, NO_NATION).colour,
      count: strongest.count,
      province: province.id,
      supply: supplyStateOf(postOf(supply, strongest.nation, province.id).fill),
      x: province.x,
      y: province.y,
    });
  }
  return marks;
};
