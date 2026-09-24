import { START_ADVANCEMENT } from "./advancement";
import { NO_AIR_FORCE } from "./air-force";
import { noQuiet } from "./armistice";
import { LINE_WORLD } from "./army-fixture";
import { START_CLOCK } from "./clock";
import { startCompliance } from "./compliance";
import type { Diplomacy } from "./diplomacy";
import { openingDiplomacy } from "./diplomacy";
import { NO_ECONOMY } from "./economy";
import { openingServices } from "./espionage";
import { FULL_SUPPLY_LEVEL } from "./infrastructure";
import { noGleaned } from "./intel";
import { NO_NATION } from "./nations";
import { NO_NAVY } from "./navy";
import { noNetworks } from "./networks";
import { openingPlants } from "./plants";
import type { Simulation } from "./simulation";
import { UNASSIGNED } from "./spread";
import { START_STANCE } from "./stance";
import type { World } from "./world";

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
  airBases: new Uint8Array(ROW_WORLD.provinces.length),
  airForces: ROW_WORLD.nations.map(() => NO_AIR_FORCE),
  airPower: ROW_WORLD.nations.map(
    () => new Float32Array(ROW_WORLD.airspace.regions.length)
  ),
  chronicle: [],
  clock: START_CLOCK,
  compliance: startCompliance(ROW_OWNERS),
  deals: [],
  diplomacy: ROW_PEACE,
  divisions: [],
  economies: ROW_WORLD.nations.map(() => ({
    ...NO_ECONOMY,
    population: 300_000,
  })),
  gleaned: noGleaned(ROW_WORLD.nations.length),
  grantedSlots: new Uint8Array(ROW_WORLD.provinces.length),
  infrastructure: new Uint8Array(ROW_WORLD.provinces.length).fill(
    FULL_SUPPLY_LEVEL
  ),
  invasions: [],
  navies: ROW_WORLD.nations.map(() => NO_NAVY),
  negotiations: [],
  networks: noNetworks(ROW_WORLD.nations.length, ROW_WORLD.provinces.length),
  owners: ROW_OWNERS,
  plants: openingPlants({ owners: ROW_OWNERS, world: ROW_WORLD }, []),
  quiet: noQuiet(ROW_WORLD.nations.length),
  services: openingServices(ROW_WORLD.nations.length),
  stances: ROW_WORLD.nations.map(() => START_STANCE),
  unrest: [],
};
