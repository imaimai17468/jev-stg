import type { AirForce, Wing } from "./air-force";
import { NO_AIR_FORCE } from "./air-force";
import type { Airspace } from "./airspace";
import { land, nation, sea, worldOf } from "./army-fixture";
import type { Diplomacy } from "./diplomacy";
import { openingDiplomacy } from "./diplomacy";
import type { World } from "./index";
import type { ProvinceGraph } from "./provinces";
import { graphOf } from "./provinces";
import { UNASSIGNED } from "./spread";
import { declared } from "./wars";

/**
 * Six regions, one to a province but for the fourth, which holds provinces 3
 * and 4: four on land in a row, then zone 5 off province 3, then zone 6 past
 * it. Each touches the one before it and the one after it.
 */
const AIR_AIRSPACE: Airspace = {
  regionOf: Int32Array.from([0, 1, 2, 3, 3, 4, 5]),
  regions: [
    { hub: 0, id: 0, neighbours: [1], provinces: [0], sea: false, x: 0, y: 0 },
    {
      hub: 1,
      id: 1,
      neighbours: [0, 2],
      provinces: [1],
      sea: false,
      x: 1,
      y: 0,
    },
    {
      hub: 2,
      id: 2,
      neighbours: [1, 3],
      provinces: [2],
      sea: false,
      x: 2,
      y: 0,
    },
    {
      hub: 3,
      id: 3,
      neighbours: [2, 4],
      provinces: [3, 4],
      sea: false,
      x: 3.5,
      y: 0,
    },
    {
      hub: 5,
      id: 4,
      neighbours: [3, 5],
      provinces: [5],
      sea: true,
      x: 5,
      y: 1,
    },
    { hub: 6, id: 5, neighbours: [4], provinces: [6], sea: true, x: 6, y: 1 },
  ],
};

/**
 * Five land provinces in a row with zone 5 off province 3 and zone 6 beyond
 * it. Nation 0 holds 0 and 1, nation 1 holds 2 and 3, and nation 2 holds 4,
 * so the front between the first two runs between provinces 1 and 2.
 */
export const AIR_WORLD: World = {
  ...worldOf(
    [nation(0, 0), nation(1, 3), nation(2, 4)],
    [
      land(0, [1]),
      land(1, [0, 2]),
      land(2, [1, 3]),
      land(3, [2, 4, 5]),
      land(4, [3]),
      sea(5, [3, 6]),
      sea(6, [5]),
    ]
  ),
  airspace: AIR_AIRSPACE,
};

export const AIR_OWNERS = Int32Array.from([
  0,
  0,
  1,
  1,
  2,
  UNASSIGNED,
  UNASSIGNED,
]);

export const AIR_GRAPH: ProvinceGraph = graphOf(AIR_WORLD.provinces);

/** The three nations at peace, in no faction. */
export const AIR_PEACE: Diplomacy = openingDiplomacy(AIR_OWNERS, 3, []);

/** Nations 0 and 1 at war, and nation 2 at peace with both. */
export const AIR_WAR: Diplomacy = {
  ...AIR_PEACE,
  wars: declared(AIR_PEACE.wars, { one: 0, other: 1 }),
};

/** A wing waiting at its base, which `wing` fills in. */
const GROUNDED: Wing = {
  base: UNASSIGNED,
  mission: "standby",
  model: "fighter-1",
  planes: 0,
  region: UNASSIGNED,
};

/** A wing waiting at its base, with whatever a test needs of it. */
export const wing = (patch: Pick<Wing, "model" | "base" | "planes">): Wing => ({
  ...GROUNDED,
  ...patch,
});

/** `standing` sent on a mission over a region. */
export const flying = (
  standing: Wing,
  sortie: Pick<Wing, "mission" | "region">
): Wing => ({ ...standing, ...sortie });

/** An air force building fighters on none of its factories, with `wings`. */
export const airForceOf = (wings: readonly Wing[]): AirForce => ({
  ...NO_AIR_FORCE,
  wings,
});
