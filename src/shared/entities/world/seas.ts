import { Option } from "effect";
import type { Nation } from "./geography/nations";
import type { World } from "./geography/world";
import { valueAt } from "./grid";
import { itemAt } from "./lookup";
import type { Province, ProvinceGraph } from "./provinces";
import {
  distanceOver,
  isLand,
  neighboursOf,
  overTheProvinces,
} from "./provinces";
import {
  distanceFrom,
  spreadFrom,
  UNASSIGNED,
  unassignedBuffer,
} from "./spread";

/** The sea zones touching `province`, by province id. */
export const coastOf = (
  graph: ProvinceGraph,
  province: number
): readonly number[] =>
  neighboursOf(graph, province).filter((beside) => !isLand(graph, beside));

/** Whether the land province touches the sea. */
export const isCoastal = (graph: ProvinceGraph, province: number): boolean =>
  coastOf(graph, province).length > 0;

/**
 * How many sea zones each province is from the nearest of `zones`, walking
 * only over the sea, with `UNASSIGNED` on land and on water no walk reaches.
 */
export const seaDistanceFrom = (
  graph: ProvinceGraph,
  zones: readonly number[]
): Int32Array =>
  distanceOver(graph, (province) => !isLand(graph, province), zones);

/** The next zone on the way from `zone` toward the zones `distance` counts from. */
export const stepAtSea = (
  graph: ProvinceGraph,
  distance: Int32Array,
  zone: number
): number => {
  const here = valueAt(distance, zone);
  if (here <= 0) {
    return zone;
  }
  return itemAt(
    neighboursOf(graph, zone).filter(
      (beside) => valueAt(distance, beside) === here - 1
    ),
    0,
    zone
  );
};

/**
 * The sea zones a ship crosses from the nearest of `from` to the nearest of
 * `to`, both ends included, or none where no sea joins them. Each step goes to
 * the lowest-numbered neighbour closer to `to`, so the same two ends always
 * give the same lane.
 */
export const laneBetween = (
  graph: ProvinceGraph,
  from: readonly number[],
  to: readonly number[]
): readonly number[] => {
  const distance = seaDistanceFrom(graph, to);
  const nearest = from
    .filter((zone) => valueAt(distance, zone) !== UNASSIGNED)
    .toSorted((one, other) => valueAt(distance, one) - valueAt(distance, other))
    .slice(0, 1);
  const lane = [...nearest];
  for (const start of nearest) {
    let zone = start;
    while (valueAt(distance, zone) > 0) {
      zone = stepAtSea(graph, distance, zone);
      lane.push(zone);
    }
  }
  return lane;
};

/** Where a nation's ships are built, repaired, and sail from. */
export interface HomePort {
  /** The coastal land province the port stands in. */
  readonly province: number;
  /** The sea zone the port opens onto. */
  readonly zone: number;
}

/**
 * The nation's home port: its coastal province nearest where it musters,
 * walking over its own ground, opening onto the lowest-numbered sea zone it
 * touches. A nation whose ground reaching `muster` touches no sea has none,
 * and neither does one that does not hold `muster`.
 */
export const homePortOf = (
  world: World,
  graph: ProvinceGraph,
  owners: Int32Array,
  nation: Nation,
  muster: number
): Option.Option<HomePort> => {
  const steps = distanceFrom(
    world.provinces.length,
    overTheProvinces(graph.adjacency),
    (province) =>
      isLand(graph, province) && valueAt(owners, province) === nation.id,
    [muster].filter((province) => valueAt(owners, province) === nation.id)
  );
  const nearest = world.provinces
    .filter(
      (province) =>
        valueAt(steps, province.id) !== UNASSIGNED &&
        isCoastal(graph, province.id)
    )
    .toSorted(
      (one, other) => valueAt(steps, one.id) - valueAt(steps, other.id)
    );
  return Option.map(Option.fromIterable(nearest), (port) => ({
    province: port.id,
    zone: itemAt(coastOf(graph, port.id), 0, UNASSIGNED),
  }));
};

/** The sea zones of a world, by province id, and nothing on land. */
export const seaZones = (provinces: readonly Province[]): readonly number[] =>
  provinces.flatMap((province) => {
    if (province.kind !== "sea") {
      return [];
    }
    return [province.id];
  });

/** The zones within one step of `zone`, itself first. */
export const aroundZone = (
  graph: ProvinceGraph,
  zone: number
): readonly number[] => [
  zone,
  ...neighboursOf(graph, zone).filter((beside) => !isLand(graph, beside)),
];

/** The land provinces `nation` holds that touch the sea. */
export const coastsHeldBy = (
  world: World,
  graph: ProvinceGraph,
  owners: Int32Array,
  nation: number
): readonly number[] =>
  world.provinces.flatMap((province) => {
    if (
      !isLand(graph, province.id) ||
      valueAt(owners, province.id) !== nation ||
      !isCoastal(graph, province.id)
    ) {
      return [];
    }
    return [province.id];
  });

/** Every sea zone touching one of `provinces`, each once, in id order. */
export const zonesOffshore = (
  graph: ProvinceGraph,
  provinces: readonly number[]
): readonly number[] =>
  [
    ...new Set(provinces.flatMap((province) => coastOf(graph, province))),
  ].toSorted((one, other) => one - other);

/**
 * Which piece of land each province belongs to, by province id: two
 * provinces share a number, the lowest id among them, when a walk over land
 * joins them, and the sea is `UNASSIGNED`.
 */
export const landmassesOf = (graph: ProvinceGraph): Int32Array => {
  const masses = unassignedBuffer(graph.adjacency.length);
  for (const [province] of graph.adjacency.entries()) {
    if (!isLand(graph, province) || valueAt(masses, province) !== UNASSIGNED) {
      continue;
    }
    masses[province] = province;
    spreadFrom(
      masses,
      overTheProvinces(graph.adjacency),
      (beside) => isLand(graph, beside),
      [province]
    );
  }
  return masses;
};

/**
 * Whether the two nations' capitals stand on one piece of land, so whatever
 * passes between them goes overland: never where either musters nowhere.
 */
export const overlandBetween = (
  landmasses: Int32Array,
  musters: readonly number[],
  one: number,
  other: number
): boolean => {
  const from = itemAt(musters, one, UNASSIGNED);
  const to = itemAt(musters, other, UNASSIGNED);
  return (
    from !== UNASSIGNED &&
    to !== UNASSIGNED &&
    valueAt(landmasses, from) === valueAt(landmasses, to)
  );
};
