import { describe, expect, it } from "vite-plus/test";
import { itemAt } from "../lookup";
import type { Navy } from "./navy";
import { NO_NAVY } from "./navy";
import { SEA_GRAPH, ZERO_FIGHTS_ONE } from "./sea-fixture";
import type { Sailings, Voyage, Waters } from "./shipping";
import { idleConvoys, shippedOneDay } from "./shipping";

/** A buffer over the sea world's eight provinces holding `weight` in zone 5 alone. */
const inZoneFive = (weight: number): Float32Array =>
  Float32Array.from([0, 0, 0, 0, 0, weight, 0, 0]);

/** No ship of any of the three nations anywhere. */
const EMPTY_SEA: readonly Float32Array[] = [0, 0, 0].map(() => inZoneFive(0));

/** The strait with nobody at sea, nation 0 at war with nation 1. */
const CALM: Waters = {
  all: EMPTY_SEA,
  diplomacy: ZERO_FIGHTS_ONE,
  graph: SEA_GRAPH,
  raiders: EMPTY_SEA,
};

/** The strait with nation 1's submarines holding zone 5 and nothing else at sea. */
const RAIDED: Waters = {
  ...CALM,
  all: [inZoneFive(0), inZoneFive(1), inZoneFive(0)],
  raiders: [inZoneFive(0), inZoneFive(1), inZoneFive(0)],
};

/** A lane across the whole strait asking for four convoys of `cargo`. */
const across = (cargo: Voyage["cargo"]): Voyage => ({
  cargo,
  from: [4],
  need: 4,
  to: [6],
});

/** A navy with ten convoys and nothing else. */
const TEN_CONVOYS: Navy = { ...NO_NAVY, convoys: 10 };

/** Nation 0's navy after a day of `sailings` in `waters`, the others idle. */
const shippedByZero = (waters: Waters, navy: Navy, sailings: Sailings): Navy =>
  itemAt(
    shippedOneDay(waters, [navy, NO_NAVY, NO_NAVY], [sailings]),
    0,
    NO_NAVY
  );

describe(shippedOneDay, () => {
  it("should run no lane and count everything delivered when the nation is asked for nothing", () => {
    expect(shippedOneDay(CALM, [TEN_CONVOYS], [])).toStrictEqual([
      { ...TEN_CONVOYS, lanes: [], overseas: 1, traded: 1 },
    ]);
  });

  it("should deliver everything and lose nothing when no enemy is at sea", () => {
    expect(
      shippedByZero(CALM, TEN_CONVOYS, {
        reserved: 0,
        voyages: [across("trade")],
      })
    ).toStrictEqual({
      ...TEN_CONVOYS,
      lanes: [{ cargo: "trade", convoys: 4, zones: [4, 5, 6] }],
      overseas: 1,
      traded: 1,
    });
  });

  it("should deliver the share its convoys cover when the lane asks for more than the navy has", () => {
    expect(
      shippedByZero(
        CALM,
        { ...NO_NAVY, convoys: 2 },
        {
          reserved: 0,
          voyages: [across("supply")],
        }
      ).overseas
    ).toBe(0.5);
  });

  it("should keep the reserved convoys off the lanes when a landing is being prepared", () => {
    expect(
      shippedByZero(
        CALM,
        { ...NO_NAVY, convoys: 6 },
        {
          reserved: 4,
          voyages: [across("trade")],
        }
      ).lanes.map((lane) => lane.convoys)
    ).toStrictEqual([2]);
  });

  it("should give the earlier lane its convoys first when there are not enough for both", () => {
    expect(
      shippedByZero(
        CALM,
        { ...NO_NAVY, convoys: 6 },
        {
          reserved: 0,
          voyages: [across("supply"), across("trade")],
        }
      ).lanes.map((lane) => lane.convoys)
    ).toStrictEqual([4, 2]);
  });

  it("should deliver nothing when no sea joins the lane's ends", () => {
    expect(
      shippedByZero(CALM, TEN_CONVOYS, {
        reserved: 0,
        voyages: [{ ...across("trade"), from: [7] }],
      }).traded
    ).toBe(0);
  });

  it("should deliver nothing when the enemy holds a zone of the lane outright", () => {
    expect(
      shippedByZero(RAIDED, TEN_CONVOYS, {
        reserved: 0,
        voyages: [across("trade")],
      }).traded
    ).toBe(0);
  });

  it("should lose a share of the lane's convoys to the enemy's submarines when they hold a zone of it", () => {
    expect(
      shippedByZero(RAIDED, TEN_CONVOYS, {
        reserved: 0,
        voyages: [across("trade")],
      }).convoys
    ).toBeCloseTo(9.92);
  });

  it("should lose no convoy when the enemy holds the zone with its battle fleet and no submarine", () => {
    expect(
      shippedByZero({ ...RAIDED, raiders: EMPTY_SEA }, TEN_CONVOYS, {
        reserved: 0,
        voyages: [across("trade")],
      }).convoys
    ).toBe(10);
  });

  it("should lose half as many convoys when the nation's own ships hold as much of the zone as the submarines", () => {
    expect(
      shippedByZero(
        { ...RAIDED, all: [inZoneFive(1), inZoneFive(1), inZoneFive(0)] },
        TEN_CONVOYS,
        { reserved: 0, voyages: [across("trade")] }
      ).convoys
    ).toBeCloseTo(9.96);
  });

  it("should weigh each lane of a cargo by what it asked for when several carry it", () => {
    expect(
      shippedByZero(CALM, TEN_CONVOYS, {
        reserved: 0,
        voyages: [across("trade"), { ...across("trade"), need: 12 }],
      }).traded
    ).toBe(0.625);
  });
});

describe(idleConvoys, () => {
  it("should count the convoys on no lane and not held back when some are left over", () => {
    expect(
      idleConvoys(
        {
          ...TEN_CONVOYS,
          lanes: [
            { cargo: "supply", convoys: 3, zones: [4] },
            { cargo: "trade", convoys: 2, zones: [4] },
          ],
        },
        1
      )
    ).toBe(4);
  });

  it("should read none when more are held back than the navy has", () => {
    expect(idleConvoys(TEN_CONVOYS, 12)).toBe(0);
  });
});
