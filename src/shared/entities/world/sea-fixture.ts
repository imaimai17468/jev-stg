import { land, nation, sea, TWO_NATIONS, worldOf } from "./army-fixture";
import type { Diplomacy } from "./diplomacy";
import { openingDiplomacy } from "./diplomacy";
import type { World } from "./index";
import type { Province, ProvinceGraph } from "./provinces";
import { graphOf } from "./provinces";
import type { ShipDesigns } from "./ships";
import { UNASSIGNED } from "./spread";
import { declared, noWars } from "./wars";

/**
 * Two islands across a strait of three sea zones, with a lake on the second.
 *
 * Nation 0 holds island {0, 1}: 0 is inland and 1 touches zones 4 and 5.
 * Nation 1 holds island {2, 3}: 2 touches zone 6 and 3 touches only the lake,
 * zone 7, which no voyage over the strait reaches. The strait runs 4, 5, 6.
 */
const STRAIT: readonly Province[] = [
  land(0, [1]),
  land(1, [0, 4, 5]),
  land(2, [3, 6]),
  land(3, [2, 7]),
  sea(4, [1, 5]),
  sea(5, [1, 4, 6]),
  sea(6, [2, 5]),
  sea(7, [3]),
];

/** The strait's two islands held by the pair of fixture nations. */
export const SEA_WORLD: World = worldOf(TWO_NATIONS, STRAIT);

/** The sea world's provinces as a walk over them reads them. */
export const SEA_GRAPH: ProvinceGraph = graphOf(SEA_WORLD.provinces);

/** Nation 0 holds the first island and nation 1 the second. */
export const SEA_OWNERS = Int32Array.from([
  0,
  0,
  1,
  1,
  UNASSIGNED,
  UNASSIGNED,
  UNASSIGNED,
  UNASSIGNED,
]);

/** Three nations, nobody at war and nobody in a faction. */
const THREE_AT_PEACE: Diplomacy = openingDiplomacy(SEA_OWNERS, 3, []);

/** Nation 0 at war with nation 1, and nation 2 at peace with both. */
export const ZERO_FIGHTS_ONE: Diplomacy = {
  ...THREE_AT_PEACE,
  wars: declared(THREE_AT_PEACE.wars, { one: 0, other: 1 }),
};

/**
 * Two islands across two sea zones: provinces 0 and 1 off zone 5, and
 * provinces 2 and 3 off zone 6 with province 4 inland behind 3. Nation 0's
 * capital is 0 and nation 1's is 4, so no walk over land joins the two.
 */
export const ISLES_WORLD: World = worldOf(
  [nation(0, 0), nation(1, 4)],
  [
    land(0, [1, 5]),
    land(1, [0, 5]),
    land(2, [3, 6]),
    land(3, [2, 4, 6]),
    land(4, [3]),
    sea(5, [0, 1, 6]),
    sea(6, [2, 3, 5]),
  ]
);

/** Nation 0 holds the western island and nation 1 the eastern one. */
export const ISLES_OWNERS = Int32Array.from([
  0,
  0,
  1,
  1,
  1,
  UNASSIGNED,
  UNASSIGNED,
]);

/** The islands as a walk over the provinces reads them. */
export const ISLES_GRAPH: ProvinceGraph = graphOf(ISLES_WORLD.provinces);

/** The two island nations at peace, in no faction. */
export const ISLES_PEACE: Diplomacy = openingDiplomacy(ISLES_OWNERS, 2, []);

/** The two island nations at war with each other. */
export const ISLES_WAR: Diplomacy = {
  ...ISLES_PEACE,
  wars: declared(noWars(2), { one: 0, other: 1 }),
};

/** The designs a nation's dockyards lay down at the 1936 start. */
export const SHIPS_1936: ShipDesigns = {
  battleship: "battleship-2",
  carrier: "carrier-2",
  cruiser: "light-cruiser-2",
  destroyer: "destroyer-2",
  submarine: "submarine-2",
};
