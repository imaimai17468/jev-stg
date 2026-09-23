import { describe, expect, it } from "vite-plus/test";
import { START_CLOCK } from "./clock";
import type { NationEconomy } from "./economy";
import type { World } from "./index";
import type { Simulation } from "./simulation";
import { ranOneDay, startSimulation, withClock } from "./simulation";

/** One nation on one plain, which is the smallest world with an economy. */
const WORLD: World = {
  cellProvince: Int32Array.from([0]),
  grid: { height: 1, width: 1 },
  nations: [
    { capital: 0, colour: { blue: 0, green: 0, red: 0 }, id: 0, name: "国0" },
  ],
  owners: Int32Array.from([0]),
  provinces: [
    {
      cells: 1000,
      id: 0,
      kind: "land",
      neighbours: [],
      terrain: "plains",
      x: 0,
      y: 0,
    },
  ],
  seed: 1,
};

/** Ten military factories and nothing else, so one day changes one number. */
const IDLE: NationEconomy = {
  civilianFactories: 0,
  conscription: "volunteer",
  construction: 0,
  equipment: 0,
  manpower: 0,
  militaryFactories: 10,
  plan: "civilian",
  population: 0,
};

const RUNNING: Simulation = { clock: START_CLOCK, economies: [IDLE] };

describe(startSimulation, () => {
  it("should open on the start date when a world is generated", () => {
    expect(startSimulation(WORLD)).toStrictEqual({
      clock: { days: 0, paused: false, speed: 2 },
      economies: [
        {
          civilianFactories: 25,
          conscription: "volunteer",
          construction: 0,
          equipment: 0,
          manpower: 450_000,
          militaryFactories: 5,
          plan: "civilian",
          population: 30_000_000,
        },
      ],
    });
  });
});

describe(ranOneDay, () => {
  it("should move the calendar and every economy together when a day passes", () => {
    expect(ranOneDay(RUNNING)).toStrictEqual({
      clock: { days: 1, paused: false, speed: 2 },
      economies: [{ ...IDLE, equipment: 50 }],
    });
  });
});

describe(withClock, () => {
  it("should leave the economies alone when the calendar is paused", () => {
    expect(
      withClock(RUNNING, { days: 4, paused: true, speed: 5 })
    ).toStrictEqual({
      clock: { days: 4, paused: true, speed: 5 },
      economies: [IDLE],
    });
  });
});
