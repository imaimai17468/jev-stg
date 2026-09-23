import { describe, expect, it } from "vite-plus/test";
import type { Bonus } from "./modifiers";
import { NO_RESOURCES } from "./resources";
import type { Deal, Terms, TradeLaw, Trader } from "./trade";
import { balancesOf, lawBonusOf, marketCleared, NO_TRADER } from "./trade";

/** A nation that digs `steel` a day and needs none of it. */
const miner = (law: TradeLaw, steel: number): Trader => ({
  civilianFactories: 0,
  extracted: { ...NO_RESOURCES, steel },
  law,
  need: NO_RESOURCES,
  standing: true,
});

/** A nation that digs nothing, needs `steel` a day and holds `civilianFactories`. */
const buyer = (steel: number, civilianFactories: number): Trader => ({
  civilianFactories,
  extracted: NO_RESOURCES,
  law: "export-focus",
  need: { ...NO_RESOURCES, steel },
  standing: true,
});

/** Everyone may trade with everyone, and everything bought arrives. */
const OPEN: Terms = { delivered: () => 1, mayTrade: () => true };

/** Two sellers of steel on offer and a nation short of twelve. */
const MARKET: readonly Trader[] = [
  miner("export-focus", 20),
  buyer(12, 10),
  miner("free-trade", 5),
];

/** What `MARKET` strikes: ten from the larger seller, then two from the smaller. */
const MARKET_DEALS: readonly Deal[] = [
  {
    delivered: 10,
    exporter: 0,
    factories: 2,
    importer: 1,
    resource: "steel",
    units: 10,
  },
  {
    delivered: 2,
    exporter: 2,
    factories: 1,
    importer: 1,
    resource: "steel",
    units: 2,
  },
];

describe(lawBonusOf, () => {
  it.each<{ law: TradeLaw; bonus: Bonus }>([
    {
      bonus: { construction: 0.15, production: 0.15, research: 0.1 },
      law: "free-trade",
    },
    {
      bonus: { construction: 0.1, production: 0.1, research: 0.05 },
      law: "export-focus",
    },
    {
      bonus: { construction: 0.05, production: 0.05, research: 0.01 },
      law: "limited-exports",
    },
    {
      bonus: { construction: 0, production: 0, research: 0 },
      law: "closed-economy",
    },
  ])(
    "should grant $bonus when the nation trades under $law",
    ({ law, bonus }) => {
      expect(lawBonusOf(law)).toStrictEqual(bonus);
    }
  );
});

describe(marketCleared, () => {
  it("should offer no more than the seller digs beyond its own need when its law's share exceeds that", () => {
    const seller: Trader = {
      ...miner("free-trade", 10),
      need: { ...NO_RESOURCES, steel: 8 },
    };

    expect(
      marketCleared([seller, buyer(5, 10)], OPEN).map((deal) => deal.units)
    ).toStrictEqual([2]);
  });

  it("should sell oil as it sells steel when a nation short of oil meets one that digs it", () => {
    const well: Trader = {
      ...miner("export-focus", 0),
      extracted: { ...NO_RESOURCES, oil: 20 },
    };
    const refinery: Trader = {
      ...buyer(0, 10),
      need: { ...NO_RESOURCES, oil: 5 },
    };

    expect(
      marketCleared([well, refinery], OPEN).map((deal) => deal.resource)
    ).toStrictEqual(["oil"]);
  });

  it("should buy from the largest seller first and the next after when one cannot cover the need", () => {
    expect(marketCleared(MARKET, OPEN)).toStrictEqual(MARKET_DEALS);
  });

  it("should strike no deal when the only seller is at war with the buyer", () => {
    expect(
      marketCleared([miner("export-focus", 20), buyer(5, 10)], {
        ...OPEN,
        mayTrade: () => false,
      })
    ).toStrictEqual([]);
  });

  it("should put nothing on offer when the seller has been annexed", () => {
    expect(
      marketCleared(
        [{ ...miner("export-focus", 20), standing: false }, buyer(5, 10)],
        OPEN
      )
    ).toStrictEqual([]);
  });

  it("should buy nothing when the buyer has been annexed", () => {
    expect(
      marketCleared(
        [miner("export-focus", 20), { ...buyer(5, 10), standing: false }],
        OPEN
      )
    ).toStrictEqual([]);
  });

  it("should put none of a resource on offer when the seller lacks it itself", () => {
    const short: Trader = {
      ...miner("export-focus", 20),
      need: { ...NO_RESOURCES, steel: 30 },
    };

    expect(marketCleared([short, buyer(5, 10)], OPEN)).toStrictEqual([]);
  });

  it("should buy only what half its civilian factories pay for when the buyer holds few", () => {
    expect(
      marketCleared([miner("export-focus", 20), buyer(20, 2)], OPEN)
    ).toStrictEqual([
      {
        delivered: 8,
        exporter: 0,
        factories: 1,
        importer: 1,
        resource: "steel",
        units: 8,
      },
    ]);
  });

  it("should deliver only the share the sea lets through when the trade crosses it", () => {
    expect(
      marketCleared([miner("export-focus", 20), buyer(4, 10)], {
        ...OPEN,
        delivered: () => 0.5,
      })
    ).toStrictEqual([
      {
        delivered: 2,
        exporter: 0,
        factories: 1,
        importer: 1,
        resource: "steel",
        units: 4,
      },
    ]);
  });

  it("should strike no deal when the market sees only a nation it does not hold", () => {
    expect(marketCleared([NO_TRADER, buyer(5, 10)], OPEN)).toStrictEqual([]);
  });
});

describe(balancesOf, () => {
  it("should credit each seller and debit the buyer when deals are struck", () => {
    expect(balancesOf(MARKET_DEALS, 4)).toStrictEqual([
      {
        exported: { ...NO_RESOURCES, steel: 10 },
        factories: 2,
        imported: NO_RESOURCES,
      },
      {
        exported: NO_RESOURCES,
        factories: -3,
        imported: { ...NO_RESOURCES, steel: 12 },
      },
      {
        exported: { ...NO_RESOURCES, steel: 2 },
        factories: 1,
        imported: NO_RESOURCES,
      },
      { exported: NO_RESOURCES, factories: 0, imported: NO_RESOURCES },
    ]);
  });
});
