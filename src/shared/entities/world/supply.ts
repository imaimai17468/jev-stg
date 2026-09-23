import type { Diplomacy } from "./diplomacy";
import { allied } from "./diplomacy";
import type { Division } from "./divisions";
import { valueAt } from "./grid";
import type { World } from "./index";
import { itemAt } from "./lookup";
import type { Modifiers } from "./modifiers";
import { NO_MODIFIERS } from "./modifiers";
import { musteringAt } from "./muster";
import { NO_NATION } from "./nations";
import type { ProvinceGraph } from "./provinces";
import {
  isLand,
  neighboursOf,
  overTheProvinces,
  provinceTerrain,
} from "./provinces";
import { distanceFrom, UNASSIGNED } from "./spread";
import type { Terrain } from "./terrain";
import { atWar } from "./wars";

/** The divisions the province a nation musters in can keep supplied. */
const SOURCE_CAPACITY = 40;

/** The share of the capacity each province further from the source keeps. */
const KEPT_PER_PROVINCE = 0.95;

/** How much of the supply reaching a province its ground lets through. */
const TERRAIN_SUPPLY = {
  desert: 0.6,
  forest: 0.8,
  hills: 0.8,
  mountains: 0.5,
  plains: 1,
  tundra: 0.6,
} satisfies Readonly<Record<Terrain, number>>;

/** What the depots and the roads can do for every nation on one day. */
export interface SupplyNetwork {
  /**
   * The divisions each province can keep supplied for each nation, by nation
   * id and then by province id: zero where the nation's supply does not reach.
   */
  readonly capacity: readonly Float32Array[];
  /**
   * The share of each nation's upkeep its depots met, by nation id, which
   * starves every division alike when the equipment runs out.
   */
  readonly upkeepMet: readonly number[];
  /** How many of each nation's divisions stand in each province, keyed by `stackKey`. */
  readonly demand: ReadonlyMap<number, number>;
  readonly nations: number;
}

/** What a supply network reads. */
export interface Lines {
  readonly world: World;
  readonly graph: ProvinceGraph;
  readonly owners: Int32Array;
  readonly diplomacy: Diplomacy;
  readonly divisions: readonly Division[];
  /** Each nation's modifiers, by nation id. */
  readonly modifiers: readonly Modifiers[];
  /** The share of each nation's upkeep its depots met, by nation id. */
  readonly upkeepMet: readonly number[];
}

/** The key one nation's divisions in one province are counted under. */
export const stackKey = (
  nations: number,
  nation: number,
  province: number
): number => province * nations + nation;

/**
 * The share of the capacity a piece of the nation's ground cut off from where
 * it musters still gets over the sea, through a coast it holds.
 */
const OVERSEAS_SHARE = 0.5;

/** Whether `province` is land `nation`'s own side holds. */
const ours = (lines: Lines, nation: number, province: number): boolean =>
  isLand(lines.graph, province) &&
  allied(lines.diplomacy, nation, valueAt(lines.owners, province));

/**
 * How far each province is from `seeds`, walking only through ground `nation`'s
 * own side holds, and one step further onto enemy ground that touches it,
 * which is where an attack stands before the ground changes hands. A province
 * the walk never reaches is `UNASSIGNED`.
 */
const reachFrom = (
  lines: Lines,
  nation: number,
  seeds: readonly number[]
): Int32Array => {
  const { diplomacy, graph, owners, world } = lines;
  const steps = distanceFrom(
    world.provinces.length,
    overTheProvinces(graph.adjacency),
    (province) => ours(lines, nation, province),
    seeds
  );
  const reach = Int32Array.from(steps);
  for (const [province] of steps.entries()) {
    if (
      !isLand(graph, province) ||
      !atWar(diplomacy.wars, nation, valueAt(owners, province))
    ) {
      continue;
    }
    const nearest = Math.min(
      ...neighboursOf(graph, province).flatMap((beside) => {
        const step = valueAt(steps, beside);
        if (step === UNASSIGNED) {
          return [];
        }
        return [step];
      })
    );
    if (Number.isFinite(nearest)) {
      reach[province] = nearest + 1;
    }
  }
  return reach;
};

/**
 * The coasts of `nation`'s side that the walk from where it musters never
 * reached, which is where a cut-off piece of its ground is supplied from.
 */
