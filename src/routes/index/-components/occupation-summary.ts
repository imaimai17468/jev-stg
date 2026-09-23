import type { World } from "@/shared/entities/world";
import type { Compliance } from "@/shared/entities/world/compliance";
import {
  FULL_REACH,
  occupancyOf,
  reachByNation,
} from "@/shared/entities/world/compliance";
import { valueAt } from "@/shared/entities/world/grid";
import { itemAt } from "@/shared/entities/world/lookup";
import type { Stirred } from "@/shared/entities/world/unrest";
import { averageLabel, percentLabel } from "./count-label";
import type { Stat } from "./stat";

/** What the occupation panel reads about who holds what and how the people there take it. */
export interface Occupation {
  /** Who holds each province now, by province id. */
  readonly owners: Int32Array;
  readonly compliance: Compliance;
  /** What the resistance work every nation's operatives have running does to each province. */
  readonly stirred: Stirred;
}

/** How many of the nation's provinces `share` marks, by province id. */
const markedCount = (
  owners: Int32Array,
  share: Float32Array,
  nation: number
): number =>
  [...owners.entries()].filter(
    ([province, holder]) => holder === nation && valueAt(share, province) > 0
  ).length;

/**
 * What the nation panel says about the ground a nation occupies: how much of
 * it there is, how far its people go along on average, how much of it enemy
 * operatives are stirring up or sabotaging, and what share of the nation's
 * people and factories it can draw on with that ground counted in.
 */
export const occupationSummaryOf = (
  world: World,
  { compliance, owners, stirred }: Occupation,
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
    reachByNation(world.provinces, owners, compliance, {
      nations: world.nations.length,
      sabotage: stirred.sabotage,
    }),
    nation,
    FULL_REACH
  );
  return [
    { label: "占領している州", value: String(occupied.length) },
    { label: "平均の服従度", value: averageLabel(occupied, percentLabel) },
    {
      label: "抵抗運動が強まっている州",
      value: String(markedCount(owners, stirred.resistance, nation)),
    },
    {
      label: "破壊工作を受けている州",
      value: String(markedCount(owners, stirred.sabotage, nation)),
    },
    { label: "召集できる人口", value: percentLabel(reach.manpower) },
    { label: "動かせる工場", value: percentLabel(reach.factories) },
  ];
};
