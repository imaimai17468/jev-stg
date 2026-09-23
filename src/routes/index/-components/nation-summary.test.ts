import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { World } from "@/shared/entities/world";
import { START_ADVANCEMENT } from "@/shared/entities/world/advancement";
import { START_CLOCK } from "@/shared/entities/world/clock";
import {
  INDEPENDENT,
  openingDiplomacy,
  warDeclared,
} from "@/shared/entities/world/diplomacy";
import type { NationEconomy } from "@/shared/entities/world/economy";
import { NO_ECONOMY } from "@/shared/entities/world/economy";
import type { Province } from "@/shared/entities/world/provinces";
import type { Simulation } from "@/shared/entities/world/simulation";
import { UNASSIGNED } from "@/shared/entities/world/spread";
import { summaryOf } from "./nation-summary";

const land = (
  id: number,
  terrain: "plains" | "hills",
  cells: number,
  neighbours: readonly number[]
): Province => ({ cells, id, kind: "land", neighbours, terrain, x: id, y: 0 });

/**
 * Two nations and a sea zone. Nation 0 holds two plains and a hill, one of its
 * provinces touches nation 1, another touches only its own, and a third touches
 * the water, which is every case the pass branches on.
 */
const WORLD: World = {
  cellProvince: Int32Array.from([0, 1, 2, 3, 4]),
  grid: { height: 1, width: 5 },
  nations: [
    { capital: 0, colour: { blue: 0, green: 0, red: 0 }, id: 0, name: "国0" },
    { capital: 2, colour: { blue: 0, green: 0, red: 0 }, id: 1, name: "国1" },
  ],
  provinces: [
    land(0, "plains", 4, [1, 2, 3]),
    land(1, "plains", 2, [0]),
    land(2, "hills", 3, [0]),
    { cells: 9, id: 3, kind: "sea", neighbours: [0], x: 3, y: 0 },
    land(4, "hills", 1, []),
  ],
  seed: 1,
};

/** One economy per nation, told apart by the equipment each has stacked. */
const ECONOMIES: readonly NationEconomy[] = [
  { ...NO_ECONOMY, equipment: 40 },
  { ...NO_ECONOMY, equipment: 90 },
];

/** Nation 0 holds three provinces, nation 1 holds one, and a sea zone is free. */
const OWNERS = Int32Array.from([0, 0, 1, UNASSIGNED, 0]);

/** The two nations at war, so the panel has enemies to name. */
const SIMULATION: Simulation = {
  advancements: [START_ADVANCEMENT, START_ADVANCEMENT],
  chronicle: [],
  negotiations: [],
  stances: ["balanced", "balanced"],
  clock: START_CLOCK,
  divisions: [
    {
      kind: "infantry",
      marched: 0,
      movingTo: 0,
      nation: 0,
      organisation: 60,
      province: 0,
      strength: 20_000,
    },
  ],
  economies: ECONOMIES,
  owners: OWNERS,
  diplomacy: warDeclared(openingDiplomacy(OWNERS, 2, [0]), 0, 1),
};

describe(summaryOf, () => {
  it("should gather a nation's ground, terrain and borders when it holds some", () => {
    expect(summaryOf(WORLD, SIMULATION, 0)).toStrictEqual({
      cells: 7,
      divisions: 1,
      economy: { ...NO_ECONOMY, equipment: 40 },
      enemies: ["国1"],
      faction: Option.some({ members: ["国0"], name: "国0陣営" }),
      id: 0,
      name: "国0",
      neighbours: ["国1"],
      provinces: 3,
      puppets: [],
      standing: { kind: "independent" },
      terrain: [
        { provinces: 2, terrain: "plains" },
        { provinces: 1, terrain: "hills" },
      ],
    });
  });

  it("should read nothing when the world holds no nation with that id", () => {
    expect(summaryOf(WORLD, SIMULATION, 9)).toStrictEqual({
      cells: 0,
      divisions: 0,
      economy: NO_ECONOMY,
      enemies: [],
      faction: Option.none(),
      id: -1,
      name: "",
      neighbours: [],
      provinces: 0,
      puppets: [],
      standing: { kind: "independent" },
      terrain: [],
    });
  });

  it("should name the overlord and list no faction when the nation is an unaligned puppet", () => {
    const simulation: Simulation = {
      ...SIMULATION,
      diplomacy: {
        ...openingDiplomacy(OWNERS, 2, []),
        standings: [INDEPENDENT, { kind: "puppet", overlord: 0 }],
      },
    };

    const summary = summaryOf(WORLD, simulation, 1);

    expect({
      faction: summary.faction,
      standing: summary.standing,
    }).toStrictEqual({
      faction: Option.none(),
      standing: { kind: "puppet", overlord: "国0" },
    });
  });

  it("should list the puppets when the nation is an overlord", () => {
    const simulation: Simulation = {
      ...SIMULATION,
      diplomacy: {
        ...openingDiplomacy(OWNERS, 2, []),
        standings: [INDEPENDENT, { kind: "puppet", overlord: 0 }],
      },
    };

    expect(summaryOf(WORLD, simulation, 0).puppets).toStrictEqual(["国1"]);
  });

  it("should name the annexer when the nation has been annexed", () => {
    const simulation: Simulation = {
      ...SIMULATION,
      diplomacy: {
        ...openingDiplomacy(OWNERS, 2, []),
        standings: [INDEPENDENT, { by: 0, kind: "annexed" }],
      },
    };

    expect(summaryOf(WORLD, simulation, 1).standing).toStrictEqual({
      by: "国0",
      kind: "annexed",
    });
  });
});
