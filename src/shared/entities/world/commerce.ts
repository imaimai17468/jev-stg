import type { Compliance, Reach } from "./compliance";
import { FULL_REACH } from "./compliance";
import type { Diplomacy } from "./diplomacy";
import { standsAlone } from "./diplomacy";
import type { NationEconomy } from "./economy";
import { producedOneDay, shipbuildingOf } from "./economy";
import type { World } from "./index";
import { industryByNation, NO_INDUSTRY } from "./industry";
import { itemAt } from "./lookup";
import type { Modifiers } from "./modifiers";
import { NO_MODIFIERS } from "./modifiers";
import type { Navy } from "./navy";
import { builtOneDay, NO_NAVY } from "./navy";
import type { ResourceNeed } from "./resources";
import {
  extractedBy,
  MILITARY_FACTORY_NEED,
  NO_RESOURCES,
  outputShareWhenShort,
  plus,
  scaled,
  shortfall,
} from "./resources";
import { overlandBetween } from "./seas";
import { orderOf } from "./ships";
import { UNASSIGNED } from "./spread";
import type { Balance, Deal, Trader } from "./trade";
import { balancesOf, marketCleared, NO_BALANCE, NO_TRADER } from "./trade";
import { atWar } from "./wars";

/** What a day of trade and work reads. */
export interface Works {
  readonly world: World;
  readonly owners: Int32Array;
  readonly compliance: Compliance;
  readonly diplomacy: Diplomacy;
  readonly economies: readonly NationEconomy[];
  readonly navies: readonly Navy[];
  /** Each nation's modifiers, by nation id. */
  readonly modifiers: readonly Modifiers[];
  /** How much of what each nation holds it can draw on, by nation id. */
  readonly reach: readonly Reach[];
  /** The zone off each nation's home port, or `UNASSIGNED`, by nation id. */
  readonly homes: readonly number[];
  /** Which piece of land each province is on, by province id. */
  readonly landmasses: Int32Array;
  /** Where each nation musters, by nation id. */
  readonly musters: readonly number[];
}

/** A day of trade and work: the economies, the navies, and the trade struck. */
export interface Exchange {
  readonly economies: readonly NationEconomy[];
  readonly navies: readonly Navy[];
  readonly deals: readonly Deal[];
}

/**
 * What a nation's factories and dockyards take a day: every military factory
 * its share, and every dockyard what the ships it is building take.
 */
export const needOf = (economy: NationEconomy, navy: Navy): ResourceNeed =>
  plus(
    scaled(MILITARY_FACTORY_NEED, economy.militaryFactories),
    scaled(orderOf(navy.order).resources, economy.dockyards)
  );

/**
 * Every nation as the market sees it today, with what it digs, what its
 * factories and dockyards take, and the law it trades under.
 */
const tradersOf = (
  works: Works,
  extracted: readonly ResourceNeed[]
): readonly Trader[] =>
  works.economies.map((economy, nation) => ({
    civilianFactories: economy.civilianFactories,
    extracted: itemAt(extracted, nation, NO_RESOURCES),
    law: economy.tradeLaw,
    need: needOf(economy, itemAt(works.navies, nation, NO_NAVY)),
    standing: standsAlone(works.diplomacy, nation),
  }));

/**
 * The share of their output a nation's military factories and dockyards keep
 * today, with what it digs and what its trade brought in and took out.
 */
const suppliedShare = (
  economy: NationEconomy,
  need: ResourceNeed,
  held: ResourceNeed
): number =>
  outputShareWhenShort(
    economy.militaryFactories + economy.dockyards,
    shortfall(need, held)
  );

/** What a nation holds of each resource once its trade is done. */
const heldAfter = (extracted: ResourceNeed, balance: Balance): ResourceNeed =>
  plus(plus(extracted, balance.imported), scaled(balance.exported, -1));

/**
 * One day of trade and work. The market clears first on what each nation
 * digs and what its industry takes, the trade across the sea as far as the
 * convoys brought it yesterday; then every economy works with the resources
 * and the civilian factories that trade left it; and last every dockyard puts
 * its day into the ship or the convoy it is building.
 */
export const commerceOneDay = (works: Works): Exchange => {
  const { diplomacy, world } = works;
  const extracted = extractedBy(world, works.owners, works.compliance);
  const traders = tradersOf(works, extracted);
  const deals = marketCleared(traders, {
    delivered: (exporter, importer) => {
      if (
        overlandBetween(works.landmasses, works.musters, exporter, importer)
      ) {
        return 1;
      }
      return itemAt(works.navies, importer, NO_NAVY).traded;
    },
    mayTrade: (exporter, importer) =>
      !atWar(diplomacy.wars, exporter, importer),
  });
  const balances = balancesOf(deals, world.nations.length);
  const industry = industryByNation(
    world.provinces,
    works.owners,
    world.nations.length
  );
  const days = works.economies.map((economy, nation) => {
    const balance = itemAt(balances, nation, NO_BALANCE);
    const trader = itemAt(traders, nation, NO_TRADER);
    const footing = {
      coastal: itemAt(industry, nation, NO_INDUSTRY).coastal,
      modifiers: itemAt(works.modifiers, nation, NO_MODIFIERS),
      reach: itemAt(works.reach, nation, FULL_REACH),
      supplied: suppliedShare(
        economy,
        trader.need,
        heldAfter(trader.extracted, balance)
      ),
      traded: balance.factories,
    };
    return {
      economy: producedOneDay(economy, footing),
      navy: builtOneDay(
        itemAt(works.navies, nation, NO_NAVY),
        shipbuildingOf(economy, footing),
        itemAt(works.homes, nation, UNASSIGNED)
      ),
    };
  });
  return {
    deals,
    economies: days.map((day) => day.economy),
    navies: days.map((day) => day.navy),
  };
};

/** What the shortages of the resources read. */
export interface Stockpiles {
  readonly world: World;
  readonly owners: Int32Array;
  readonly compliance: Compliance;
  readonly economies: readonly NationEconomy[];
  readonly navies: readonly Navy[];
  readonly deals: readonly Deal[];
}

/** What one nation's mines, factories and trade come to today. */
export interface Ledger {
  readonly extracted: ResourceNeed;
  readonly need: ResourceNeed;
  readonly balance: Balance;
  /** The share of its arms output lost to the resources it goes without, from 0 to 1. */
  readonly shortage: number;
}

/** The ledger of a nation the world does not hold. */
export const NO_LEDGER: Ledger = {
  balance: NO_BALANCE,
  extracted: NO_RESOURCES,
  need: NO_RESOURCES,
  shortage: 0,
};

/**
 * Every nation's ledger, by nation id, with the trade struck today: what it
 * digs, what its industry takes, what it bought and sold, and the share of
 * its arms output lost to what is still missing.
 */
export const ledgersOf = (stockpiles: Stockpiles): readonly Ledger[] => {
  const extracted = extractedBy(
    stockpiles.world,
    stockpiles.owners,
    stockpiles.compliance
  );
  const balances = balancesOf(stockpiles.deals, stockpiles.economies.length);
  return stockpiles.economies.map((economy, nation) => {
    const need = needOf(economy, itemAt(stockpiles.navies, nation, NO_NAVY));
    const dug = itemAt(extracted, nation, NO_RESOURCES);
    const balance = itemAt(balances, nation, NO_BALANCE);
    return {
      balance,
      extracted: dug,
      need,
      shortage: 1 - suppliedShare(economy, need, heldAfter(dug, balance)),
    };
  });
};
