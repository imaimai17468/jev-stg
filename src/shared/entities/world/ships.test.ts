import { describe, expect, it } from "vite-plus/test";
import type { ResourceNeed } from "./economy/resources";
import { NO_RESOURCES } from "./economy/resources";
import type {
  Ship,
  ShipClass,
  ShipDesigns,
  ShipRole,
  ShipyardOrder,
} from "./ships";
import {
  classOf,
  hullOf,
  hullShare,
  launched,
  orderOf,
  organisationShare,
  roleOf,
  shipDesignsOf,
  supremacyOf,
} from "./ships";

/** A 1936 destroyer that has lost half its hull points and a fifth of its cohesion. */
const DAMAGED: Ship = {
  design: "destroyer-2",
  hp: 20,
  organisation: 28,
  planes: 0,
};

/** The first design of every class. */
const FIRST: ShipDesigns = {
  battleship: "battleship-1",
  carrier: "carrier-1",
  cruiser: "light-cruiser-1",
  destroyer: "destroyer-1",
  submarine: "submarine-1",
};

describe(roleOf, () => {
  it.each<{ shipClass: ShipClass; role: ShipRole }>([
    { role: "capital", shipClass: "battleship" },
    { role: "carrier", shipClass: "carrier" },
    { role: "screen", shipClass: "cruiser" },
    { role: "screen", shipClass: "destroyer" },
    { role: "submarine", shipClass: "submarine" },
  ])(
    "should stand as a $role when the ship is a $shipClass",
    ({ role, shipClass }) => {
      expect(roleOf(shipClass)).toBe(role);
    }
  );
});

describe(hullOf, () => {
  it("should read the first battleship's cost, hull and weapons when asked for it", () => {
    expect(hullOf("battleship-1")).toStrictEqual({
      cost: 12_246,
      deck: 0,
      depthCharges: 0,
      fuel: 87,
      heavy: 28,
      hp: 367.5,
      light: 7,
      organisation: 50,
      resources: { ...NO_RESOURCES, chromium: 1, steel: 3 },
      shipClass: "battleship",
      torpedoes: 0,
      visibility: 30,
    });
  });
});

describe(shipDesignsOf, () => {
  it("should lay down the first design of every class when nothing is researched", () => {
    expect(shipDesignsOf(new Set())).toStrictEqual(FIRST);
  });

  it("should lay down the newest researched design of each class when later designs are researched", () => {
    expect(
      shipDesignsOf(
        new Set([
          "destroyer-1",
          "destroyer-3",
          "destroyer-2",
          "light-cruiser-2",
          "battleship-4",
          "carrier-2",
          "submarine-3",
          "fighter-1",
        ])
      )
    ).toStrictEqual({
      battleship: "battleship-4",
      carrier: "carrier-2",
      cruiser: "light-cruiser-2",
      destroyer: "destroyer-3",
      submarine: "submarine-3",
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
      cost: 12_246,
      order: "battleship",
      resources: { ...NO_RESOURCES, chromium: 1, steel: 3 },
    },
    {
      cost: 7964,
      order: "carrier",
      resources: { ...NO_RESOURCES, chromium: 1, steel: 3 },
    },
  ])(
    "should cost $cost and take $resources a dockyard when the dockyards build a $order of the first designs",
    ({ cost, order, resources }) => {
      expect({
        cost: orderOf(order, FIRST).cost,
        resources: orderOf(order, FIRST).resources,
      }).toStrictEqual({ cost, resources });
    }
  );

  it("should cost the design the dockyards lay down when a newer design of the class is chosen", () => {
    expect(
      orderOf("destroyer", { ...FIRST, destroyer: "destroyer-4" }).cost
    ).toBe(1518);
  });
});

describe(supremacyOf, () => {
  it("should weigh a battleship by its cost raised to the supremacy exponent when it is at sea", () => {
    expect(supremacyOf("battleship-1")).toBeCloseTo(12_246 ** 0.43, 6);
  });
});

describe(classOf, () => {
  it("should read the class of the ship's design when asked", () => {
    expect(classOf(DAMAGED)).toBe("destroyer");
  });
});

describe(launched, () => {
  it("should carry the full hull and cohesion of its design when the ship leaves the dockyard", () => {
    expect(launched("light-cruiser-2")).toStrictEqual({
      design: "light-cruiser-2",
      hp: 140,
      organisation: 40,
      planes: 0,
    });
  });

  it("should fill its hangars when a carrier leaves the dockyard", () => {
    expect(launched("carrier-2")).toStrictEqual({
      design: "carrier-2",
      hp: 325,
      organisation: 40,
      planes: 10,
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
