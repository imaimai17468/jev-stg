import { describe, expect, it } from "vite-plus/test";
import type { ResourceNeed } from "./resources";
import { NO_RESOURCES } from "./resources";
import type { Ship, ShipyardOrder } from "./ships";
import {
  hullOf,
  hullShare,
  launched,
  orderOf,
  organisationShare,
  supremacyOf,
} from "./ships";

/** A destroyer that has lost half its hull points and a fifth of its cohesion. */
const DAMAGED: Ship = {
  hp: 20,
  organisation: 28,
  planes: 0,
  shipClass: "destroyer",
};

describe(hullOf, () => {
  it("should read the battleship's cost, hull and weapons when asked for a battleship", () => {
    expect(hullOf("battleship")).toStrictEqual({
      cost: 3000,
      deck: 0,
      depthCharges: 0,
      fuel: 92,
      guns: 42,
      hp: 370,
      organisation: 50,
      resources: { ...NO_RESOURCES, chromium: 1, steel: 1 },
      role: "capital",
      torpedoes: 0,
      visibility: 20,
    });
  });
});

describe(orderOf, () => {
  it.each<{ order: ShipyardOrder; cost: number; resources: ResourceNeed }>([
    {
      cost: 100,
      order: "convoy",
      resources: { ...NO_RESOURCES, steel: 2 },
    },
    {
      cost: 3000,
      order: "battleship",
      resources: { ...NO_RESOURCES, chromium: 1, steel: 1 },
    },
    {
      cost: 2094,
      order: "carrier",
      resources: { ...NO_RESOURCES, chromium: 1, steel: 3 },
    },
  ])(
    "should cost $cost and take $resources a dockyard when the dockyards build a $order",
    ({ cost, order, resources }) => {
      expect({
        cost: orderOf(order).cost,
        resources: orderOf(order).resources,
      }).toStrictEqual({ cost, resources });
    }
  );
});

describe(supremacyOf, () => {
  it("should weigh a battleship by its cost raised to the supremacy exponent when it is at sea", () => {
    expect(supremacyOf("battleship")).toBeCloseTo(3000 ** 0.62, 6);
  });
});

describe(launched, () => {
  it("should carry the full hull and cohesion of its class when the ship leaves the dockyard", () => {
    expect(launched("cruiser")).toStrictEqual({
      hp: 110,
      organisation: 40,
      planes: 0,
      shipClass: "cruiser",
    });
  });

  it("should fill its hangars when a carrier leaves the dockyard", () => {
    expect(launched("carrier")).toStrictEqual({
      hp: 250,
      organisation: 40,
      planes: 20,
      shipClass: "carrier",
    });
  });
});

describe(hullShare, () => {
  it("should read half when the ship has lost half its hull points", () => {
    expect(hullShare(DAMAGED)).toBe(0.5);
  });
});

describe(organisationShare, () => {
  it("should read four fifths when the ship has lost a fifth of its cohesion", () => {
    expect(organisationShare(DAMAGED)).toBe(0.8);
  });
});
