import type { World } from "@/shared/entities/world";
import { START_ADVANCEMENT } from "@/shared/entities/world/advancement";
import { NO_AIR_FORCE } from "@/shared/entities/world/air-force";
import { airspaceOf } from "@/shared/entities/world/airspace";
import { noQuiet } from "@/shared/entities/world/armistice";
import { START_CLOCK } from "@/shared/entities/world/clock";
import { startCompliance } from "@/shared/entities/world/compliance";
import { openingDiplomacy } from "@/shared/entities/world/diplomacy";
import { NO_ECONOMY } from "@/shared/entities/world/economy";
import { openingServices } from "@/shared/entities/world/espionage";
import { noGleaned } from "@/shared/entities/world/intel";
import type { Nation } from "@/shared/entities/world/nations";
import { NO_NAVY } from "@/shared/entities/world/navy";
import { noNetworks } from "@/shared/entities/world/networks";
import type { Province } from "@/shared/entities/world/provinces";
import { NO_RESOURCES } from "@/shared/entities/world/resources";
import type { Simulation } from "@/shared/entities/world/simulation";
import { UNASSIGNED } from "@/shared/entities/world/spread";
import { START_STANCE } from "@/shared/entities/world/stance";

const nation = (id: number, red: number): Nation => ({
  capital: id,
  colour: { blue: 0, green: 0, red },
  id,
  leaning: "army",
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

const FIXTURE_PROVINCES: readonly Province[] = [
  land(0, 0.5, 4),
  land(1, 2.5, 4),
  { cells: 4, id: 2, kind: "sea", neighbours: [], x: 4.5, y: 0.5 },
];

/**
 * Six columns over two rows: two land provinces and a sea zone beyond them,
 * which is every case the painter branches on.
 */
export const FIXTURE_WORLD: World = {
  airspace: airspaceOf(FIXTURE_PROVINCES, 1),
  cellProvince: Int32Array.from([0, 0, 1, 1, 2, 2, 0, 0, 1, 1, 2, 2]),
  grid: { height: 2, width: 6 },
  nations: [nation(0, 200), nation(1, 100)],
  provinces: FIXTURE_PROVINCES,
  deposits: [NO_RESOURCES, NO_RESOURCES, NO_RESOURCES],
  seed: 1,
};

/** Both land provinces held by the same nation. */
export const HELD_BY_ONE = Int32Array.from([0, 0, UNASSIGNED]);

/** The two land provinces held by different nations. */
export const HELD_BY_TWO = Int32Array.from([0, 1, UNASSIGNED]);

/** No land held at all, which is what a painter draws as unowned. */
export const HELD_BY_NOBODY = Int32Array.from([
  UNASSIGNED,
  UNASSIGNED,
  UNASSIGNED,
]);

/** A simulation over the fixture world, with whatever a test needs changed. */
export const fixtureSimulation = (
  patch: Partial<Simulation> = {}
): Simulation => ({
  advancements: [START_ADVANCEMENT, START_ADVANCEMENT],
  airBases: new Uint8Array(3),
  airForces: [NO_AIR_FORCE, NO_AIR_FORCE],
  airPower: [new Float32Array(3), new Float32Array(3)],
  chronicle: [],
  clock: START_CLOCK,
  compliance: startCompliance(HELD_BY_TWO),
  deals: [],
  diplomacy: openingDiplomacy(HELD_BY_TWO, 2, []),
  divisions: [],
  economies: [NO_ECONOMY, NO_ECONOMY],
  gleaned: noGleaned(2),
  invasions: [],
  navies: [NO_NAVY, NO_NAVY],
  negotiations: [],
  networks: noNetworks(2, 3),
  quiet: noQuiet(2),
  owners: HELD_BY_TWO,
  services: openingServices(2),
  stances: [START_STANCE, START_STANCE],
  unrest: [],
  ...patch,
});
