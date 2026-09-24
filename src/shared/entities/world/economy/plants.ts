import { Option } from "effect";
import { apportioned } from "../apportion";
import type { World } from "../geography/world";
import { valueAt } from "../grid";
import { itemAt } from "../lookup";
import type { Modifiers } from "../modifiers";
import { NO_MODIFIERS } from "../modifiers";
import type { LandProvince } from "../provinces";
import { landProvinces } from "../provinces";
import type { NationEconomy } from "./economy";
import { holderSums, onTheCoast, provincePeople } from "./industry";

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

/** What a placement reads beyond a province's slots: the level of the infrastructure in each province, by province id. */
export interface Estate extends Slotting {
  readonly infrastructure: Uint8Array;
}

/** What a province's building slots are read from, beyond its people. */
interface Slotting extends Holdings {
  readonly plants: Plants;
  /** The building slots focuses have added to each province, by province id. */
  readonly grantedSlots: Uint8Array;
  /** Each nation's modifiers, by nation id, whose research grows its building slots. */
  readonly modifiers: readonly Modifiers[];
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

/** The shared building slots the category of `province`'s people gives it. */
const categorySlotsOf = (province: LandProvince): number =>
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

/**
 * The factories, dockyards and other shared buildings `province` has room
 * for: what its category gives, grown by the share its holder's research
 * adds and rounded down, and the slots focuses have added to it.
 */
export const buildingSlotsOf = (
  slotting: Slotting,
  province: LandProvince
): number =>
  Math.floor(
    categorySlotsOf(province) *
      (1 +
        itemAt(
          slotting.modifiers,
          valueAt(slotting.owners, province.id),
          NO_MODIFIERS
        ).buildingSlots)
  ) + valueAt(slotting.grantedSlots, province.id);

/** The building slots over the ground `nation` holds in `slotting`. */
export const slotsHeldBy = (slotting: Slotting, nation: number): HeldSlots => {
  const held = sitesFor(slotting, nation, "civilian");
  return {
    total: held.reduce(
      (total, province) => total + buildingSlotsOf(slotting, province),
      0
    ),
    used: held.reduce(
      (used, province) => used + plantsIn(slotting.plants, province.id),
      0
    ),
  };
};

/** Whether `province` has room for one more building. */
const hasRoom = (slotting: Slotting, province: LandProvince): boolean =>
  plantsIn(slotting.plants, province.id) < buildingSlotsOf(slotting, province);

/** How many buildings stand in `province` for each person living there, one more counted. */
const crowdingOf = (plants: Plants, province: LandProvince): number =>
  (plantsIn(plants, province.id) + 1) / Math.max(1, provincePeople(province));

/**
 * Orders provinces from the one a building goes up fastest in: the highest
 * infrastructure, then the fewest buildings for the people living there, then
 * the first.
 */
const fastestFirst =
  (estate: Estate) =>
  (one: LandProvince, other: LandProvince): number =>
    valueAt(estate.infrastructure, other.id) -
      valueAt(estate.infrastructure, one.id) ||
    crowdingOf(estate.plants, one) - crowdingOf(estate.plants, other);

/** The one of `sites` a building goes up fastest in. */
const bestOf = (
  estate: Estate,
  sites: readonly LandProvince[]
): Option.Option<LandProvince> =>
  Option.fromIterable(sites.toSorted(fastestFirst(estate)));

/**
 * How a province of its own is picked for a nation's next building of a
 * kind, with the province its government chose, or `UNASSIGNED`.
 */
type SitePicker = (
  estate: Estate,
  nation: number,
  kind: PlantKind,
  chosen: number
) => Option.Option<LandProvince>;

/** Where a nation builds next, what, and the level of the infrastructure there. */
export interface Site {
  readonly province: number;
  readonly kind: PlantKind;
  readonly infrastructure: number;
}

/** The provinces `nation` holds with a free slot for a building of `kind`. */
const roomyFor = (
  estate: Estate,
  nation: number,
  kind: PlantKind
): readonly LandProvince[] =>
  sitesFor(estate, nation, kind).filter((province) =>
    hasRoom(estate, province)
  );

/**
 * The province of its own with a free slot where `nation` builds a building
 * of `kind`: the one its government chose while that one still has room for
 * it, and the best one otherwise. None where it holds no such province.
 */
const roomFor: SitePicker = (estate, nation, kind, chosen) => {
  const roomy = roomyFor(estate, nation, kind);
  return Option.orElse(
    Option.fromUndefinedOr(roomy.find((province) => province.id === chosen)),
    () => bestOf(estate, roomy)
  );
};

/** A province a government may pick to build its factories in, and what it offers. */
export interface SiteOption {
  readonly province: number;
  readonly infrastructure: number;
  /** The building slots it still has free. */
  readonly free: number;
  readonly coastal: boolean;
}

/**
 * The `limit` provinces of its own with a free slot that `nation` builds in
 * fastest, the fastest first, which is what its government picks from.
 */
export const siteOptionsOf = (
  estate: Estate,
  nation: number,
  limit: number
): readonly SiteOption[] =>
  roomyFor(estate, nation, "civilian")
    .toSorted(fastestFirst(estate))
    .slice(0, limit)
    .map((province) => ({
      coastal: onTheCoast(estate.world.provinces, province),
      free:
        buildingSlotsOf(estate, province) -
        plantsIn(estate.plants, province.id),
      infrastructure: valueAt(estate.infrastructure, province.id),
      province: province.id,
    }));

/**
 * Where `nation` builds the building its plan wants, `wanted`, and what: in
 * the province its government `chosen` while that has room for it, a
 * military factory where it wants a dockyard and has no free slot on a coast,
 * and none where it has no free slot anywhere, so no factory goes up until a
 * slot frees.
 */
export const nextSiteOf = (
  estate: Estate,
  nation: number,
  { chosen, wanted }: { readonly wanted: PlantKind; readonly chosen: number }
): Option.Option<Site> => {
  const site = (kind: PlantKind) =>
    Option.map(roomFor(estate, nation, kind, chosen), (province) => ({
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
 * The best province `nation` holds where a building of `kind` can stand,
 * whatever room it has, a dockyard going inland where it holds no coast. None
 * where it holds no land at all.
 */
const anywhereFor: SitePicker = (estate, nation, kind) =>
  Option.orElse(bestOf(estate, sitesFor(estate, nation, kind)), () =>
    bestOf(estate, sitesFor(estate, nation, "civilian"))
  );

/** How a nation came by the buildings it gained: finished on a site, or handed over by a focus. */
export type Handover = "built" | "granted";

/**
 * Where a gained building goes. One finished on a site goes in the province
 * its government chose while that has a free slot, and otherwise in the best
 * one with a free slot, which is the province `nextSiteOf` had it built in as
 * long as the estate is what the day's construction read. One a focus hands
 * over goes in the best province the nation holds and brings a slot of its
 * own, as Hearts of Iron IV's focuses add a building slot with each factory.
 */
const PLACEMENTS = {
  built: (estate, nation, kind, chosen) =>
    Option.orElse(roomFor(estate, nation, kind, chosen), () =>
      anywhereFor(estate, nation, kind, chosen)
    ),
  granted: anywhereFor,
} satisfies Readonly<Record<Handover, SitePicker>>;

/** The buildings standing, and the building slots focuses have added, by province id. */
export interface Placed {
  readonly plants: Plants;
  readonly grantedSlots: Uint8Array;
}

/**
 * The buildings once every building each nation's economy gained between
 * `before` and `after` by `handover` has been put in a province of its own,
 * with the slot each one a focus handed over brought. A nation that lost
 * buildings between the two loses none here, because what it held is counted
 * again from the provinces.
 */
export const placedGains = (
  estate: Estate,
  handover: Handover,
  {
    after,
    before,
  }: {
    readonly before: readonly NationEconomy[];
    readonly after: readonly NationEconomy[];
  }
): Placed => {
  const plants = {
    civilian: Uint16Array.from(estate.plants.civilian),
    dockyards: Uint16Array.from(estate.plants.dockyards),
    military: Uint16Array.from(estate.plants.military),
  } satisfies Plants;
  const grantedSlots = Uint8Array.from(estate.grantedSlots);
  const slotted = Number(handover === "granted");
  for (const [nation, economy] of after.entries()) {
    const earlier = itemAt(before, nation, economy);
    for (const kind of PLANT_KINDS) {
      const gained = countOf(economy, kind) - countOf(earlier, kind);
      for (let placed = 0; placed < gained; placed += 1) {
        const site = PLACEMENTS[handover](
          { ...estate, grantedSlots, plants },
          nation,
          kind,
          economy.buildSite
        );
        if (Option.isNone(site)) {
          break;
        }
        const { id } = site.value;
        plants[kind][id] = valueAt(plants[kind], id) + 1;
        grantedSlots[id] = valueAt(grantedSlots, id) + slotted;
      }
    }
  }
  return { grantedSlots, plants };
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
