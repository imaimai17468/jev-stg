import { Schema } from "effect";
import { valueAt } from "./grid";
import { itemAt } from "./lookup";
import type { Bonus } from "./modifiers";
import type { Resource, ResourceNeed } from "./resources";
import { NO_RESOURCES, RESOURCES } from "./resources";

/** How much of what it digs a nation lets the world buy. */
const TradeLawSchema = Schema.Literals([
  "free-trade",
  "export-focus",
  "limited-exports",
  "closed-economy",
]);

export type TradeLaw = typeof TradeLawSchema.Type;

/** Every trade law, from the most open to the most closed. */
export const TRADE_LAWS = TradeLawSchema.literals;

/** The law every nation opens 1936 under, which is Hearts of Iron IV's default. */
export const START_TRADE_LAW: TradeLaw = "export-focus";

/** What one trade law does. */
export interface LawTerms {
  /** The share of each resource it digs that other nations may buy. */
  readonly exported: number;
  /** What it adds to the factories, the dockyards and construction. */
  readonly industry: number;
  /** What it adds to research. */
  readonly research: number;
}

/** Hearts of Iron IV's trade laws. */
const LAW_TERMS = {
  "closed-economy": { exported: 0, industry: 0, research: 0 },
  "export-focus": { exported: 0.5, industry: 0.1, research: 0.05 },
  "free-trade": { exported: 0.8, industry: 0.15, research: 0.1 },
  "limited-exports": { exported: 0.25, industry: 0.05, research: 0.01 },
} satisfies Readonly<Record<TradeLaw, LawTerms>>;

export const lawTermsOf = (law: TradeLaw): LawTerms => LAW_TERMS[law];

/** What a nation gains under `law`. */
export const lawBonusOf = (law: TradeLaw): Bonus => ({
  construction: LAW_TERMS[law].industry,
  production: LAW_TERMS[law].industry,
  research: LAW_TERMS[law].research,
});

/** The units of a resource one civilian factory buys, after Hearts of Iron IV. */
const UNITS_PER_FACTORY = 8;

/**
 * The share of its civilian factories a nation hands over for imports at
 * most, so buying abroad never stops it building at home. The wiki sets no
 * such cap, and this game's is its own.
 */
const TRADE_FACTORY_CAP = 0.5;

/** One nation as the market sees it. */
export interface Trader {
  readonly law: TradeLaw;
  readonly extracted: ResourceNeed;
  readonly need: ResourceNeed;
  readonly civilianFactories: number;
  /** Whether it still holds a seat in the world, which a nation annexed does not. */
  readonly standing: boolean;
}

/** A nation the market does not see, which neither buys nor sells. */
export const NO_TRADER: Trader = {
  civilianFactories: 0,
  extracted: NO_RESOURCES,
  law: "closed-economy",
  need: NO_RESOURCES,
  standing: false,
};

/** One resource a nation buys from another every day. */
export interface Deal {
  readonly exporter: number;
  readonly importer: number;
  readonly resource: Resource;
  /** The units the exporter sells. */
  readonly units: number;
  /** The units that reach the importer, which the sea can take a share of. */
  readonly delivered: number;
  /** The civilian factories the importer hands the exporter for it. */
  readonly factories: number;
}

/** What the market reads besides the traders. */
export interface Terms {
  /** Whether the two may trade at all, which two enemies may not. */
  readonly mayTrade: (exporter: number, importer: number) => boolean;
  /**
   * The share of what it buys from `exporter` that reaches `importer`: all of
   * it over land, and over the sea as far as its convoys carry it.
   */
  readonly delivered: (exporter: number, importer: number) => number;
}

/** What the traders still hold as the market works through the deals. */
interface Ledger {
  /** What each nation still has on offer of each resource, by nation id. */
  readonly available: Readonly<Record<Resource, Float64Array>>;
  /** The civilian factories each nation may still hand over, by nation id. */
  readonly budget: Float64Array;
}

/** The units of `resource` `trader` lacks from what it digs. */
const deficitOf = (trader: Trader, resource: Resource): number =>
  Math.max(0, trader.need[resource] - trader.extracted[resource]);