const cutOffCoasts = (
  lines: Lines,
  nation: number,
  reach: Int32Array
): readonly number[] =>
  lines.world.provinces.flatMap((province) => {
    if (
      valueAt(reach, province.id) !== UNASSIGNED ||
      !ours(lines, nation, province.id) ||
      province.neighbours.every((beside) => isLand(lines.graph, beside))
    ) {
      return [];
    }
    return [province.id];
  });

/** What `reach` lets through to each province, `share` of it where reached. */
const capacityOver = (
  lines: Lines,
  reach: Int32Array,
  share: number
): Float32Array =>
  Float32Array.from(reach, (step, province) => {
    if (step === UNASSIGNED) {
      return 0;
    }
    return (
      SOURCE_CAPACITY *
      share *
      KEPT_PER_PROVINCE ** step *
      TERRAIN_SUPPLY[provinceTerrain(lines.world.provinces, province)]
    );
  });

/**
 * The divisions each province can keep supplied for `nation`, by province id:
 * from where it musters over land, and over the sea to whatever of its side's
 * ground that land walk never reached.
 */
const capacityOf = (lines: Lines, nation: number): Float32Array => {
  const source = musteringAt(
    lines.world,
    lines.owners,
    itemAt(lines.world.nations, nation, NO_NATION)
  );
  const overland = reachFrom(
    lines,
    nation,
    [source].filter((province) => province !== UNASSIGNED)
  );
  const overseas = reachFrom(
    lines,
    nation,
    cutOffCoasts(lines, nation, overland)
  );
  const boost = 1 + itemAt(lines.modifiers, nation, NO_MODIFIERS).supply;
  const byLand = capacityOver(lines, overland, 1);
  const bySea = capacityOver(lines, overseas, OVERSEAS_SHARE);
  return Float32Array.from(
    byLand,
    (capacity, province) => Math.max(capacity, valueAt(bySea, province)) * boost
  );
};

/** How many of each nation's divisions stand in each province. */
const demandOf = (
  divisions: readonly Division[],
  nations: number
): ReadonlyMap<number, number> => {
  const demand = new Map<number, number>();
  for (const division of divisions) {
    const key = stackKey(nations, division.nation, division.province);
    demand.set(key, (demand.get(key) ?? 0) + 1);
  }
  return demand;
};

/** Every nation's supply for one day. */
export const supplyNetwork = (lines: Lines): SupplyNetwork => {
  const nations = lines.world.nations.length;
  return {
    capacity: lines.world.nations.map((nation) => capacityOf(lines, nation.id)),
    demand: demandOf(lines.divisions, nations),
    nations,
    upkeepMet: lines.upkeepMet,
  };
};

const NO_CAPACITY = new Float32Array(0);

/** What one nation's supply is in one province on one day. */
export interface Post {
  /** The divisions the province can keep supplied for the nation. */
  readonly capacity: number;
  /** How many of the nation's divisions stand there. */
  readonly demand: number;
  /**
   * The share of what it needs each of those divisions gets, from 0 to 1: the
   * capacity shared among them, cut by the share of the upkeep the nation's
   * depots met.
   */
  readonly fill: number;
}

/** `nation`'s supply in `province`. */
export const postOf = (
  network: SupplyNetwork,
  nation: number,
  province: number
): Post => {
  const capacity = valueAt(
    itemAt(network.capacity, nation, NO_CAPACITY),
    province
  );
  const demand =
    network.demand.get(stackKey(network.nations, nation, province)) ?? 0;
  return {
    capacity,
    demand,
    fill:
      Math.min(1, capacity / Math.max(1, demand)) *
      itemAt(network.upkeepMet, nation, 1),
  };
};

/** How a division's supply reads on the map: enough, short, or close to none. */
export type SupplyState = "supplied" | "short" | "starved";

/** The least fill a division still counts as short at rather than starved. */
const SHORT_FILL = 0.5;

export const supplyStateOf = (fill: number): SupplyState => {
  if (fill >= 1) {
    return "supplied";
  }
  if (fill >= SHORT_FILL) {
    return "short";
  }
  return "starved";
};

/** Whether the divisions a post supplies get less than they need. */
export const isUndersupplied = (post: Post): boolean =>
  supplyStateOf(post.fill) !== "supplied";

/** The share of `nation`'s divisions that get less than they need. */
export const undersuppliedShare = (
  network: SupplyNetwork,
  divisions: readonly Division[],
  nation: number
): number => {
  const own = divisions.filter((division) => division.nation === nation);
  const short = own.filter((division) =>
    isUndersupplied(postOf(network, nation, division.province))
  );
  return short.length / Math.max(1, own.length);
};
