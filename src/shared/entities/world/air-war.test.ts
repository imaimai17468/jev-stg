import { describe, expect, it } from "vite-plus/test";
import { foughtInTheAir } from "./air-combat";
import type { AirForce, Wing } from "./air-force";
import { NO_AIR_FORCE } from "./air-force";
import type { AirDay, Airfields, Hangars } from "./air-war";
import { airWarOneDay } from "./air-war";
import {
  AIR_GRAPH,
  AIR_OWNERS,
  AIR_PEACE,
  AIR_WAR,
  AIR_WORLD,
  airForceOf,
  flying,
  wing,
} from "./air-war-fixture";
import type { NationEconomy } from "./economy";
import { NO_ECONOMY } from "./economy";
import type { Invasion } from "./invasion";
import { replacedAt } from "./lookup";
import type { Mission, Navy, TaskForce } from "./navy";
import { NO_NAVY } from "./navy";
import type { Ship } from "./ships";
import { launched } from "./ships";
import { UNASSIGNED } from "./spread";
import { declared } from "./wars";

/** A level of air base on each province of the land, room for 200 planes each. */
const ONE_LEVEL_EACH = Uint8Array.from([1, 1, 1, 1, 1, 0, 0]);

/** A stockpile of fuel far above what any test's planes burn in a day. */
const FULL_TANKS: NationEconomy = { ...NO_ECONOMY, fuel: 10_000 };

const HANGARS: Hangars = {
  airBases: ONE_LEVEL_EACH,
  airForces: [NO_AIR_FORCE, NO_AIR_FORCE, NO_AIR_FORCE],
  economies: [FULL_TANKS, FULL_TANKS, FULL_TANKS],
  navies: [NO_NAVY, NO_NAVY, NO_NAVY],
};

/** Nobody in the air yesterday. */
const CLEAR_SKIES: readonly Float32Array[] = AIR_WORLD.nations.map(
  () => new Float32Array(AIR_WORLD.airspace.regions.length)
);

/** Nations 0 and 1 at war, nobody at sea, and nobody in the air yesterday. */
const AT_WAR: Airfields = {
  diplomacy: AIR_WAR,
  flown: CLEAR_SKIES,
  graph: AIR_GRAPH,
  homes: [UNASSIGNED, UNASSIGNED, UNASSIGNED],
  invasions: [],
  musters: [0, 3, 4],
  owners: AIR_OWNERS,
  world: AIR_WORLD,
};

const AT_PEACE: Airfields = { ...AT_WAR, diplomacy: AIR_PEACE };

/** One nation's changes to the hangars. */
interface Arm {
  readonly nation: number;
  readonly airForce?: AirForce;
  readonly navy?: Navy;
  readonly economy?: NationEconomy;
}

/** The hangars with each of `arms` put in for its nation. */
const hangarsWith = (...arms: readonly Arm[]): Hangars => ({
  ...HANGARS,
  airForces: HANGARS.airForces.map(
    (held, nation) =>
      arms.find((arm) => arm.nation === nation)?.airForce ?? held
  ),
  economies: HANGARS.economies.map(
    (held, nation) => arms.find((arm) => arm.nation === nation)?.economy ?? held
  ),
  navies: HANGARS.navies.map(
    (held, nation) => arms.find((arm) => arm.nation === nation)?.navy ?? held
  ),
});

/** A navy whose battle fleet is `ships` on `mission` in `zone`, and nothing else afloat. */
const navyAt = (
  zone: number,
  ships: readonly Ship[],
  mission: Mission = "patrol"
): Navy => ({
  ...NO_NAVY,
  fleets: replacedAt(NO_NAVY.fleets, 0, {
    mission,
    role: "main",
    ships,
    zone,
  }),
});

/** A carrier with `planes` aboard. */
const carrier = (planes: number): Ship => ({ ...launched("carrier"), planes });

