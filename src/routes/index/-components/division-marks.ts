import type { Division, DivisionKind } from "@/shared/entities/world/divisions";
import type { Colour } from "@/shared/entities/world/geography/nations";
import { NO_NATION } from "@/shared/entities/world/geography/nations";
import type { World } from "@/shared/entities/world/geography/world";
import { itemAt } from "@/shared/entities/world/lookup";
import type {
  SupplyNetwork,
  SupplyState,
} from "@/shared/entities/world/supply";
import { postOf, supplyStateOf } from "@/shared/entities/world/supply";
import type { UnitSymbol } from "./unit-symbols";
import { dominantSymbol } from "./unit-symbols";

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
  /** The unit symbol most of those divisions are drawn as. */
  readonly symbol: UnitSymbol;
}

const NO_KINDS: ReadonlyMap<number, readonly DivisionKind[]> = new Map();
const NONE_HELD: readonly DivisionKind[] = [];

/** The kind of every division each nation has in each province. */
const tally = (
  divisions: readonly Division[]
): ReadonlyMap<number, ReadonlyMap<number, readonly DivisionKind[]>> => {
  const byProvince = new Map<number, Map<number, DivisionKind[]>>();
  for (const division of divisions) {
    const held =
      byProvince.get(division.province) ?? new Map<number, DivisionKind[]>();
    const kinds = held.get(division.nation) ?? [];
    kinds.push(division.kind);
    held.set(division.nation, kinds);
    byProvince.set(division.province, held);
  }
  return byProvince;
};

/** The nation with the most divisions in a province, and the kinds they are. */
const strongestIn = (kinds: ReadonlyMap<number, readonly DivisionKind[]>) => {
  let nation = NO_NATION.id;
  let standing = NONE_HELD;
  for (const [held, those] of kinds) {
    if (those.length <= standing.length) {
      continue;
    }
    standing = those;
    nation = held;
  }
  return { kinds: standing, nation };
};

/**
 * A counter per province that holds divisions, in the colour of whoever has the
 * most of them there.
 *
 * A province two armies are fighting over shows the larger of them, because two
 * counters on one province overlap into a smudge at every zoom the map offers,
 * and the counter carries how well that army is supplied there and the unit
 * symbol most of its divisions there are drawn as.
 */
export const divisionMarks = (
  world: World,
  divisions: readonly Division[],
  supply: SupplyNetwork
): readonly DivisionMark[] => {
  const standing = tally(divisions);
  const marks: DivisionMark[] = [];
  for (const province of world.provinces) {
    const kinds = standing.get(province.id) ?? NO_KINDS;
    if (kinds.size === 0) {
      continue;
    }
    const strongest = strongestIn(kinds);
    marks.push({
      colour: itemAt(world.nations, strongest.nation, NO_NATION).colour,
      count: strongest.kinds.length,
      province: province.id,
      supply: supplyStateOf(postOf(supply, strongest.nation, province.id).fill),
      symbol: dominantSymbol(strongest.kinds),
      x: province.x,
      y: province.y,
    });
  }
  return marks;
};
