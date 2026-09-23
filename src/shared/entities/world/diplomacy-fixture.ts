import { LINE_WORLD } from "./army-fixture";
import type { Diplomacy } from "./diplomacy";
import { openingDiplomacy } from "./diplomacy";
import type { World } from "./index";
import { NO_NATION } from "./nations";
import { UNASSIGNED } from "./spread";

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