/** The flight a wing of `aircraft` fully fuelled and uncrowded sends up for `nation`. */
const flightOf = (
  nationId: number,
  aircraft: Wing["aircraft"],
  planes: number
) => ({ aircraft, efficiency: 1, nation: nationId, planes });

/** The wings of `nation` after `day`. */
const wingsOf = (day: AirDay, nationId: number) =>
  day.airForces[nationId]?.wings;

/** The battle fleet of `nation` after `day`. */
const mainFleetOf = (day: AirDay, nationId: number) =>
  day.navies[nationId]?.fleets[0];

/** `value` to three decimal places, which is as far as the tests read a day's fractions. */
const rounded = (value: number): number => Math.round(value * 1000) / 1000;

/** `ship` left with `hp` and `organisation` after a strike. */
const struck = (ship: Ship, hp: number, organisation: number): Ship => ({
  ...ship,
  hp,
  organisation,
});

/** `force` with its ships' hulls and cohesion rounded as `rounded` reads them. */
const withRoundedShips = (force: TaskForce): TaskForce => ({
  ...force,
  ships: force.ships.map((ship) => ({
    ...ship,
    hp: rounded(ship.hp),
    organisation: rounded(ship.organisation),
  })),
});

describe(airWarOneDay, () => {
  it("should move a wing to the roomiest base its nation holds when its own base has fallen", () => {
    const day = airWarOneDay(
      {
        ...hangarsWith({
          airForce: airForceOf([
            wing({ aircraft: "fighter", base: 2, planes: 50 }),
          ]),
          nation: 0,
        }),
        airBases: Uint8Array.from([1, 2, 1, 1, 1, 0, 0]),
      },
      AT_PEACE
    );

    expect(wingsOf(day, 0)).toStrictEqual([
      wing({ aircraft: "fighter", base: 1, planes: 50 }),
    ]);
  });

  it("should lose a wing when its base has fallen and its nation holds no other", () => {
    const day = airWarOneDay(
      {
        ...hangarsWith({
          airForce: airForceOf([
            wing({ aircraft: "fighter", base: 2, planes: 50 }),
          ]),
          nation: 0,
        }),
        airBases: Uint8Array.from([0, 0, 1, 1, 1, 0, 0]),
      },
      AT_PEACE
    );

    expect(wingsOf(day, 0)).toStrictEqual([]);
  });

  it("should land one wing at each base when two wings whose base has fallen would crowd one", () => {
    const day = airWarOneDay(
      hangarsWith({
        airForce: airForceOf([
          wing({ aircraft: "fighter", base: 2, planes: 100 }),
          wing({ aircraft: "fighter", base: 2, planes: 100 }),
        ]),
        nation: 0,
      }),
      AT_PEACE
    );

    expect(wingsOf(day, 0)).toStrictEqual([
      wing({ aircraft: "fighter", base: 0, planes: 100 }),
      wing({ aircraft: "fighter", base: 1, planes: 100 }),
    ]);
  });

  it("should keep a wing on standby at its new base for the day when its base has fallen at war", () => {
    const day = airWarOneDay(
      hangarsWith({
        airForce: airForceOf([
          wing({ aircraft: "fighter", base: 2, planes: 50 }),
        ]),
        nation: 0,
      }),
      AT_WAR
    );

    expect(wingsOf(day, 0)).toStrictEqual([
      wing({ aircraft: "fighter", base: 0, planes: 50 }),
    ]);
  });

  it("should send every wing back to its base when its nation is at peace", () => {
    const day = airWarOneDay(
      hangarsWith({
        airForce: airForceOf([
          flying(wing({ aircraft: "fighter", base: 0, planes: 50 }), {
            mission: "superiority",
            region: 1,
          }),
        ]),
        nation: 0,
      }),
      AT_PEACE
    );

    expect(wingsOf(day, 0)).toStrictEqual([
      wing({ aircraft: "fighter", base: 0, planes: 50 }),
    ]);
  });

  it.each<{
    condition: string;
    hangars: Hangars;
    fields: Airfields;
    nation: number;
    ordered: Wing;
  }>([
    {
      condition: "a fighter has the front in range",
      fields: AT_WAR,
      hangars: hangarsWith({
        airForce: airForceOf([
          wing({ aircraft: "fighter", base: 0, planes: 50 }),
        ]),
        nation: 0,
      }),
      nation: 0,
      ordered: flying(wing({ aircraft: "fighter", base: 0, planes: 50 }), {
        mission: "superiority",
        region: 1,
      }),
    },
    {
      condition: "the enemy flew over one of two front regions yesterday",
      fields: {
        ...AT_WAR,
        flown: replacedAt(
          CLEAR_SKIES,
          1,
          Float32Array.from([0, 0, 10, 0, 0, 0])
        ),
      },
      hangars: hangarsWith({
        airForce: airForceOf([
          wing({ aircraft: "fighter", base: 1, planes: 50 }),
        ]),
        nation: 0,
      }),
      nation: 0,
      ordered: flying(wing({ aircraft: "fighter", base: 1, planes: 50 }), {
        mission: "superiority",
        region: 2,
      }),
    },
    {
      condition: "its own task force is at sea in range",
      fields: AT_WAR,
      hangars: hangarsWith({
        airForce: airForceOf([
          wing({ aircraft: "fighter", base: 3, planes: 50 }),
        ]),
        nation: 1,
        navy: navyAt(5, [launched("destroyer")]),
      }),
      nation: 1,
      ordered: flying(wing({ aircraft: "fighter", base: 3, planes: 50 }), {
        mission: "superiority",
        region: 4,
      }),
    },
    {
      condition: "its landing crosses a zone in range",
      fields: {
        ...AT_WAR,
        invasions: [
          {
            convoys: 5,
            crossing: "landing",
            divisions: [],
            lane: [5],
            nation: 1,
            readyOn: 0,
            target: 0,
          } satisfies Invasion,
        ],
      },
      hangars: hangarsWith({
        airForce: airForceOf([
          wing({ aircraft: "fighter", base: 3, planes: 50 }),
        ]),
        nation: 1,
      }),
      nation: 1,
      ordered: flying(wing({ aircraft: "fighter", base: 3, planes: 50 }), {
        mission: "superiority",
        region: 4,
      }),
    },
    {
      condition: "its task force in range is making for port to repair",
      fields: AT_WAR,
      hangars: hangarsWith({
        airForce: airForceOf([
          wing({ aircraft: "fighter", base: 3, planes: 50 }),
        ]),
        nation: 1,
        navy: navyAt(5, [launched("destroyer")], "repair"),
      }),
      nation: 1,
      ordered: flying(wing({ aircraft: "fighter", base: 3, planes: 50 }), {
        mission: "superiority",
        region: 2,
      }),
    },
    {
      condition: "its task force in range has no ships left",
      fields: AT_WAR,
      hangars: hangarsWith({
        airForce: airForceOf([
          wing({ aircraft: "fighter", base: 3, planes: 50 }),
        ]),
        nation: 1,
        navy: navyAt(5, []),
      }),
      nation: 1,
      ordered: flying(wing({ aircraft: "fighter", base: 3, planes: 50 }), {
        mission: "superiority",
        region: 2,
      }),
    },
    {
      condition: "a close support wing has the front in range",
      fields: AT_WAR,
      hangars: hangarsWith({
        airForce: airForceOf([
          wing({ aircraft: "close-support", base: 0, planes: 50 }),
        ]),
        nation: 0,
      }),
      nation: 0,
      ordered: flying(
        wing({ aircraft: "close-support", base: 0, planes: 50 }),
        { mission: "close-support", region: 1 }
      ),
    },
    {
      condition: "a naval bomber has enemy warships at sea in range",
      fields: AT_WAR,
      hangars: hangarsWith(
        {
          airForce: airForceOf([
            wing({ aircraft: "naval-bomber", base: 3, planes: 50 }),
          ]),
          nation: 1,
        },
        { nation: 0, navy: navyAt(5, [launched("battleship")]) }
      ),
      nation: 1,
      ordered: flying(wing({ aircraft: "naval-bomber", base: 3, planes: 50 }), {
        mission: "naval-strike",
        region: 4,
      }),
    },
    {
      condition:
        "a naval bomber has no enemy warship in range and its nation holds a base in range of one",
      fields: AT_WAR,
      hangars: hangarsWith(
        {
          airForce: airForceOf([
            wing({ aircraft: "naval-bomber", base: 2, planes: 50 }),
          ]),
          nation: 1,
        },
        { nation: 0, navy: navyAt(5, [launched("battleship")]) }
      ),
      nation: 1,
      ordered: wing({ aircraft: "naval-bomber", base: 3, planes: 50 }),
    },
    {
      condition:
        "a naval bomber has no enemy warship in range and its nation holds no base in range of one",
      fields: AT_WAR,
      hangars: hangarsWith(
        {
          airForce: airForceOf([
            wing({ aircraft: "naval-bomber", base: 0, planes: 50 }),
          ]),
          nation: 0,
        },
        { nation: 1, navy: navyAt(5, [launched("battleship")]) }
      ),
      nation: 0,
      ordered: wing({ aircraft: "naval-bomber", base: 0, planes: 50 }),
    },
    {
      condition: "a naval bomber's enemy has no warship at sea anywhere",
      fields: AT_WAR,
      hangars: hangarsWith({
        airForce: airForceOf([
          wing({ aircraft: "naval-bomber", base: 0, planes: 50 }),
        ]),
        nation: 0,
      }),
      nation: 0,
      ordered: wing({ aircraft: "naval-bomber", base: 0, planes: 50 }),
    },
  ])(
    "should give the wing its orders when $condition",
    ({ fields, hangars, nation, ordered }) => {
      expect(wingsOf(airWarOneDay(hangars, fields), nation)).toStrictEqual([
        ordered,
      ]);
    }
  );

  it("should send a second wing of a kind over another region when the first already covers the one wanted most", () => {
    const day = airWarOneDay(
      hangarsWith({
        airForce: airForceOf([
          wing({ aircraft: "close-support", base: 1, planes: 100 }),
          wing({ aircraft: "close-support", base: 1, planes: 100 }),
        ]),
        nation: 0,
      }),
      AT_WAR
    );

    expect(wingsOf(day, 0)?.map((sent) => sent.region)).toStrictEqual([1, 2]);
  });

  it("should move two idle naval bombers to different bases when the roomiest base in range of the enemy cannot hold both", () => {
    const day = airWarOneDay(
      hangarsWith(
        {
          airForce: airForceOf([
            wing({ aircraft: "naval-bomber", base: 2, planes: 150 }),
            wing({ aircraft: "naval-bomber", base: 2, planes: 150 }),
          ]),
          nation: 1,
        },
        { nation: 0, navy: navyAt(5, [launched("battleship")]) }
      ),
      {
        ...AT_WAR,
        owners: Int32Array.from([0, 0, 1, 1, 1, UNASSIGNED, UNASSIGNED]),
      }
    );

    expect(wingsOf(day, 1)).toStrictEqual([
      wing({ aircraft: "naval-bomber", base: 3, planes: 150 }),
      wing({ aircraft: "naval-bomber", base: 4, planes: 150 }),
    ]);
  });

  it.each<{ condition: string; fuel: number; power: number }>([
    { condition: "the stockpile covers the day", fuel: 10_000, power: 50 },
    {
      condition: "the stockpile covers half the day",
      fuel: 44.1,
      power: 31.25,
    },
    { condition: "the stockpile is empty", fuel: 0, power: 12.5 },
  ])(
    "should fly $power of 50 fighters' air power when $condition",
    ({ fuel, power }) => {
      const day = airWarOneDay(
        hangarsWith({
          airForce: airForceOf([
            wing({ aircraft: "fighter", base: 0, planes: 50 }),
          ]),
          economy: { ...NO_ECONOMY, fuel },
          nation: 0,
        }),
        AT_WAR
      );

      expect(day.power[0]?.[1]).toBeCloseTo(power);
    }
  );

  it("should burn the fuel of the wings sent out when a nation is at war", () => {
    const economy: NationEconomy = { ...NO_ECONOMY, fuel: 1000 };

    const day = airWarOneDay(
      hangarsWith({
        airForce: airForceOf([
          wing({ aircraft: "fighter", base: 0, planes: 50 }),
        ]),
        economy,
        nation: 0,
      }),
      AT_WAR
    );

    expect({
      burned: rounded(day.economies[0]?.burned ?? 0),
      fuel: rounded(day.economies[0]?.fuel ?? 0),
    }).toStrictEqual({ burned: 88.2, fuel: 911.8 });
  });

  it("should take the planes the air battle brought down off the wing when two enemies meet over one region", () => {
    const fighters = wing({ aircraft: "fighter", base: 1, planes: 50 });
    const [left] = foughtInTheAir(
      [flightOf(0, "fighter", 50), flightOf(1, "fighter", 50)],
      AIR_WAR.wars
    );

    const day = airWarOneDay(
      hangarsWith(
        { airForce: airForceOf([fighters]), nation: 0 },
        {
          airForce: airForceOf([
            wing({ aircraft: "fighter", base: 2, planes: 50 }),
          ]),
          nation: 1,
        }
      ),
      {
        ...AT_WAR,
        flown: replacedAt(
          CLEAR_SKIES,
          1,
          Float32Array.from([0, 0, 10, 0, 0, 0])
        ),
      }
    );

    expect(wingsOf(day, 0)).toStrictEqual([
      {
        ...flying(fighters, { mission: "superiority", region: 2 }),
        planes: left?.planes,
      },
    ]);
  });

  it("should break up a wing when it has less than half a plane left", () => {
    const day = airWarOneDay(
      hangarsWith({
        airForce: airForceOf([
          wing({ aircraft: "close-support", base: 0, planes: 0.4 }),
        ]),
        nation: 0,
      }),
      AT_PEACE
    );

    expect(wingsOf(day, 0)).toStrictEqual([]);
  });

  it("should take the planes the air battle brought down off the carrier's deck when enemy fighters meet them at sea", () => {
    const after = foughtInTheAir(
      [
        flightOf(1, "fighter", 50),
        flightOf(0, "fighter", 10),
        flightOf(0, "naval-bomber", 10),
      ],
      AIR_WAR.wars
    );

    const day = airWarOneDay(
      hangarsWith(
        { nation: 0, navy: navyAt(5, [carrier(20), launched("destroyer")]) },
        {
          airForce: airForceOf([
            wing({ aircraft: "fighter", base: 3, planes: 50 }),
          ]),
          nation: 1,
        }
      ),
      {
        ...AT_WAR,
        flown: replacedAt(
          CLEAR_SKIES,
          0,
          Float32Array.from([0, 0, 0, 0, 20, 0])
        ),
      }
    );

    expect(mainFleetOf(day, 0)?.ships).toStrictEqual([
      {
        ...carrier(20),
        planes: (after[1]?.planes ?? 0) + (after[2]?.planes ?? 0),
      },
      launched("destroyer"),
    ]);
  });

  it.each<{
    condition: string;
    diplomacy: Airfields["diplomacy"];
    mission: Mission;
    power: number;
  }>([
    {
      condition: "its nation is at war",
      diplomacy: AIR_WAR,
      mission: "patrol",
      power: 20,
    },
    {
      condition: "its nation is at peace",
      diplomacy: AIR_PEACE,
      mission: "patrol",
      power: 0,
    },
    {
      condition: "its task force is making for port to repair",
      diplomacy: AIR_WAR,
      mission: "repair",
      power: 0,
    },
  ])(
    "should fly $power planes off a carrier at sea when $condition",
    ({ diplomacy, mission, power }) => {
      const day = airWarOneDay(
        hangarsWith({ nation: 0, navy: navyAt(5, [carrier(20)], mission) }),
        { ...AT_WAR, diplomacy }
      );

      expect(day.power[0]?.[4]).toBe(power);
    }
  );

  it("should fly a quarter of a carrier's planes as air power when its nation at war has no fuel", () => {
    const day = airWarOneDay(
      hangarsWith({
        economy: NO_ECONOMY,
        nation: 0,
        navy: navyAt(5, [carrier(20)]),
      }),
      AT_WAR
    );

    expect(day.power[0]?.[4]).toBeCloseTo(5);
  });

  it("should burn the fuel of a carrier's planes at sea when its nation is at war", () => {
    const day = airWarOneDay(
      hangarsWith({
        economy: { ...NO_ECONOMY, fuel: 1000 },
        nation: 0,
        navy: navyAt(5, [carrier(20)]),
      }),
      AT_WAR
    );

    expect({
      burned: rounded(day.economies[0]?.burned ?? 0),
      fuel: rounded(day.economies[0]?.fuel ?? 0),
    }).toStrictEqual({ burned: 41.16, fuel: 958.84 });
  });

  it("should leave the enemy's ships to the battle at sea when only a carrier's naval bombers fly over them", () => {
    const enemy = navyAt(5, [launched("battleship")]);

    const day = airWarOneDay(
      hangarsWith(
        { nation: 0, navy: navyAt(5, [carrier(20)]) },
        { nation: 1, navy: enemy }
      ),
      AT_WAR
    );

    expect(day.navies[1]).toStrictEqual(enemy);
  });

  it("should leave a sunk task force empty when a second enemy's naval bombers find nothing left in the region", () => {
    const day = airWarOneDay(
      hangarsWith(
        {
          airForce: airForceOf([
            wing({ aircraft: "naval-bomber", base: 3, planes: 100 }),
          ]),
          nation: 1,
        },
        {
          airForce: airForceOf([
            wing({ aircraft: "naval-bomber", base: 4, planes: 100 }),
          ]),
          nation: 2,
        },
        { nation: 0, navy: navyAt(5, [{ ...launched("destroyer"), hp: 1 }]) }
      ),
      {
        ...AT_WAR,
        diplomacy: {
          ...AIR_WAR,
          wars: declared(AIR_WAR.wars, { one: 0, other: 2 }),
        },
      }
    );

    expect(mainFleetOf(day, 0)?.ships).toStrictEqual([]);
  });

  /** Nation 0's escort, in the zone beyond the one the strikes go in. */
  const ESCORT: TaskForce = {
    mission: "patrol",
    role: "escort",
    ships: [launched("destroyer")],
    zone: 6,
  };

  it.each<{
    condition: string;
    bombers: number;
    ships: readonly Ship[];
    after: readonly Ship[];
  }>([
    {
      after: [
        struck(launched("destroyer"), 31.006, 20.01),
        struck(launched("cruiser"), 85.266, 0),
      ],
      bombers: 100,
      condition:
        "twenty of them strike, the damage spread by how strongly each ship draws them",
      ships: [launched("destroyer"), launched("cruiser")],
    },
    {
      after: [
        struck(launched("destroyer"), 35.503, 27.505),
        struck(launched("cruiser"), 97.633, 19.389),
      ],
      bombers: 10,
      condition: "fewer than twenty bombers fly",
      ships: [launched("destroyer"), launched("cruiser")],
    },
    {
      after: Array.from({ length: 5 }, () =>
        struck(launched("battleship"), 338.802, 0)
      ),
      bombers: 200,
      condition: "a twentieth of the fleet's hull is more than twenty",
      ships: Array.from({ length: 5 }, () => launched("battleship")),
    },
    {
      after: [struck(launched("cruiser"), 85.266, 0)],
      bombers: 100,
      condition: "a ship's hull is gone under them",
      ships: [{ ...launched("destroyer"), hp: 1 }, launched("cruiser")],
    },
  ])(
    "should strike the enemy's task force in the region when $condition",
    ({ after, bombers, ships }) => {
      const navy = navyAt(5, ships);

      const day = airWarOneDay(
        hangarsWith(
          {
            airForce: airForceOf([
              wing({ aircraft: "naval-bomber", base: 3, planes: bombers }),
            ]),
            nation: 1,
          },
          {
            nation: 0,
            navy: { ...navy, fleets: replacedAt(navy.fleets, 1, ESCORT) },
          }
        ),
        AT_WAR
      );

      expect(day.navies[0]?.fleets.map(withRoundedShips)).toStrictEqual([
        { mission: "patrol", role: "main", ships: after, zone: 5 },
        ESCORT,
        NO_NAVY.fleets[2],
      ]);
    }
  );

  it("should leave an enemy task force alone when it is making for port to repair in the struck region", () => {
    const repairing: TaskForce = {
      mission: "repair",
      role: "escort",
      ships: [launched("cruiser")],
      zone: 5,
    };
    const navy = navyAt(5, [launched("destroyer")]);

    const day = airWarOneDay(
      hangarsWith(
        {
          airForce: airForceOf([
            wing({ aircraft: "naval-bomber", base: 3, planes: 100 }),
          ]),
          nation: 1,
        },
        {
          nation: 0,
          navy: { ...navy, fleets: replacedAt(navy.fleets, 1, repairing) },
        }
      ),
      AT_WAR
    );

    expect(day.navies[0]?.fleets[1]).toStrictEqual(repairing);
  });

  it.each<{
    condition: string;
    wings: readonly Wing[];
    mission: Mission;
    zone: number;
    after: { readonly deck: number; readonly wings: readonly Wing[] };
  }>([
    {
      after: {
        deck: 20,
        wings: [
          wing({ aircraft: "fighter", base: 0, planes: 85 }),
          wing({ aircraft: "naval-bomber", base: 0, planes: 50 }),
          wing({ aircraft: "close-support", base: 0, planes: 30 }),
        ],
      },
      condition: "the fullest wing has more than the deck has room for",
      mission: "repair",
      wings: [
        wing({ aircraft: "fighter", base: 0, planes: 100 }),
        wing({ aircraft: "naval-bomber", base: 0, planes: 50 }),
        wing({ aircraft: "close-support", base: 0, planes: 30 }),
      ],
      zone: 5,
    },
    {
      after: {
        deck: 15,
        wings: [wing({ aircraft: "close-support", base: 0, planes: 30 })],
      },
      condition: "the fighters and naval bombers all fit aboard",
      mission: "repair",
      wings: [
        wing({ aircraft: "fighter", base: 0, planes: 6 }),
        wing({ aircraft: "naval-bomber", base: 0, planes: 4 }),
        wing({ aircraft: "close-support", base: 0, planes: 30 }),
      ],
      zone: 5,
    },
    {
      after: {
        deck: 5,
        wings: [wing({ aircraft: "fighter", base: 0, planes: 100 })],
      },
      condition: "the carrier is at its home port on patrol",
      mission: "patrol",
      wings: [wing({ aircraft: "fighter", base: 0, planes: 100 })],
      zone: 5,
    },
    {
      after: {
        deck: 5,
        wings: [wing({ aircraft: "fighter", base: 0, planes: 100 })],
      },
      condition: "the carrier is repairing away from its home port",
      mission: "repair",
      wings: [wing({ aircraft: "fighter", base: 0, planes: 100 })],
      zone: 6,
    },
  ])(
    "should refill the carrier's deck from the wings as far as it can when $condition",
    ({ after, mission, wings, zone }) => {
      const day = airWarOneDay(
        hangarsWith({
          airForce: airForceOf(wings),
          nation: 0,
          navy: navyAt(zone, [carrier(5)], mission),
        }),
        { ...AT_PEACE, homes: [5, UNASSIGNED, UNASSIGNED] }
      );

      expect({
        deck: mainFleetOf(day, 0)?.ships[0]?.planes,
        wings: wingsOf(day, 0),
      }).toStrictEqual(after);
    }
  );

  it.each<{
    condition: string;
    bases: readonly number[];
    wings: readonly Wing[];
    construction: number;
    muster: number;
    after: { readonly bases: readonly number[]; readonly construction: number };
  }>([
    {
      after: { bases: [2, 1, 1, 1, 1, 0, 0], construction: 750 },
      bases: [1, 1, 1, 1, 1, 0, 0],
      condition:
        "its planes fill its bases and its construction pays for a level",
      construction: 2000,
      muster: 0,
      wings: [
        wing({ aircraft: "fighter", base: 0, planes: 190 }),
        wing({ aircraft: "fighter", base: 1, planes: 190 }),
      ],
    },
    {
      after: { bases: [1, 1, 1, 1, 1, 0, 0], construction: 1000 },
      bases: [1, 1, 1, 1, 1, 0, 0],
      condition: "its construction falls short of a level",
      construction: 1000,
      muster: 0,
      wings: [
        wing({ aircraft: "fighter", base: 0, planes: 190 }),
        wing({ aircraft: "fighter", base: 1, planes: 190 }),
      ],
    },
    {
      after: { bases: [10, 0, 1, 1, 1, 0, 0], construction: 2000 },
      bases: [10, 0, 1, 1, 1, 0, 0],
      condition:
        "its one base is built all the way and its muster stands on it",
      construction: 2000,
      muster: 0,
      wings: [wing({ aircraft: "fighter", base: 0, planes: 1900 })],
    },
    {
      after: { bases: [0, 0, 1, 1, 1, 0, 0], construction: 2000 },
      bases: [0, 0, 1, 1, 1, 0, 0],
      condition:
        "it holds no base and its muster stands on another nation's ground",
      construction: 2000,
      muster: 2,
      wings: [],
    },
    {
      after: { bases: [1, 0, 1, 1, 1, 0, 0], construction: 750 },
      bases: [0, 0, 1, 1, 1, 0, 0],
      condition: "it holds no base and its muster stands on its own ground",
      construction: 2000,
      muster: 0,
      wings: [],
    },
  ])(
    "should build air bases as its construction allows when $condition",
    ({ after, bases, construction, muster, wings }) => {
      const day = airWarOneDay(
        {
          ...hangarsWith({
            airForce: airForceOf(wings),
            economy: { ...NO_ECONOMY, construction },
            nation: 0,
          }),
          airBases: Uint8Array.from(bases),
        },
        { ...AT_PEACE, musters: [muster, 3, 4] }
      );

      expect({
        bases: [...day.airBases],
        construction: day.economies[0]?.construction,
      }).toStrictEqual(after);
    }
  );

  it("should report the air power and the close air support each nation flew over each region when a day ends", () => {
    const day = airWarOneDay(
      hangarsWith({
        airForce: airForceOf([
          wing({ aircraft: "close-support", base: 1, planes: 50 }),
        ]),
        nation: 0,
      }),
      AT_WAR
    );

    expect({ power: day.power, support: day.support }).toStrictEqual({
      power: [
        Float32Array.from([0, 50, 0, 0, 0, 0]),
        new Float32Array(6),
        new Float32Array(6),
      ],
      support: [
        Float32Array.from([0, 50, 0, 0, 0, 0]),
        new Float32Array(6),
        new Float32Array(6),
      ],
    });
  });
});
