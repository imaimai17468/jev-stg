import { Option } from "effect";
import { apportioned } from "./apportion";
import type { NationEconomy } from "./economy";
import { valueAt } from "./grid";
import type { World } from "./index";
import { holderSums, onTheCoast, provincePeople } from "./industry";
import { itemAt } from "./lookup";
import type { LandProvince } from "./provinces";
import { landProvinces } from "./provinces";

/** Every kind of building a nation's industry is counted in. */
type PlantKind = "civilian" | "military" | "dockyards";

const PLANT_KINDS: readonly PlantKind[] = ["civilian", "military", "dockyards"];

/** How many of each kind of building stand in each province, by province id. */
export interface Plants {
  readonly civilian: Uint16Array;
  readonly military: Uint16Array;
  readonly dockyards: Uint16Array;
}

/** The field of a nation's economy that counts each kind of building. */
const COUNTED_AS = {
  civilian: "civilianFactories",
  dockyards: "dockyards",
  military: "militaryFactories",
} satisfies Readonly<Record<PlantKind, keyof NationEconomy>>;

/** How many buildings of `kind` `economy` counts. */
const countOf = (economy: NationEconomy, kind: PlantKind): number =>
  economy[COUNTED_AS[kind]];

/** The world and who holds each province in it. */
interface Holdings {
  readonly world: World;
  readonly owners: Int32Array;
}

/** What a placement reads: the world, who holds each province, and what stands there. */
export interface Estate extends Holdings {
  readonly plants: Plants;
}

/** The land provinces `nation` holds where a building of `kind` can stand: a dockyard needs a coast. */
const sitesFor = (
  { owners, world }: Holdings,
  nation: number,
  kind: PlantKind
): readonly LandProvince[] =>
  landProvinces(world.provinces).filter(
    (province) =>
      valueAt(owners, province.id) === nation &&
      (kind !== "dockyards" || onTheCoast(world.provinces, province))
  );

/**
 * Every nation's buildings on the world's first day, each nation's count of
 * each kind spread over the provinces it holds in proportion to the people
 * living there, dockyards over its coasts alone.
 */
export const openingPlants = (
  holdings: Holdings,
  economies: readonly NationEconomy[]
): Plants => {
  const plantsOf = (kind: PlantKind): Uint16Array => {
    const counts = new Uint16Array(holdings.world.provinces.length);
    for (const [nation, economy] of economies.entries()) {
      const sites = sitesFor(holdings, nation, kind);
      const parts = apportioned(
        countOf(economy, kind),
        sites.map(provincePeople)
      );
      for (const [index, site] of sites.entries()) {
        counts[site.id] = itemAt(parts, index, 0);
      }
    }
    return counts;
  };
  return {
    civilian: plantsOf("civilian"),
    dockyards: plantsOf("dockyards"),
    military: plantsOf("military"),
  };
};

/** Every building standing in `province`, of every kind. */
export const plantsIn = (plants: Plants, province: number): number =>
  PLANT_KINDS.reduce(
    (total, kind) => total + valueAt(plants[kind], province),
    0
  );

/**
 * The provinces a new building of `kind` may go in: where it can stand, or
 * anywhere `nation` holds where it holds nowhere it can.
 */
const fallbackSites = (
  holdings: Holdings,
  nation: number,
  kind: PlantKind
): readonly LandProvince[] => {
  const sites = sitesFor(holdings, nation, kind);
  if (sites.length > 0) {
    return sites;
  }
  return sitesFor(holdings, nation, "civilian");
};

/** How many buildings stand in `province` for each person living there, one more counted. */
const crowdingOf = (plants: Plants, province: LandProvince): number =>
  (plantsIn(plants, province.id) + 1) / Math.max(1, provincePeople(province));

/**
 * The province of its own `nation` puts a new building of `kind` in: the one
 * with the fewest buildings for the people living there, the first on a tie,
 * so a nation's industry spreads over its ground the way its people do. A
 * dockyard goes on a coast, and anywhere the nation holds where it holds no
 * coast. None where it holds no land at all.
 */
const siteFor = (
  estate: Estate,
  nation: number,
  kind: PlantKind
): Option.Option<LandProvince> =>
  Option.fromIterable(
    fallbackSites(estate, nation, kind).toSorted(
      (one, other) =>
        crowdingOf(estate.plants, one) - crowdingOf(estate.plants, other)
    )
  );

/**
 * The buildings once every building each nation's economy gained between
 * `before` and `after`, by finishing a construction site or by a focus
 * handing it factories, has been put in a province of its own. A nation that
 * lost buildings between the two loses none here, because what it held is
 * counted again from the provinces at the end of the day.
 */
export const placedGains = (
  estate: Estate,
  before: readonly NationEconomy[],
  after: readonly NationEconomy[]
): Plants => {
  const placed = {
    civilian: Uint16Array.from(estate.plants.civilian),
    dockyards: Uint16Array.from(estate.plants.dockyards),
    military: Uint16Array.from(estate.plants.military),
  } satisfies Plants;
  for (const [nation, economy] of after.entries()) {
    const earlier = itemAt(before, nation, economy);
    for (const kind of PLANT_KINDS) {
      const gained = countOf(economy, kind) - countOf(earlier, kind);
      for (let built = 0; built < gained; built += 1) {
        const site = siteFor({ ...estate, plants: placed }, nation, kind);
        if (Option.isNone(site)) {
          break;
        }
        const { id } = site.value;
        placed[kind][id] = valueAt(placed[kind], id) + 1;
      }
    }
  }
  return placed;
};

/**
 * The economies counting the buildings standing on the ground each nation
 * holds, which is how a province taken or ceded takes its factories and its
 * dockyards with it.
 */
export const countedFrom = (
  plants: Plants,
  { owners, world }: Holdings,
  economies: readonly NationEconomy[]
): readonly NationEconomy[] => {
  const summed = holderSums(world.provinces, owners, economies.length);
  const held = (kind: PlantKind) =>
    summed((province) => valueAt(plants[kind], province.id));
  const civilian = held("civilian");
  const dockyards = held("dockyards");
  const military = held("military");
  return economies.map((economy, nation) => ({
    ...economy,
    civilianFactories: valueAt(civilian, nation),
    dockyards: valueAt(dockyards, nation),
    militaryFactories: valueAt(military, nation),
  }));
};
