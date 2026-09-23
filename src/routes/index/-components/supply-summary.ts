import type { Division } from "@/shared/entities/world/divisions";
import type { NationEconomy } from "@/shared/entities/world/economy";
import { upkeepOf } from "@/shared/entities/world/economy";
import type { SupplyNetwork } from "@/shared/entities/world/supply";
import { isUndersupplied, postOf } from "@/shared/entities/world/supply";
import { countLabel, percentLabel } from "./count-label";
import type { Stat } from "./stat";

/**
 * What the nation panel says about one nation's supply: how many of its
 * divisions get less than they need, how many its supply does not reach at
 * all, what its army wears out in a day, and how much of that its depots met.
 */
export const supplySummaryOf = (
  network: SupplyNetwork,
  divisions: readonly Division[],
  economy: NationEconomy,
  nation: number
): readonly Stat[] => {
  const posts = divisions.flatMap((division) => {
    if (division.nation !== nation) {
      return [];
    }
    return [postOf(network, nation, division.province)];
  });
  const short = posts.filter(isUndersupplied).length;
  const cutOff = posts.filter((post) => post.capacity === 0).length;
  return [
    { label: "補給が足りない師団", value: `${short} / ${posts.length}` },
    { label: "補給が届かない師団", value: String(cutOff) },
    {
      label: "装備の維持費",
      value: `${countLabel(upkeepOf(posts.length))} / 日`,
    },
    {
      label: "維持費の充足",
      value: percentLabel(economy.upkeepMet),
    },
  ];
};
