import { valueAt } from "./grid";
import { holderSums, provincePeople } from "./industry";
import { itemAt } from "./lookup";
import type { Province } from "./provinces";

/**
 * How far the people of each province go along with whoever holds it, from 0
 * to 1. A nation's own ground, the ground it held when the world opened, goes
 * along with it fully; ground it took is occupied, and its people come round
 * slowly.
 */
export interface Compliance {
  /** The nation each province belonged to when the world opened, by province id. */
  readonly natives: Int32Array;
  /** The holder each province's level was last worked out for, by province id. */
  readonly holders: Int32Array;
  /** Each province's compliance with its holder, by province id. */
  readonly levels: Float32Array;
}

/**
 * The compliance an occupied province gains in a day, and the share of what it
 * already has that it loses, after Hearts of Iron IV's 0.075% a day and
 * 0.00083% a day for each percent held. The two meet a little above 90%.
 */
const GAIN_PER_DAY = 0.00075;
const LOSS_PER_DAY = 0.00083;

/** The share of its compliance an occupied province keeps when it changes occupier. */
const KEPT_ON_TRANSFER = 0.5;

/** Every province going along fully with the nation it opens under. */
export const startCompliance = (owners: Int32Array): Compliance => ({
  holders: Int32Array.from(owners),
  levels: Float32Array.from(owners, () => 1),
  natives: Int32Array.from(owners),
});

/**
 * One province's compliance with `holder` now, given the level it had with
 * `before`: full on the holder's own ground, none on ground just taken from the
 * nation it belongs to, half on ground passed on from one occupier to another,
 * and otherwise a day more of coming round.
 */
const levelNow = (
  native: number,
  before: number,
  holder: number,
  level: number
): number => {
  if (holder === native) {
    return 1;
  }
  if (holder !== before && before === native) {
    return 0;
  }
  if (holder !== before) {
    return level * KEPT_ON_TRANSFER;
  }
  return level + GAIN_PER_DAY - LOSS_PER_DAY * level;
};

/** Compliance one day on, read against who holds each province now. */
export const compliedOneDay = (
  compliance: Compliance,
  owners: Int32Array
): Compliance => ({
  ...compliance,
  holders: Int32Array.from(owners),
  levels: Float32Array.from(compliance.levels, (level, province) =>
    levelNow(
      valueAt(compliance.natives, province),
      valueAt(compliance.holders, province),
      valueAt(owners, province),
      level
    )
  ),
});

/**
 * How much of what it holds a nation can draw on: the share of its people it
 * can call up and the share of its factories it can work. Its own ground
 * counts in full, and occupied ground at what its compliance gives.
 */
export interface Reach {
  readonly manpower: number;
  readonly factories: number;
}

/** A nation drawing on everything it holds, as it does on its own ground. */
export const FULL_REACH: Reach = { factories: 1, manpower: 1 };

/**
 * What occupied ground gives at no compliance and what full compliance adds,
 * after Hearts of Iron IV's 2% + 18% of the manpower and 25% + 65% of the
 * factories.
 */
const OCCUPIED_MANPOWER = { base: 0.02, perLevel: 0.18 };
const OCCUPIED_FACTORIES = { base: 0.25, perLevel: 0.65 };

/** Whether a province is its holder's own ground, or occupied at some compliance. */
export type Occupancy =
  | { readonly kind: "home" }
  | { readonly kind: "occupied"; readonly level: number };

const HOME: Occupancy = { kind: "home" };

/**
 * How `holder` holds `province`: as its own ground, or as occupied ground at
 * the compliance the province has come round to. A province whose level was
 * worked out for another holder was handed over by a peace signed since the
 * last day ran, and counts as just taken.
 */
export const occupancyOf = (
  compliance: Compliance,
  holder: number,
  province: number
): Occupancy => {
  if (valueAt(compliance.natives, province) === holder) {
    return HOME;
  }
  if (valueAt(compliance.holders, province) !== holder) {
    return { kind: "occupied", level: 0 };
  }
  return { kind: "occupied", level: valueAt(compliance.levels, province) };
};

/** What a holder can draw on in a province it holds as `occupancy`. */
export const reachUnder = (occupancy: Occupancy): Reach => {
  if (occupancy.kind === "home") {
    return FULL_REACH;
  }
  return {
    factories:
      OCCUPIED_FACTORIES.base + OCCUPIED_FACTORIES.perLevel * occupancy.level,
    manpower:
      OCCUPIED_MANPOWER.base + OCCUPIED_MANPOWER.perLevel * occupancy.level,
  };
};

/** Each nation's reach, by nation id, weighing each province by its people. */
export const reachByNation = (
  provinces: readonly Province[],
  owners: Int32Array,
  compliance: Compliance,
  nations: number
): readonly Reach[] => {
  const summed = holderSums(provinces, owners, nations);
  const people = summed(provincePeople);
  const reaches = provinces.map((province) =>
    reachUnder(
      occupancyOf(compliance, valueAt(owners, province.id), province.id)
    )
  );
  const drawnOn = (share: (reach: Reach) => number) =>
    summed(
      (province) =>
        provincePeople(province) *
        share(itemAt(reaches, province.id, FULL_REACH))
    );
  const recruitable = drawnOn((reach) => reach.manpower);
  const working = drawnOn((reach) => reach.factories);
  return Array.from({ length: nations }, (_, nation): Reach => {
    const total = valueAt(people, nation);
    if (total === 0) {
      return FULL_REACH;
    }
    return {
      factories: valueAt(working, nation) / total,
      manpower: valueAt(recruitable, nation) / total,
    };
  });
};
