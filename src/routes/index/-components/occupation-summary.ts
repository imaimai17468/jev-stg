import type { World } from "@/shared/entities/world";
import type { Compliance } from "@/shared/entities/world/compliance";
import {
  FULL_REACH,
  occupancyOf,
  reachByNation,
} from "@/shared/entities/world/compliance";
import { valueAt } from "@/shared/entities/world/grid";
import { itemAt } from "@/shared/entities/world/lookup";
import type { Stat } from "./stat";

const PERCENT = 100;

const percent = (share: number): string => `${Math.round(share * PERCENT)}%`;

/** The average of `levels`, or a dash where there are none. */
const averageLabel = (levels: readonly number[]): string => {
  if (levels.length === 0) {
    return "—";
  }
  return percent(
    levels.reduce((total, level) => total + level, 0) / levels.length
  );
};

/**
 * What the nation panel says about the ground a nation occupies: how much of
 * it there is, how far its people go along on average, and what share of the
 * nation's people and factories it can draw on with that ground counted in.
 */
export const occupationSummaryOf = (
  world: World,
  owners: Int32Array,
  compliance: Compliance,
  nation: number
): readonly Stat[] => {
  const occupied = world.provinces.flatMap((province) => {
    const occupancy = occupancyOf(compliance, nation, province.id);
    if (valueAt(owners, province.id) !== nation || occupancy.kind === "home") {
      return [];
    }
    return [occupancy.level];
  });
  const reach = itemAt(
    reachByNation(world.provinces, owners, compliance, world.nations.length),
    nation,
    FULL_REACH
  );
  return [
    { label: "占領している州", value: String(occupied.length) },
    { label: "平均の服従度", value: averageLabel(occupied) },
    { label: "召集できる人口", value: percent(reach.manpower) },
    { label: "動かせる工場", value: percent(reach.factories) },
  ];
};
