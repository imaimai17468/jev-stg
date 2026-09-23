import type { Command } from "./army";
import type { Division } from "./divisions";
import { raisedAt } from "./divisions";
import type { World } from "./index";
import { NO_MODIFIERS } from "./modifiers";
import type { Nation } from "./nations";
import type { Province, ProvinceGraph } from "./provinces";
import { graphOf } from "./provinces";
import { UNASSIGNED } from "./spread";
import { START_STANCE } from "./stance";
import type { Wars } from "./wars";
import { declared, noWars } from "./wars";

const nation = (id: number, capital: number): Nation => ({
  capital,
  colour: { blue: 0, green: 0, red: 0 },
  id,
  name: `国${id}`,
});

const land = (id: number, neighbours: readonly number[]): Province => ({
  cells: 10,
  id,
  kind: "land",
  neighbours,
  terrain: "plains",
  x: id,
  y: 0,
});

/**
 * Four land provinces in a row with a sea zone off the end, held two each by
 * two nations whose capitals sit at the far ends.
 *
 * Everything an army does happens along a line: it walks toward the middle, it
 * fights where the two halves meet, and it falls back the way it came.
 */
export const LINE_WORLD: World = {
  cellProvince: Int32Array.from([0, 1, 2, 3, 4]),
  grid: { height: 1, width: 5 },
  nations: [nation(0, 0), nation(1, 3)],
  provinces: [
    land(0, [1]),
    land(1, [0, 2]),
    land(2, [1, 3]),
    land(3, [2, 4]),
    { cells: 4, id: 4, kind: "sea", neighbours: [3], x: 4, y: 0 },
  ],
  seed: 1,
};

/** Nation 0 holds the first two provinces and nation 1 the last two. */
export const LINE_OWNERS = Int32Array.from([0, 0, 1, 1, UNASSIGNED]);

export const LINE_GRAPH: ProvinceGraph = graphOf(LINE_WORLD.provinces);

/** The two nations fighting each other. */
export const AT_WAR: Wars = declared(noWars(2), { one: 0, other: 1 });

/** The two nations at war, both attacking at the stance every nation opens with. */
export const WAR_COMMAND: Command = {
  modifiers: [NO_MODIFIERS, NO_MODIFIERS],
  stances: [START_STANCE, START_STANCE],
  wars: AT_WAR,
};

/** A full-strength division, with whatever a test needs changed. */
export const division = (patch: Partial<Division>): Division => ({
  ...raisedAt(0, 0),
  ...patch,
});
