import { valueAt } from "./grid";
import type { World } from "./index";
import { nationNames } from "./names";
import type { Province } from "./provinces";
import {
  adjacencyOf,
  landFlags,
  landProvinces,
  overTheProvinces,
} from "./provinces";
import type { Random } from "./random";
import { spreadFrom, UNASSIGNED } from "./spread";

/** A colour as the map paints it, each channel in [0, 255]. */
export interface Colour {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

/** One of the powers the world is divided between. */
export interface Nation {
  readonly id: number;
  readonly name: string;
  readonly colour: Colour;
  /** The land province the nation is named from and grows out of. */
  readonly capital: number;
}

/** Stands in for a nation the world does not hold, which its id gives away. */
export const NO_NATION: Nation = {
  capital: 0,
  colour: { blue: 0, green: 0, red: 0 },
  id: -1,
  name: "",
};

/**
 * How far apart two consecutive nations sit on the hue wheel. The stride is
 * coprime with a full turn, so nations created one after another land on
 * opposite sides of the wheel rather than in a gradient.
 */
const HUE_STRIDE = 137;
const CHANNEL_MAX = 255;

/** One channel of an HSL colour, by the standard piecewise definition. */
const channel = (
  hue: number,
  saturation: number,
  lightness: number,
  shift: number
): number => {
  const position = (shift + hue / 30) % 12;
  const reach = saturation * Math.min(lightness, 1 - lightness);
  const level =
    lightness - reach * Math.max(-1, Math.min(position - 3, 9 - position, 1));
  return Math.round(level * CHANNEL_MAX);
};

/**
 * The nation colour for a slot on the hue wheel.
 *
 * Saturation and lightness step with the slot as well as the hue, so two
 * nations that land on close hues still differ in weight, which is what
 * separates them where they share a border.
 */
export const nationColour = (slot: number): Colour => {
  const hue = (slot * HUE_STRIDE) % 360;
  const saturation = 0.34 + (slot % 3) * 0.09;
  const lightness = 0.46 + (slot % 2) * 0.1;
  return {
    blue: channel(hue, saturation, lightness, 4),
    green: channel(hue, saturation, lightness, 8),
    red: channel(hue, saturation, lightness, 0),
  };
};

const distanceBetween = (from: Province, to: Province): number =>
  Math.hypot(from.x - to.x, from.y - to.y);

/** How close `candidate` sits to the nearest capital already chosen. */
const nearestChosenDistance = (
  candidate: Province,
  chosen: readonly Province[]
): number => {
  let closest = Number.POSITIVE_INFINITY;
  for (const other of chosen) {
    closest = Math.min(closest, distanceBetween(candidate, other));
  }
  return closest;
};

/**
 * `count` land provinces spread as far from each other as the map allows.
 *
 * Drawing capitals at random puts two of them in the same valley often enough
 * to be noticeable, and a world where two powers start inside each other's
 * borders has its first war decided before anyone chooses anything.
 */
export const pickCapitals = (
  provinces: readonly Province[],
  count: number,
  random: Random
): readonly number[] => {
  const land = provinces.filter((province) => province.kind === "land");
  const start = random.below(land.length);
  // A one-element slice rather than an indexed read, so a world with no land at
  // all leaves the list empty instead of needing an absent value to stand in.
  const chosen: Province[] = land.slice(start, start + 1);
  const taken = new Set(chosen.map((province) => province.id));
  while (chosen.length > 0 && chosen.length < count) {
    let bestIndex = -1;
    let bestDistance = Number.NEGATIVE_INFINITY;
    for (const [index, candidate] of land.entries()) {
      const distance = nearestChosenDistance(candidate, chosen);
      if (taken.has(candidate.id)) {
        continue;
      }
      if (distance > bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    // Fewer capitals than asked for rather than the same province twice, which
    // would leave every nation after the first holding nothing.
    if (bestIndex < 0) {
      break;
    }
    const picked = land.slice(bestIndex, bestIndex + 1);
    chosen.push(...picked);
    for (const province of picked) {
      taken.add(province.id);
    }
  }
  return chosen.map((province) => province.id);
};

/** The nation holding the province nearest to `province`, if any holds one. */
const nearestOwner = (
  provinces: readonly Province[],
  owners: Int32Array,
  province: Province
): number => {
  let owner = UNASSIGNED;
  let closest = Number.POSITIVE_INFINITY;
  for (const other of provinces) {
    const candidate = valueAt(owners, other.id);
    if (candidate === UNASSIGNED) {
      continue;
    }
    const distance = distanceBetween(province, other);
    if (distance >= closest) {
      continue;
    }
    closest = distance;
    owner = candidate;
  }
  return owner;
};

/**
 * Which nation holds each province, by province id, with `UNASSIGNED` on water.
 *
 * Every land province ends up held: the growth reaches whatever is connected to
 * a capital by land, and an island that nothing reaches goes to the nation
 * whose territory lies closest to it, which is how a colony ends up on the far
 * side of an ocean.
 */
export const growOwners = (
  provinces: readonly Province[],
  capitals: readonly number[]
): Int32Array => {
  const owners = new Int32Array(provinces.length).fill(UNASSIGNED);
  const land = landFlags(provinces);
  const adjacency = adjacencyOf(provinces);
  for (const [nation, province] of capitals.entries()) {
    owners[province] = nation;
  }
  spreadFrom(
    owners,
    overTheProvinces(adjacency),
    (province) => valueAt(land, province) === 1,
    capitals
  );
  for (const province of landProvinces(provinces)) {
    if (valueAt(owners, province.id) !== UNASSIGNED) {
      continue;
    }
    owners[province.id] = nearestOwner(provinces, owners, province);
  }
  return owners;
};

/** Who holds each province when a world opens, by province id. */
export const initialOwners = (
  provinces: readonly Province[],
  nations: readonly Nation[]
): Int32Array =>
  growOwners(
    provinces,
    nations.map((nation) => nation.capital)
  );

/** The nations of a world, named and coloured, one per capital. */
export const buildNations = (
  capitals: readonly number[],
  random: Random
): readonly Nation[] => {
  const capitalCells = Int32Array.from(capitals);
  return nationNames(capitals.length, random).map((name, id) => ({
    capital: valueAt(capitalCells, id),
    colour: nationColour(id),
    id,
    name,
  }));
};

/** Two nations whose land touches, the lower id first. */
export interface NationPair {
  readonly one: number;
  readonly other: number;
}

/**
 * Every pair of nations that share a land border, each pair once.
 *
 * Who can march into whom is decided here rather than by distance on the map,
 * because two capitals a short way apart with an ocean between them share no
 * front at all.
 */
export const neighbouringNations = (
  world: World,
  owners: Int32Array
): readonly NationPair[] => {
  const nations = world.nations.length;
  const seen = new Set<number>();
  const pairs: NationPair[] = [];
  for (const province of landProvinces(world.provinces)) {
    const owner = valueAt(owners, province.id);
    for (const beside of province.neighbours) {
      const other = valueAt(owners, beside);
      if (other === UNASSIGNED || owner === UNASSIGNED || other === owner) {
        continue;
      }
      const pair = {
        one: Math.min(owner, other),
        other: Math.max(owner, other),
      };
      const key = pair.one * nations + pair.other;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      pairs.push(pair);
    }
  }
  return pairs;
};
