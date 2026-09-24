import "@tanstack/react-start/server-only";
import { OPENING_ARMOURY } from "@/shared/entities/world/armoury";
import type { NationBrief } from "@/shared/entities/world/consultation";
import type { Sighting } from "@/shared/entities/world/sightings";

/** A figure the government sees exactly, with every nation behind it in view. */
export const exactly = (estimate: number): Sighting => ({
  estimate,
  margin: 0,
  unseen: 0,
});

export const BRIEF: NationBrief = {
  agencyProjects: [],
  atWar: true,
  buildSites: [],
  civilianFactories: 20,
  convoys: 12.4,
  divisionKinds: OPENING_ARMOURY.kinds,
  dockyards: 0,
  enemyFleet: exactly(30.6),
  enemyPlanes: exactly(480.6),
  enemyStrength: exactly(40_000),
  equipment: 1500.4,
  factions: [{ faction: 0, strength: 60_000 }],
  fleet: 10.2,
  focuses: [],
  freeSlots: 0,
  fuel: 0.726,
  justifiable: [],
  manpower: 90_000.6,
  militaryFactories: 5,
  nation: 1,
  operatives: 0,
  planeModels: OPENING_ARMOURY.planes,
  planes: 300.4,
  population: 3_000_000.2,
  posted: false,
  rivals: [{ nation: 2, strength: exactly(20_000) }],
  shipDesigns: OPENING_ARMOURY.ships,
  shortage: 0.126,
  skyLost: 0.334,
  spyTargets: [],
  strength: 20_000,
  techs: [],
  tension: 0.12,
  undersupplied: 0.254,
};
