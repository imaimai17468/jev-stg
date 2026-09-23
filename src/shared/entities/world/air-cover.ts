import type { Airspace } from "./airspace";
import { regionOfProvince } from "./airspace";
import type { Division } from "./divisions";
import { valueAt } from "./grid";
import { itemAt } from "./lookup";
import { atWar } from "./wars";
import type { Wars } from "./wars";

/** What the planes overhead do to the divisions below them today. */
export interface AirCover {
  /** The air superiority each nation's enemies hold over each province, by nation id and then province id. */
  readonly enemy: readonly Float32Array[];
  /** The close air support planes each nation sends into a battle in each province, by nation id and then province id. */
  readonly support: readonly Float32Array[];
  /** The ground attack those planes carry between them, by nation id and then province id. */
  readonly supportAttack: readonly Float32Array[];
}

/** No planes over any province. */
export const NO_AIR_COVER: AirCover = {
  enemy: [],
  support: [],
  supportAttack: [],
};

/** A nation with nothing overhead. */
const CLEAR = new Float32Array(0);

/**
 * What the cover gives `nation` over `province` in one of its readings: the
 * air superiority its enemies hold there, or the close air support planes it
 * sends into the battle there and the ground attack they carry.
 */
export const coverOver = (
  cover: AirCover,
  reading: keyof AirCover,
  nation: number,
  province: number
): number => valueAt(itemAt(cover[reading], nation, CLEAR), province);

/** What the day's close air support reads besides the planes. */
export interface Battlefield {
  readonly airspace: Airspace;
  readonly owners: Int32Array;
  readonly wars: Wars;
  readonly divisions: readonly Division[];
}

/**
 * The provinces each nation fights a battle in today, by nation id: every
 * province where its divisions stand on ground held by a nation it is at war
 * with, or an enemy's stand on ground it holds.
 */
const battlesOf = (
  field: Battlefield,
  nations: number
): readonly ReadonlySet<number>[] => {
  const battles = Array.from({ length: nations }, () => new Set<number>());
  for (const division of field.divisions) {
    const holder = valueAt(field.owners, division.province);
    if (atWar(field.wars, division.nation, holder)) {
      itemAt(battles, division.nation, new Set<number>()).add(
        division.province
      );
      itemAt(battles, holder, new Set<number>()).add(division.province);
    }
  }
  return battles;
};

/** The close air support each nation flies over each region, by nation id and then region id. */
export type Flown = Pick<AirCover, "support" | "supportAttack">;

/**
 * The close air support each nation sends into each of its battles today, by
 * nation id and then province id: the planes it flies over a region and
 * their ground attack, each spread evenly over the battles it fights in that
 * region.
 */
export const supportOf = (
  field: Battlefield,
  flown: Flown,
  provinces: number
): Flown => {
  const battles = battlesOf(field, flown.support.length);
  const shares = battles.map((fought) => {
    const perRegion = new Float64Array(field.airspace.regions.length);
    for (const province of fought) {
      const region = regionOfProvince(field.airspace, province);
      perRegion[region] = valueAt(perRegion, region) + 1;
    }
    return perRegion;
  });
  const spread = (layer: readonly Float32Array[]): readonly Float32Array[] =>
    battles.map((fought, nation) => {
      const over = itemAt(layer, nation, CLEAR);
      const perRegion = itemAt(shares, nation, new Float64Array(0));
      const sent = new Float32Array(provinces);
      for (const province of fought) {
        const region = regionOfProvince(field.airspace, province);
        sent[province] = valueAt(over, region) / valueAt(perRegion, region);
      }
      return sent;
    });
  return {
    support: spread(flown.support),
    supportAttack: spread(flown.supportAttack),
  };
};
