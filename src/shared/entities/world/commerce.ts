import { roomiestBase, stationedOf } from "./air-bases";
import type { AirForce } from "./air-force";
import { NO_AIR_FORCE, planesBuiltOneDay } from "./air-force";
import { airframeOf, aviationShareOf } from "./aircraft";
import type { Compliance, Reach } from "./compliance";
import { FULL_REACH } from "./compliance";
import type { Diplomacy } from "./diplomacy";
import { standsAlone } from "./diplomacy";
import type { NationEconomy } from "./economy";
import { outputOf, producedOneDay } from "./economy";
import { oilWanted, refined } from "./fuel";
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
  splitByLine,
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
  readonly airForces: readonly AirForce[];
  /** The level of the air base in each province, by province id. */
  readonly airBases: Uint8Array;
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
  /** The civilian factories each nation's intelligence agency ties up today, by nation id. */
  readonly tiedUp: readonly number[];
}

/** A day of trade and work: the economies, the navies, the air forces, and the trade struck. */
export interface Exchange {
  readonly economies: readonly NationEconomy[];
  readonly navies: readonly Navy[];
  readonly airForces: readonly AirForce[];
  readonly deals: readonly Deal[];
}

/** What a nation builds with: its economy, and the orders its dockyards and air factories work on. */
export interface Arsenal {
  readonly economy: NationEconomy;
  readonly navy: Navy;
  readonly airForce: AirForce;
}

/**
 * What a nation's industry takes a day: every military factory building
 * equipment its share, every one on planes what the planes it is building
 * take, every dockyard what the ships it is building take, and the oil to
 * refine what its planes and ships burned yesterday.
 */
export const needOf = ({ airForce, economy, navy }: Arsenal): ResourceNeed => {
  const onPlanes =
    economy.militaryFactories * aviationShareOf(airForce.aviation);
  return plus(
    plus(
      scaled(MILITARY_FACTORY_NEED, economy.militaryFactories - onPlanes),
      scaled(airframeOf(airForce.order).resources, onPlanes)
    ),
    plus(scaled(orderOf(navy.order).resources, economy.dockyards), {
      ...NO_RESOURCES,
      oil: oilWanted(economy.burned),
    })
  );
};

/** What one nation builds with, read off `works` or the stockpiles. */
const arsenalOf = (
  sources: Pick<Works, "economies" | "navies" | "airForces">,
  economy: NationEconomy,
  nation: number
): Arsenal => ({
  airForce: itemAt(sources.airForces, nation, NO_AIR_FORCE),
  economy,
  navy: itemAt(sources.navies, nation, NO_NAVY),
});

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
    need: needOf(arsenalOf(works, economy, nation)),
    standing: standsAlone(works.diplomacy, nation),
  }));

/** The shares of their output a nation's lines keep today, by what they build with. */
interface Supplied {
  /** Its military factories building equipment and its dockyards. */
  readonly arms: number;
  /** Its military factories on planes. */
  readonly aircraft: number;
}

/**
 * The shares of their output a nation's lines keep today, with what it digs
 * and what its trade brought in and took out: each side's lines lose only to
 * the materials they build with.
 */
const suppliedShares = (
  arsenal: Arsenal,
  need: ResourceNeed,
  held: ResourceNeed
): Supplied => {
  const { economy } = arsenal;
  const onPlanes =
    economy.militaryFactories * aviationShareOf(arsenal.airForce.aviation);
  const missing = splitByLine(shortfall(need, held));
  return {
    aircraft: outputShareWhenShort(onPlanes, missing.aircraft),
    arms: outputShareWhenShort(
      economy.militaryFactories - onPlanes + economy.dockyards,
      missing.arms
    ),
  };
};

/** What a nation holds of each resource once its trade is done. */
const heldAfter = (extracted: ResourceNeed, balance: Balance): ResourceNeed =>
  plus(plus(extracted, balance.imported), scaled(balance.exported, -1));

/**
 * One day of trade and work. The market clears first on what each nation
 * digs and what its industry takes, the trade across the sea as far as the
 * convoys brought it yesterday; then every economy works with the resources
 * and the civilian factories that trade and its intelligence agency left it,
 * and refines the oil into its fuel; and last every dockyard puts its day into the ship or the convoy it
 * is building, and every factory on planes into the plane it is building,
 * which goes to the air base with the most room.
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
    const held = heldAfter(trader.extracted, balance);
    const airForce = itemAt(works.airForces, nation, NO_AIR_FORCE);
    const supplied = suppliedShares(
      arsenalOf(works, economy, nation),
      trader.need,
      held
    );
    const footing = {
      airSupplied: supplied.aircraft,
      aviation: aviationShareOf(airForce.aviation),
      coastal: itemAt(industry, nation, NO_INDUSTRY).coastal,
      modifiers: itemAt(works.modifiers, nation, NO_MODIFIERS),
      reach: itemAt(works.reach, nation, FULL_REACH),
      supplied: supplied.arms,
      tiedUp: itemAt(works.tiedUp, nation, 0),
      traded: balance.factories,
    };
    return {
      airForce: planesBuiltOneDay(
        airForce,
        outputOf(economy, footing, "aircraft"),
        roomiestBase({
          bases: works.airBases,
          nation,
          owners: works.owners,
          stationed: stationedOf(airForce.wings, works.airBases.length),
        })
      ),
      economy: {
        ...producedOneDay(economy, footing),
        burned: 0,
        fuel: refined(economy.fuel, held.oil),
      },
      navy: builtOneDay(
        itemAt(works.navies, nation, NO_NAVY),
        outputOf(economy, footing, "ships"),
        itemAt(works.homes, nation, UNASSIGNED)
      ),
    };
  });
  return {
    airForces: days.map((day) => day.airForce),
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
  readonly airForces: readonly AirForce[];
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
    const arsenal = arsenalOf(stockpiles, economy, nation);
    const need = needOf(arsenal);
    const dug = itemAt(extracted, nation, NO_RESOURCES);
    const balance = itemAt(balances, nation, NO_BALANCE);
    const supplied = suppliedShares(arsenal, need, heldAfter(dug, balance));
    const onPlanes =
      economy.militaryFactories * aviationShareOf(arsenal.airForce.aviation);
    const lines = economy.militaryFactories + economy.dockyards;
    return {
      balance,
      extracted: dug,
      need,
      shortage:
        ((1 - supplied.arms) * (lines - onPlanes) +
          (1 - supplied.aircraft) * onPlanes) /
        Math.max(1, lines),
    };
  });
};
