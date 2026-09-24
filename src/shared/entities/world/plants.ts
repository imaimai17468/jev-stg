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
export type PlantKind = "civilian" | "military" | "dockyards";

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

/**
 * What a placement reads: the world, who holds each province, what stands
 * there, and the level of the infrastructure in each province, by province id.
 */
export interface Estate extends Holdings {
  readonly plants: Plants;
  readonly infrastructure: Uint8Array;
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
 * The shared building slots of each category of Hearts of Iron IV's states,
 * from wasteland to megalopolis, and the fewest people, in millions, a
 * province holds to count as that category. Hearts of Iron IV sets each
 * state's category by hand, so the thresholds are this game's own.
 */
const SLOTS_BY_PEOPLE: readonly {
  readonly millions: number;
  readonly slots: number;
}[] = [
  { millions: 7, slots: 12 },
  { millions: 5, slots: 10 },
  { millions: 3.5, slots: 8 },
  { millions: 2.5, slots: 6 },
  { millions: 1.5, slots: 5 },
  { millions: 0.8, slots: 4 },
  { millions: 0.3, slots: 2 },
  { millions: 0.1, slots: 1 },
];

const MILLION = 1_000_000;

/** The factories, dockyards and other shared buildings `province` has room for. */
export const buildingSlotsOf = (province: LandProvince): number =>
  Math.max(
    0,
    ...SLOTS_BY_PEOPLE.filter(
      (category) => provincePeople(province) >= category.millions * MILLION
    ).map((category) => category.slots)
  );

/** The shared building slots a nation holds, and how many of them its buildings take. */
export interface HeldSlots {
  readonly used: number;
  readonly total: number;
}

/** The building slots over the ground `nation` holds in `estate`. */
export const slotsHeldBy = (
  { owners, plants, world }: Omit<Estate, "infrastructure">,
  nation: number
): HeldSlots => {
  const held = sitesFor({ owners, world }, nation, "civilian");
  return {
    total: held.reduce(
      (total, province) => total + buildingSlotsOf(province),
      0
    ),
    used: held.reduce(
      (used, province) => used + plantsIn(plants, province.id),
      0
    ),
  };
};

/** Whether `province` has room for one more building. */
const hasRoom = (plants: Plants, province: LandProvince): boolean =>
  plantsIn(plants, province.id) < buildingSlotsOf(province);

/** How many buildings stand in `province` for each person living there, one more counted. */
const crowdingOf = (plants: Plants, province: LandProvince): number =>
  (plantsIn(plants, province.id) + 1) / Math.max(1, provincePeople(province));

/**
 * The one of `sites` a building goes up fastest in: the highest
 * infrastructure, then the fewest buildings for the people living there, then
 * the first.
 */
const bestOf = (
  estate: Estate,
  sites: readonly LandProvince[]
): Option.Option<LandProvince> =>
  Option.fromIterable(
    sites.toSorted(
      (one, other) =>
        valueAt(estate.infrastructure, other.id) -
          valueAt(estate.infrastructure, one.id) ||
        crowdingOf(estate.plants, one) - crowdingOf(estate.plants, other)
    )
  );

/** How a province of its own is picked for a nation's next building of a kind. */
type SitePicker = (
  estate: Estate,
  nation: number,
  kind: PlantKind
) => Option.Option<LandProvince>;

/** Where a nation builds next, what, and the level of the infrastructure there. */
export interface Site {
  readonly province: number;
  readonly kind: PlantKind;
  readonly infrastructure: number;
}

/**
 * The province of its own with a free slot where `nation` builds a building
 * of `kind`, or none where it holds no such province.
 */
const roomFor: SitePicker = (estate, nation, kind) =>
  bestOf(
    estate,
    sitesFor(estate, nation, kind).filter((province) =>
      hasRoom(estate.plants, province)
    )
  );

/**
 * Where `nation` builds the building its plan wants, `wanted`, and what: a
 * military factory where it wants a dockyard and has no free slot on a coast,
 * and none where it has no free slot anywhere, so no factory goes up until a
 * slot frees.
 */
export const nextSiteOf = (
  estate: Estate,
  nation: number,
  wanted: PlantKind
): Option.Option<Site> => {
  const site = (kind: PlantKind) =>
    Option.map(roomFor(estate, nation, kind), (province) => ({
      infrastructure: valueAt(estate.infrastructure, province.id),
      kind,
      province: province.id,
    }));
  if (wanted === "dockyards") {
    return Option.orElse(site("dockyards"), () => site("military"));
  }
  return site(wanted);
};

/**
 * The province of its own `nation` puts a new building of `kind` in: the best
 * one with a free slot, or, where a focus hands it more than its slots have
 * room for, the best one it holds where the building can stand, a dockyard
 * going inland where it holds no coast. None where it holds no land at all.
 */
const siteFor: SitePicker = (estate, nation, kind) =>
  Option.orElse(roomFor(estate, nation, kind), () =>
    Option.orElse(bestOf(estate, sitesFor(estate, nation, kind)), () =>
      bestOf(estate, sitesFor(estate, nation, "civilian"))
    )
  );

/**
 * The buildings once every building each nation's economy gained between
 * `before` and `after`, by finishing a construction site or by a focus
 * handing it factories, has been put in a province of its own. A finished
 * one lands where `nextSiteOf` had it built, as long as `estate` is what the
 * day's construction read. A nation that lost buildings between the two loses
 * none here, because what it held is counted again from the provinces.
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
