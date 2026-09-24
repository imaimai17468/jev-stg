import { NO_AIR_COVER } from "./air-cover";
import { airspaceOf } from "./airspace";
import { OPENING_ARMOURY } from "./armoury";
import type { Command } from "./army";
import type { Division } from "./divisions";
import { raisedAt } from "./divisions";
import type { World } from "./index";
import { NO_INSIGHT } from "./insight";
import { NO_MODIFIERS } from "./modifiers";
import type { Nation } from "./nations";
import type { Province, ProvinceGraph } from "./provinces";
import { graphOf } from "./provinces";
import { NO_RESOURCES } from "./resources";
import { UNASSIGNED } from "./spread";
import { START_STANCE } from "./stance";
import type { SupplyNetwork } from "./supply";
import type { Wars } from "./wars";
import { declared, noWars } from "./wars";

/** A nation with no colour of its own, named after its id. */
export const nation = (id: number, capital: number): Nation => ({
  capital,
  colour: { blue: 0, green: 0, red: 0 },
  id,
  leaning: "army",
  name: `国${id}`,
});

/** A plains province of ten cells on the first row, at the column its id names. */
export const land = (id: number, neighbours: readonly number[]): Province => ({
  cells: 10,
  id,
  kind: "land",
  neighbours,
  terrain: "plains",
  x: id,
  y: 0,
});

/** A sea zone of ten cells on the second row, at the column its id names. */
export const sea = (id: number, neighbours: readonly number[]): Province => ({
  cells: 10,
  id,
  kind: "sea",
  neighbours,
  x: id,
  y: 1,
});

/** Nation 0 with its capital in province 0, and nation 1 with its capital in province 3. */
export const TWO_NATIONS: readonly Nation[] = [nation(0, 0), nation(1, 3)];

/**
 * A world of `provinces` on one row of cells, a cell each, with no deposits
 * anywhere, so a test names only the ground and the nations it needs.
 */
export const worldOf = (
  nations: readonly Nation[],
  provinces: readonly Province[]
): World => ({
  airspace: airspaceOf(provinces, 1),
  cellProvince: Int32Array.from(provinces, (province) => province.id),
  deposits: provinces.map(() => NO_RESOURCES),
  grid: { height: 1, width: provinces.length },
  nations,
  provinces,
  seed: 1,
});

/**
 * Four land provinces in a row with a sea zone off the end, held two each by
 * two nations whose capitals sit at the far ends.
 *
 * Everything an army does happens along a line: it walks toward the middle, it
 * fights where the two halves meet, and it falls back the way it came.
 */
export const LINE_WORLD: World = worldOf(TWO_NATIONS, [
  land(0, [1]),
  land(1, [0, 2]),
  land(2, [1, 3]),
  land(3, [2, 4]),
  { cells: 4, id: 4, kind: "sea", neighbours: [3], x: 4, y: 0 },
]);

/** Nation 0 holds the first two provinces and nation 1 the last two. */
export const LINE_OWNERS = Int32Array.from([0, 0, 1, 1, UNASSIGNED]);

export const LINE_GRAPH: ProvinceGraph = graphOf(LINE_WORLD.provinces);

/** The two nations fighting each other. */
export const AT_WAR: Wars = declared(noWars(2), { one: 0, other: 1 });

/** Every province supplying far more divisions than a test stands in it, for both nations. */
export const FULL_SUPPLY: SupplyNetwork = {
  capacity: [0, 1].map(() =>
    Float32Array.from(LINE_WORLD.provinces, () => 1000)
  ),
  demand: new Map(),
  nations: 2,
  upkeepMet: [1, 1],
};

/** The two nations at war, both attacking at the stance every nation opens with. */
export const WAR_COMMAND: Command = {
  air: NO_AIR_COVER,
  armouries: [OPENING_ARMOURY, OPENING_ARMOURY],
  insight: NO_INSIGHT,
  modifiers: [NO_MODIFIERS, NO_MODIFIERS],
  stances: [START_STANCE, START_STANCE],
  supply: FULL_SUPPLY,
  wars: AT_WAR,
};

/** A full-strength division, with whatever a test needs changed. */
export const division = (patch: Partial<Division>): Division => ({
  ...raisedAt(0, 0),
  ...patch,
});
