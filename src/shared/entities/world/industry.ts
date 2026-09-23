import { valueAt } from "./grid";
import type { LandProvince, Province } from "./provinces";
import { landProvinces } from "./provinces";
import { UNASSIGNED } from "./spread";
import type { Terrain } from "./terrain";

/** What one cell of a terrain is worth to the nation holding it. */
interface Yield {
  /** The people living on that cell. */
  readonly people: number;
  /** The factories a million of those people run. */
  readonly factoriesPerMillion: number;
}

/**
 * What each terrain carries, per cell of it.
 *
 * The two numbers move together rather than independently: ground that feeds a
 * city is also ground a railway crosses, so plains carry both the people and
 * the industry, and a nation grown across tundra has neither.
 */
const TERRAIN_YIELD = {
  desert: { factoriesPerMillion: 0.3, people: 2000 },
  forest: { factoriesPerMillion: 0.8, people: 18_000 },
  hills: { factoriesPerMillion: 0.9, people: 12_000 },
  mountains: { factoriesPerMillion: 0.4, people: 4000 },
  plains: { factoriesPerMillion: 1, people: 30_000 },
  tundra: { factoriesPerMillion: 0.25, people: 1500 },
} satisfies Readonly<Record<Terrain, Yield>>;

const PER_MILLION = 1_000_000;

/** The people living on one land province. */
export const provincePeople = (province: LandProvince): number =>
  province.cells * TERRAIN_YIELD[province.terrain].people;

/** The people a nation's land holds and the factories they run. */
interface Industry {
  readonly population: number;
  readonly factories: number;
}

/**
 * What `weigh` makes of each land province, added up for the nation holding it,
 * by nation id. Land nobody holds counts for nobody.
 */
export const summedByHolder = (
  provinces: readonly Province[],
  owners: Int32Array,
  nations: number,
  weigh: (province: LandProvince, holder: number) => number
): Float64Array => {
  const totals = new Float64Array(nations);
  for (const province of landProvinces(provinces)) {
    const owner = valueAt(owners, province.id);
    if (owner === UNASSIGNED) {
      continue;
    }
    totals[owner] = valueAt(totals, owner) + weigh(province, owner);
  }
  return totals;
};

/**
 * What each nation's land adds up to, by nation id.
 *
 * The factories are summed as fractions and rounded once at the end, so a
 * nation of many small provinces is not taxed a rounding loss per province.
 */
export const industryByNation = (
  provinces: readonly Province[],
  owners: Int32Array,
  nations: number
): readonly Industry[] => {
  const population = summedByHolder(provinces, owners, nations, provincePeople);
  const factories = summedByHolder(
    provinces,
    owners,
    nations,
    (province) =>
      (provincePeople(province) / PER_MILLION) *
      TERRAIN_YIELD[province.terrain].factoriesPerMillion
  );
  return Array.from({ length: nations }, (_, nation): Industry => ({
    factories: Math.round(valueAt(factories, nation)),
    population: valueAt(population, nation),
  }));
};
