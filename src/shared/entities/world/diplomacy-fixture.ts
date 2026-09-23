import { START_ADVANCEMENT } from "./advancement";
import { LINE_WORLD } from "./army-fixture";
import { START_CLOCK } from "./clock";
import { startCompliance } from "./compliance";
import type { Diplomacy } from "./diplomacy";
import { openingDiplomacy } from "./diplomacy";
import { NO_ECONOMY } from "./economy";
import type { World } from "./index";
import { NO_NATION } from "./nations";
import type { Simulation } from "./simulation";
import { UNASSIGNED } from "./spread";
import { START_STANCE } from "./stance";

/**
 * The same four provinces in a row as the army's line, with one nation to a
 * province, so each nation borders one or two others and nobody borders all.
 */
export const ROW_WORLD: World = {
  ...LINE_WORLD,
  nations: Array.from({ length: 4 }, (_, id) => ({
    ...NO_NATION,
    capital: id,
    id,
    name: `国${id}`,
  })),
};

/** Each nation holding its own province and nothing else. */
export const ROW_OWNERS = Int32Array.from([0, 1, 2, 3, UNASSIGNED]);

/** The row at peace, with nobody in a faction. */
export const ROW_PEACE: Diplomacy = openingDiplomacy(ROW_OWNERS, 4, []);

/** The row on its first day, at peace, with nobody armed and nothing decided. */
export const ROW_SIMULATION: Simulation = {
  advancements: ROW_WORLD.nations.map(() => START_ADVANCEMENT),
  chronicle: [],
  clock: START_CLOCK,
  compliance: startCompliance(ROW_OWNERS),
  diplomacy: ROW_PEACE,
  divisions: [],
  economies: ROW_WORLD.nations.map(() => ({
    ...NO_ECONOMY,
    population: 300_000,
  })),
  negotiations: [],
  owners: ROW_OWNERS,
  stances: ROW_WORLD.nations.map(() => START_STANCE),
};
