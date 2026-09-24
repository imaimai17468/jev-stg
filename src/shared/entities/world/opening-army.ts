import { apportioned } from "./apportion";
import type { Division, DivisionKind, Levied, Task } from "./divisions";
import { calledUpFor, openingKindsOf, raisedAt } from "./divisions";
import type { NationEconomy } from "./economy/economy";
import { NO_ECONOMY } from "./economy/economy";
import { onTheCoast, provincePeople } from "./economy/industry";
import { fieldFrom } from "./front";
import type { Leaning } from "./geography/leaning";
import type { Nation } from "./geography/nations";
import { nationsBeside } from "./geography/nations";
import type { World } from "./geography/world";
import { valueAt } from "./grid";
import { itemAt } from "./lookup";
import type { LandProvince, ProvinceGraph } from "./provinces";
import { graphOf, landProvinces } from "./provinces";
import { UNASSIGNED } from "./spread";

/**
 * What an opening division is posted to do: guard the capital, stand on the
 * border, guard a port, or guard ground across the sea from the capital.
 */
type Post = "capital" | "border" | "port" | "overseas";

const POSTS: readonly Post[] = ["capital", "border", "port", "overseas"];

/**
 * The share of its opening divisions a nation of each leaning posts to each
 * duty, after the garrisons, borders and colonies of Hearts of Iron IV's
 * 1936 armies. The shares are this game's own.
 */
const POST_SHARES = {
  army: { border: 0.8, capital: 0.1, overseas: 0.05, port: 0.05 },
  industry: { border: 0.6, capital: 0.2, overseas: 0.1, port: 0.1 },
  navy: { border: 0.5, capital: 0.1, overseas: 0.2, port: 0.2 },
} satisfies Readonly<Record<Leaning, Readonly<Record<Post, number>>>>;

/** Whether an opening division at each post waits for the line's orders or holds where it stands. */
const TASK_AT = {
  border: "line",
  capital: "garrison",
  overseas: "garrison",
  port: "garrison",
} satisfies Readonly<Record<Post, Task>>;

/** The ports a nation guards, the most populous first, leaving out its capital. */
const GUARDED_PORTS = 2;

/** Where the divisions of one post stand, and how many of them each place takes. */
interface Station {
  readonly provinces: readonly number[];
  readonly weight: number;
}

/** The provinces of one post, which the post's divisions are dealt over in turn. */
interface PostPlan {
  readonly post: Post;
  readonly stations: readonly Station[];
}

const byPeople = (
  provinces: readonly LandProvince[]
): readonly LandProvince[] =>
  provinces.toSorted(
    (one, other) => provincePeople(other) - provincePeople(one)
  );

/** The nation's own provinces a march over its own ground from `from` reaches. */
const reachedFrom = (
  graph: ProvinceGraph,
  owners: Int32Array,
  nation: number,
  from: number
): ReadonlySet<number> => {
  const field = fieldFrom(graph, owners, nation, [from]);
  const reached = new Set<number>();
  for (const [province, distance] of field.entries()) {
    if (distance !== UNASSIGNED) {
      reached.add(province);
    }
  }
  return reached;
};

/**
 * The nation's border with each neighbour it shares land with, weighted by
 * that neighbour's manpower, each border's provinces the most populous first.
 */
const bordersOf = (
  owners: Int32Array,
  economies: readonly NationEconomy[],
  own: readonly LandProvince[],
  nation: number
): readonly Station[] => {
  const borders = new Map<number, LandProvince[]>();
  for (const province of own) {
    for (const neighbour of nationsBeside(owners, province, nation)) {
      const border = borders.get(neighbour) ?? [];
      border.push(province);
      borders.set(neighbour, border);
    }
  }
  return [...borders]
    .toSorted(([one], [other]) => one - other)
    .map(([neighbour, provinces]) => ({
      provinces: byPeople(provinces).map((province) => province.id),
      weight: itemAt(economies, neighbour, NO_ECONOMY).manpower,
    }));
};

/**
 * Every patch of the nation's ground outside `homeGround`, the ground a march
 * from its capital reaches, each guarded at its most populous province.
 */
const overseasOf = (
  graph: ProvinceGraph,
  owners: Int32Array,
  own: readonly LandProvince[],
  nation: number,
  homeGround: ReadonlySet<number>
): readonly Station[] => {
  const reached = new Set(homeGround);
  const stations: Station[] = [];
  for (const province of own) {
    if (reached.has(province.id)) {
      continue;
    }
    const patch = reachedFrom(graph, owners, nation, province.id);
    for (const held of patch) {
      reached.add(held);
    }
    const guarded = itemAt(
      byPeople(own.filter((held) => patch.has(held.id))),
      0,
      province
    );
    stations.push({ provinces: [guarded.id], weight: 1 });
  }
  return stations;
};

