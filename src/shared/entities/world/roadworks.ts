import type { NationEconomy } from "./economy/economy";
import {
  constructionSpeedAt,
  INFRASTRUCTURE_COST,
  MOST_INFRASTRUCTURE,
} from "./geography/infrastructure";
import { valueAt } from "./grid";
import { UNASSIGNED } from "./spread";
import type { SupplyNetwork } from "./supply";
import { postOf } from "./supply";

/** What a day's roadworks read. */
export interface Worksite {
  readonly network: SupplyNetwork;
  readonly owners: Int32Array;
  /** The level of the infrastructure in each province, by province id. */
  readonly infrastructure: Uint8Array;
}

/** The infrastructure, and the economies that paid for what was built on it today. */
export interface Roadworks {
  readonly infrastructure: Uint8Array;
  readonly economies: readonly NationEconomy[];
}

/**
 * The divisions `nation`'s supply falls short of in `province`, or zero where
 * a level of infrastructure there would do nothing for them: ground it does
 * not hold, infrastructure already built all the way, and ground its supply
 * does not reach at all, which a road multiplies nothing on.
 */
const shortfallAt = (
  site: Worksite,
  nation: number,
  province: number
): number => {
  const post = postOf(site.network, nation, province);
  if (
    post.capacity === 0 ||
    valueAt(site.owners, province) !== nation ||
    valueAt(site.infrastructure, province) >= MOST_INFRASTRUCTURE
  ) {
    return 0;
  }
  return Math.max(0, post.demand - post.capacity);
};

/**
 * The province `nation` puts its next level of infrastructure in: the one of
 * its own where its divisions go shortest of supply, or `UNASSIGNED` where
 * none of them does.
 */
export const roadsWanted = (site: Worksite, nation: number): number => {
  const { nations } = site.network;
  let wanted = UNASSIGNED;
  let worst = 0;
  for (const key of site.network.demand.keys()) {
    if (key % nations !== nation) {
      continue;
    }
    const province = Math.floor(key / nations);
    const shortfall = shortfallAt(site, nation, province);
    if (shortfall > worst) {
      worst = shortfall;
      wanted = province;
    }
  }
  return wanted;
};

/**
 * What the roadworks put by pay for a level of infrastructure in `province`:
 * less the higher the infrastructure already stands there, because the work
 * goes up as much faster as it does.
 */
const costAt = (infrastructure: Uint8Array, province: number): number =>
  INFRASTRUCTURE_COST / constructionSpeedAt(valueAt(infrastructure, province));

/**
 * The infrastructure once every nation whose roadworks have gone far enough
 * to pay for a level has put one where its divisions go shortest of supply,
 * and the economies with that cost taken off and the province each nation
 * builds in from tomorrow. A nation whose divisions all get what the roads can
 * carry has no road site, so tomorrow all of its construction goes into
 * factories, and what its roadworks had put by waits for the next shortage.
 */
export const roadsBuiltOneDay = (
  site: Worksite,
  economies: readonly NationEconomy[]
): Roadworks => {
  const infrastructure = Uint8Array.from(site.infrastructure);
  const paid = economies.map((economy, nation) => {
    const wanted = roadsWanted(site, nation);
    const cost = costAt(site.infrastructure, wanted);
    if (wanted === UNASSIGNED || economy.roadworks < cost) {
      return { ...economy, roadSite: wanted };
    }
    infrastructure[wanted] = valueAt(infrastructure, wanted) + 1;
    return {
      ...economy,
      roadSite: wanted,
      roadworks: economy.roadworks - cost,
    };
  });
  return { economies: paid, infrastructure };
};