/** The deals `importer` strikes for `resource`, the largest seller first. */
const bought = (
  traders: readonly Trader[],
  terms: Terms,
  ledger: Ledger,
  importer: Trader & { readonly id: number },
  resource: Resource
): readonly Deal[] => {
  const available = ledger.available[resource];
  let wanted = deficitOf(importer, resource);
  const sellers = traders
    .flatMap((_, exporter) => {
      if (exporter === importer.id || !terms.mayTrade(exporter, importer.id)) {
        return [];
      }
      return [exporter];
    })
    .toSorted(
      (one, other) => valueAt(available, other) - valueAt(available, one)
    );
  const deals: Deal[] = [];
  for (const exporter of sellers) {
    const affordable = valueAt(ledger.budget, importer.id) * UNITS_PER_FACTORY;
    const units = Math.min(wanted, valueAt(available, exporter), affordable);
    if (units <= 0) {
      continue;
    }
    const factories = Math.ceil(units / UNITS_PER_FACTORY);
    available[exporter] = valueAt(available, exporter) - units;
    ledger.budget[importer.id] =
      valueAt(ledger.budget, importer.id) - factories;
    wanted -= units;
    deals.push({
      delivered: units * terms.delivered(exporter, importer.id),
      exporter,
      factories,
      importer: importer.id,
      resource,
      units,
    });
  }
  return deals;
};

/**
 * What each trader puts on the market of `resource`, by nation id: its law's
 * share of what it digs, and never more than it digs beyond its own need, so
 * selling abroad never leaves it short.
 */
const offered = (
  traders: readonly Trader[],
  resource: Resource
): Float64Array =>
  Float64Array.from(traders, (trader) => {
    if (!trader.standing || deficitOf(trader, resource) > 0) {
      return 0;
    }
    return Math.min(
      trader.extracted[resource] * LAW_TERMS[trader.law].exported,
      trader.extracted[resource] - trader.need[resource]
    );
  });

/**
 * Every deal struck today. Each nation lets the world buy its law's share of
 * what it digs of every resource it does not lack itself, up to what it digs
 * beyond its own need, and each nation
 * short of a resource buys it, in id order, from whoever has the most on offer,
 * paying a civilian factory for every eight units, up to half its civilian
 * factories.
 */
export const marketCleared = (
  traders: readonly Trader[],
  terms: Terms
): readonly Deal[] => {
  const ledger: Ledger = {
    available: {
      aluminium: offered(traders, "aluminium"),
      chromium: offered(traders, "chromium"),
      oil: offered(traders, "oil"),
      rubber: offered(traders, "rubber"),
      steel: offered(traders, "steel"),
      tungsten: offered(traders, "tungsten"),
    },
    budget: Float64Array.from(traders, (trader) =>
      Math.floor(trader.civilianFactories * TRADE_FACTORY_CAP)
    ),
  };
  const deals: Deal[] = [];
  for (const [id, trader] of traders.entries()) {
    if (!trader.standing) {
      continue;
    }
    for (const resource of RESOURCES) {
      deals.push(
        ...bought(traders, terms, ledger, { ...trader, id }, resource)
      );
    }
  }
  return deals;
};

/** What one nation's deals come to. */
export interface Balance {
  readonly imported: ResourceNeed;
  readonly exported: ResourceNeed;
  /** Civilian factories it received less the ones it handed over. */
  readonly factories: number;
}

export const NO_BALANCE: Balance = {
  exported: NO_RESOURCES,
  factories: 0,
  imported: NO_RESOURCES,
};

/** The resource `resource` of `need` raised by `units`. */
const raised = (
  need: ResourceNeed,
  resource: Resource,
  units: number
): ResourceNeed => ({ ...need, [resource]: need[resource] + units });

/** Each nation's balance of `deals`, by nation id. */
export const balancesOf = (
  deals: readonly Deal[],
  nations: number
): readonly Balance[] => {
  const balances = Array.from({ length: nations }, () => NO_BALANCE);
  for (const deal of deals) {
    const buyer = itemAt(balances, deal.importer, NO_BALANCE);
    balances[deal.importer] = {
      ...buyer,
      factories: buyer.factories - deal.factories,
      imported: raised(buyer.imported, deal.resource, deal.delivered),
    };
    const seller = itemAt(balances, deal.exporter, NO_BALANCE);
    balances[deal.exporter] = {
      ...seller,
      exported: raised(seller.exported, deal.resource, deal.units),
      factories: seller.factories + deal.factories,
    };
  }
  return balances;
};