/**
 * The most populous ports on `homeGround`, the ground a march from the
 * capital reaches, other than the capital itself, each guarded alone.
 */
const portsOf = (
  world: World,
  own: readonly LandProvince[],
  homeGround: ReadonlySet<number>,
  home: number
): readonly Station[] =>
  byPeople(
    own.filter(
      (province) =>
        province.id !== home &&
        homeGround.has(province.id) &&
        onTheCoast(world.provinces, province)
    )
  )
    .slice(0, GUARDED_PORTS)
    .map((province) => ({ provinces: [province.id], weight: 1 }));

/** What the opening posts are read off: the world, its provinces as a graph, who holds each, and every nation's economy. */
interface Ground {
  readonly world: World;
  readonly graph: ProvinceGraph;
  readonly owners: Int32Array;
  readonly economies: readonly NationEconomy[];
}

/** The ground the world opens on, with its province graph built once for every nation to read. */
export const groundOf = (
  world: World,
  owners: Int32Array,
  economies: readonly NationEconomy[]
): Ground => ({ economies, graph: graphOf(world.provinces), owners, world });

/** Where each post of the nation stands, leaving out a post with nowhere to stand. */
const postPlansOf = (
  { economies, graph, owners, world }: Ground,
  nation: number,
  home: number
): readonly PostPlan[] => {
  const own = landProvinces(world.provinces).filter(
    (province) => valueAt(owners, province.id) === nation
  );
  const homeGround = reachedFrom(graph, owners, nation, home);
  const stations = {
    border: bordersOf(owners, economies, own, nation),
    capital: [{ provinces: [home], weight: 1 }],
    overseas: overseasOf(graph, owners, own, nation, homeGround),
    port: portsOf(world, own, homeGround, home),
  } satisfies Readonly<Record<Post, readonly Station[]>>;
  return POSTS.filter((post) => stations[post].length > 0).map((post) => ({
    post,
    stations: stations[post],
  }));
};

/** Where one opening division stands and what it is set to. */
interface Placement {
  readonly province: number;
  readonly task: Task;
}

/** `count` places dealt over the station's provinces in turn, each set to `task`. */
const dealtOver = (
  station: Station,
  count: number,
  task: Task
): readonly Placement[] =>
  Array.from({ length: count }, (_, dealt) => ({
    province: itemAt(
      station.provinces,
      dealt % station.provinces.length,
      UNASSIGNED
    ),
    task,
  }));

/**
 * A division of each of `kinds` for `nation`, in turn, posted where its
 * leaning and its ground put them: a share guarding the capital, a share on each border as strong as
 * the neighbour across it, a share guarding its ports and a share guarding
 * its ground across the sea, a post with nowhere to stand giving its share
 * to the others.
 */
export const openingPostsOf = (
  ground: Ground,
  nation: Nation,
  home: number,
  kinds: readonly DivisionKind[]
): readonly Division[] => {
  const plans = postPlansOf(ground, nation.id, home);
  const perPost = apportioned(
    kinds.length,
    plans.map((plan) => POST_SHARES[nation.leaning][plan.post])
  );
  const placements = plans.flatMap((plan, index) => {
    const perStation = apportioned(
      itemAt(perPost, index, 0),
      plan.stations.map((station) => station.weight)
    );
    return plan.stations.flatMap((station, at) =>
      dealtOver(station, itemAt(perStation, at, 0), TASK_AT[plan.post])
    );
  });
  return placements.map((placement, index) => ({
    ...raisedAt(
      nation.id,
      placement.province,
      itemAt(kinds, index, "infantry")
    ),
    task: placement.task,
  }));
};

/**
 * The levy every nation opens the world with: as many divisions as its
 * manpower and its leaning give it, of the kinds its leaning's mix asks for
 * among the ones it may raise, posted where `openingPostsOf` puts them, with
 * their men called up.
 */
export const openingLevyIn =
  (ground: Ground): Levied =>
  (economy, nation, home, unlocked) => {
    const kinds = openingKindsOf(economy.manpower, nation.leaning, unlocked);
    return {
      divisions: openingPostsOf(ground, nation, home, kinds),
      economy: calledUpFor(economy, kinds),
    };
  };
