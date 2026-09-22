import type { World } from "@/shared/entities/world";
import type { Nation } from "@/shared/entities/world/nations";
import type { Province } from "@/shared/entities/world/provinces";
import { UNASSIGNED } from "@/shared/entities/world/spread";

const nation = (id: number, red: number): Nation => ({
  capital: id,
  colour: { blue: 0, green: 0, red },
  id,
  name: `国${id}`,
});

const land = (id: number, x: number, cells: number): Province => ({
  cells,
  id,
  kind: "land",
  neighbours: [],
  terrain: "plains",
  x,
  y: 0,
});

/**
 * Six columns over two rows: two land provinces held by one nation each, and a
 * sea zone beyond them, which is every case the painter branches on.
 */
export const fixtureWorld = (owners: readonly number[]): World => ({
  cellProvince: Int32Array.from([0, 0, 1, 1, 2, 2, 0, 0, 1, 1, 2, 2]),
  grid: { height: 2, width: 6 },
  nations: [nation(0, 200), nation(1, 100)],
  owners: Int32Array.from(owners),
  provinces: [
    land(0, 0.5, 4),
    land(1, 2.5, 4),
    { cells: 4, id: 2, kind: "sea", neighbours: [], x: 4.5, y: 0.5 },
  ],
  seed: 1,
});

/** The world with both land provinces held by the same nation. */
export const ONE_NATION = fixtureWorld([0, 0, UNASSIGNED]);

/** The world with the two land provinces held by different nations. */
export const TWO_NATIONS = fixtureWorld([0, 1, UNASSIGNED]);
