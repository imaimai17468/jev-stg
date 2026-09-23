import { describe, expect, it } from "vite-plus/test";
import { division } from "./army-fixture";
import type { Diplomacy } from "./diplomacy";
import { joined, openingDiplomacy } from "./diplomacy";
import { FUEL_CAPACITY, SHIP_FUEL_PER_DAY } from "./fuel";
import type { Invasion } from "./invasion";
import { itemAt } from "./lookup";
import type { Coasts, Seas } from "./maritime";
import { homeZonesOf, overseasRivals, seafaredOneDay } from "./maritime";
import { NO_MODIFIERS } from "./modifiers";
import { musteringAt } from "./muster";
import type { FleetRole, Lane, Navy, TaskForce } from "./navy";
import { NO_NAVY } from "./navy";
import {
  ISLES_GRAPH,
  ISLES_OWNERS,
  ISLES_PEACE,
  ISLES_WAR,
  ISLES_WORLD,
} from "./sea-fixture";
import { landmassesOf } from "./seas";
import type { ShipClass } from "./ships";
import { hullOf, launched } from "./ships";
import { UNASSIGNED } from "./spread";
import type { Deal } from "./trade";

/** A patrolling task force of `role` in `zone` with one fresh ship of `shipClass`. */
const force = (
  role: FleetRole,
  shipClass: ShipClass,
  zone: number
): TaskForce => ({
  mission: "patrol",
  role,
  ships: [launched(shipClass)],
  zone,
});

/** A battleship, a destroyer and a submarine off nation 0's port, and twenty convoys. */
const FLEET: Navy = {
  ...NO_NAVY,
  convoys: 20,
  fleets: [
    force("main", "battleship", 5),
    force("escort", "destroyer", 5),
    force("raiders", "submarine", 5),
  ],
};

/** A battleship off nation 1's port and nothing else. */
const EASTERN_FLEET: Navy = {
  ...NO_NAVY,
  fleets: [force("main", "battleship", 6), ...NO_NAVY.fleets.slice(1)],
};

/** A day at sea on the islands with `owners` under `diplomacy`. */
const coastsOn = (
  owners: Int32Array,
  diplomacy: Diplomacy,
  day: number,
  deals: readonly Deal[]
): Coasts => ({
  day,
  deals,
  diplomacy,
  fuel: [FUEL_CAPACITY, FUEL_CAPACITY],
  graph: ISLES_GRAPH,
  homes: homeZonesOf(ISLES_WORLD, owners),
  landmasses: landmassesOf(ISLES_GRAPH),
  lift: [],
  lines: {
    diplomacy,
    divisions: [],
    graph: ISLES_GRAPH,
    modifiers: [NO_MODIFIERS, NO_MODIFIERS],
    owners,
    shipped: [1, 1],
    upkeepMet: [1, 1],
    world: ISLES_WORLD,
  },
  musters: ISLES_WORLD.nations.map((nation) =>
    musteringAt(ISLES_WORLD, owners, nation)
  ),
  owners,
  world: ISLES_WORLD,
});

/** The islands at war as they open, on the first day, with nothing traded. */
const AT_WAR = coastsOn(ISLES_OWNERS, ISLES_WAR, 0, []);

/** Where each of the navy's task forces is and what it is doing. */
const ordersOf = (navies: readonly Navy[], nation: number) =>
  itemAt(navies, nation, NO_NAVY).fleets.map(({ mission, zone }) => ({
    mission,
    zone,
  }));

/** Nation 0's landing on province 2 over zones 5 and 6, ready on day 14. */
const LANDING: Invasion = {
  convoys: 5,
  crossing: "landing",
  divisions: [division({ marched: 1, movingTo: 3, nation: 0, province: 0 })],
  lane: [5, 6],
  nation: 0,
  readyOn: 14,
  target: 2,
};

/** The same landing, ready today. */
const READY_LANDING: Invasion = { ...LANDING, readyOn: 0 };

/** Nation 0's transfer to province 3, ready today. */
const TRANSFER: Invasion = {
  ...READY_LANDING,
  crossing: "transfer",
  target: 3,
};

/** The islands with nation 0 holding province 3 on the eastern one. */
const BEACHHEAD_OWNERS = Int32Array.from([
  0,
  0,
  1,
  0,
  1,
  UNASSIGNED,
  UNASSIGNED,
]);

/** Nation 1 selling nation 0 twenty-five units of steel. */
const STEEL: Deal = {
  delivered: 25,
  exporter: 1,
  factories: 1,
  importer: 0,
  resource: "steel",
  units: 25,
};

/** The seas with nation 0's fleet out, nation 1's navy empty, and nothing else. */
const QUIET_SEAS: Seas = {
  divisions: [],
  invasions: [],
  navies: [FLEET, NO_NAVY],
};

/** The lanes the navy of `nation` ran today. */
const lanesOf = (navies: readonly Navy[], nation: number): readonly Lane[] =>
  itemAt(navies, nation, NO_NAVY).lanes;

describe(homeZonesOf, () => {
  it("should open each nation's port onto the zone off the coast nearest its capital when both islands have one", () => {
    expect(homeZonesOf(ISLES_WORLD, ISLES_OWNERS)).toStrictEqual([5, 6]);
  });

  it("should read unassigned for a nation that holds no ground when it has no port", () => {
    expect(
      homeZonesOf(ISLES_WORLD, Int32Array.from([0, 0, 0, 0, 0, -1, -1]))
    ).toStrictEqual([5, UNASSIGNED]);
  });
});

describe(seafaredOneDay, () => {
  it("should prepare a landing on the least guarded enemy coast when a nation has spare divisions, convoys and a fleet", () => {
    const seas: Seas = {
      ...QUIET_SEAS,
      divisions: [
        division({ nation: 0, province: 0 }),
        division({ nation: 0, province: 1 }),
        division({ nation: 1, province: 3 }),
        division({ nation: 1, province: 3 }),
      ],
    };

    expect(seafaredOneDay(seas, AT_WAR).invasions).toStrictEqual([
      {
        convoys: 10,
        crossing: "landing",
        divisions: [
          division({ nation: 0, province: 0 }),
          division({ nation: 0, province: 1 }),
        ],
        lane: [5, 6],
        nation: 0,
        readyOn: 14,
        target: 2,
      },
    ]);
  });

  it("should take the divisions of a new landing out of the line when it is prepared", () => {
    const seas: Seas = {
      ...QUIET_SEAS,
      divisions: [
        division({ nation: 0, province: 0 }),
        division({ nation: 1, province: 3 }),
      ],
    };

    expect(seafaredOneDay(seas, AT_WAR).divisions).toStrictEqual([
      division({ nation: 1, province: 3 }),
    ]);
  });

  it("should prepare no landing when the nation's ground borders its enemy over land", () => {
    const seas: Seas = {
      ...QUIET_SEAS,
      divisions: [division({ nation: 0, province: 0 })],
    };
    const bordering = coastsOn(
      Int32Array.from([0, 1, 1, 1, 1, UNASSIGNED, UNASSIGNED]),
      ISLES_WAR,
      0,
      []
    );

    expect(seafaredOneDay(seas, bordering).invasions).toStrictEqual([]);
  });

  it("should send the battle fleet to strike across the lane when its nation has a landing in preparation", () => {
    const seas: Seas = {
      ...QUIET_SEAS,
      divisions: [division({ nation: 0, province: 0 })],
      invasions: [LANDING],
    };

    expect(
      itemAt(ordersOf(seafaredOneDay(seas, AT_WAR).navies, 0), 0, {
        mission: "repair",
        zone: UNASSIGNED,
      })
    ).toStrictEqual({ mission: "strike", zone: 6 });
  });

  it("should keep a landing in preparation and plan no second one when it is not ready", () => {
    const seas: Seas = {
      ...QUIET_SEAS,
      divisions: [division({ nation: 0, province: 0 })],
      invasions: [LANDING],
    };

    expect(seafaredOneDay(seas, AT_WAR).invasions).toStrictEqual([LANDING]);
  });

  it("should keep a ready landing waiting when the enemy's fleet holds a zone of its lane", () => {
    const seas: Seas = {
      divisions: [],
      invasions: [READY_LANDING],
      navies: [NO_NAVY, EASTERN_FLEET],
    };

    expect(seafaredOneDay(seas, AT_WAR).invasions).toStrictEqual([
      READY_LANDING,
    ]);
  });

  it("should report a landing that went ashore when it is ready and the sea is clear", () => {
    const seas: Seas = { ...QUIET_SEAS, invasions: [READY_LANDING] };

    expect(seafaredOneDay(seas, AT_WAR).landings).toStrictEqual([
      READY_LANDING,
    ]);
  });

  it("should stand a landing's divisions on its target, still off the beach, when it goes ashore", () => {
    const seas: Seas = { ...QUIET_SEAS, invasions: [READY_LANDING] };

    expect(seafaredOneDay(seas, AT_WAR).divisions).toStrictEqual([
      division({
        arrival: "landing",
        movingTo: 2,
        nation: 0,
        province: 2,
      }),
    ]);
  });

  it("should leave a transfer out of the day's landings when it goes ashore", () => {
    const seas: Seas = { ...QUIET_SEAS, invasions: [TRANSFER] };

    expect(
      seafaredOneDay(seas, coastsOn(BEACHHEAD_OWNERS, ISLES_WAR, 0, []))
        .landings
    ).toStrictEqual([]);
  });

  it("should stand a transfer's divisions on its beachhead on foot when it goes ashore", () => {
    const seas: Seas = { ...QUIET_SEAS, invasions: [TRANSFER] };

    expect(
      seafaredOneDay(seas, coastsOn(BEACHHEAD_OWNERS, ISLES_WAR, 0, []))
        .divisions
    ).toStrictEqual([division({ movingTo: 3, nation: 0, province: 3 })]);
  });

  it("should plan no crossing for the nation when its transfer went ashore that day", () => {
    const seas: Seas = {
      ...QUIET_SEAS,
      divisions: [division({ nation: 0, province: 0 })],
      invasions: [TRANSFER],
    };

    expect(
      seafaredOneDay(seas, coastsOn(BEACHHEAD_OWNERS, ISLES_WAR, 0, []))
        .invasions
    ).toStrictEqual([]);
  });

  it("should send a transfer to its beachhead when it holds a coast the land does not reach beside the enemy", () => {
    const seas: Seas = {
      ...QUIET_SEAS,
      divisions: [division({ nation: 0, province: 0 })],
    };

    expect(
      seafaredOneDay(seas, coastsOn(BEACHHEAD_OWNERS, ISLES_WAR, 0, []))
        .invasions
    ).toStrictEqual([
      {
        convoys: 5,
        crossing: "transfer",
        divisions: [division({ nation: 0, province: 0 })],
        lane: [5, 6],
        nation: 0,
        readyOn: 2,
        target: 3,
      },
    ]);
  });

  it("should run a convoy for each cut-off division to its beachhead when its divisions stand there", () => {
    const seas: Seas = {
      ...QUIET_SEAS,
      divisions: [division({ nation: 0, province: 0 })],
      invasions: [TRANSFER],
    };

    expect(
      lanesOf(
        seafaredOneDay(seas, coastsOn(BEACHHEAD_OWNERS, ISLES_WAR, 0, []))
          .navies,
        0
      )
    ).toStrictEqual([{ cargo: "supply", convoys: 1, zones: [5, 6] }]);
  });

  it("should bring a called-off landing's divisions home to the capital when its target is no longer enemy ground", () => {
    const seas: Seas = { ...QUIET_SEAS, invasions: [LANDING] };

    expect(
      seafaredOneDay(seas, coastsOn(ISLES_OWNERS, ISLES_PEACE, 0, [])).divisions
    ).toStrictEqual([division({ nation: 0, province: 0 })]);
  });

  it("should disband a called-off landing's divisions when their nation holds no ground to come home to", () => {
    const seas: Seas = { ...QUIET_SEAS, invasions: [LANDING] };
    const overrun = coastsOn(
      Int32Array.from([1, 1, 1, 1, 1, UNASSIGNED, UNASSIGNED]),
      ISLES_WAR,
      200,
      []
    );

    expect(seafaredOneDay(seas, overrun).divisions).toStrictEqual([]);
  });

  it("should run a trade lane from the exporter's port to the importer's when the two trade over the sea", () => {
    expect(
      lanesOf(
        seafaredOneDay(
          QUIET_SEAS,
          coastsOn(ISLES_OWNERS, ISLES_PEACE, 0, [STEEL])
        ).navies,
        0
      )
    ).toStrictEqual([{ cargo: "trade", convoys: 3, zones: [6, 5] }]);
  });

  it("should run no trade lane when the exporter or the importer has no port", () => {
    const portless = coastsOn(
      Int32Array.from([0, 0, 0, 0, 1, UNASSIGNED, UNASSIGNED]),
      ISLES_PEACE,
      0,
      [STEEL, { ...STEEL, exporter: 0, importer: 1 }]
    );

    expect(
      seafaredOneDay(QUIET_SEAS, portless).navies.map((navy) =>
        navy.lanes.filter((lane) => lane.cargo === "trade")
      )
    ).toStrictEqual([[], []]);
  });

  it("should run no supply lane when none of its divisions stands on the beachhead", () => {
    expect(
      lanesOf(
        seafaredOneDay(QUIET_SEAS, coastsOn(BEACHHEAD_OWNERS, ISLES_WAR, 0, []))
          .navies,
        0
      )
    ).toStrictEqual([]);
  });

  it("should run no trade lane when the exporter's capital shares the importer's island", () => {
    const coasts = {
      ...coastsOn(ISLES_OWNERS, ISLES_PEACE, 0, [STEEL]),
      musters: [0, 1],
    };

    expect(lanesOf(seafaredOneDay(QUIET_SEAS, coasts).navies, 0)).toStrictEqual(
      []
    );
  });

  it("should plan no crossing for the nation when its landing was called off that day", () => {
    const seas: Seas = { ...QUIET_SEAS, invasions: [LANDING] };

    expect(
      seafaredOneDay(seas, coastsOn(ISLES_OWNERS, ISLES_WAR, 200, [])).invasions
    ).toStrictEqual([]);
  });

  it("should run no supply lane to an ally's coast when the land does not reach it", () => {
    const allies = joined(openingDiplomacy(ISLES_OWNERS, 2, [0]), 1, 0);

    expect(
      lanesOf(
        seafaredOneDay(QUIET_SEAS, coastsOn(ISLES_OWNERS, allies, 0, []))
          .navies,
        0
      )
    ).toStrictEqual([]);
  });

  it("should send the escorts to the busiest zone and the raiders after the enemy's convoys when both run lanes", () => {
    const busy: Seas = {
      ...QUIET_SEAS,
      navies: [
        {
          ...FLEET,
          lanes: [
            { cargo: "trade", convoys: 3, zones: [5, 6] },
            { cargo: "supply", convoys: 1, zones: [6] },
          ],
        },
        { ...NO_NAVY, lanes: [{ cargo: "trade", convoys: 2, zones: [6] }] },
      ],
    };

    expect(ordersOf(seafaredOneDay(busy, AT_WAR).navies, 0)).toStrictEqual([
      { mission: "patrol", zone: 5 },
      { mission: "escort", zone: 6 },
      { mission: "raid", zone: 6 },
    ]);
  });

  it("should send the battle fleet to strike at the lowest-numbered lane zone the enemy's fleet threatens when two are threatened alike", () => {
    const threatened: Seas = {
      ...QUIET_SEAS,
      navies: [
        {
          ...FLEET,
          lanes: [{ cargo: "trade", convoys: 3, zones: [5, 6] }],
        },
        EASTERN_FLEET,
      ],
    };

    expect(
      ordersOf(seafaredOneDay(threatened, AT_WAR).navies, 0)
    ).toStrictEqual([
      { mission: "strike", zone: 5 },
      { mission: "escort", zone: 5 },
      { mission: "patrol", zone: 5 },
    ]);
  });
});

describe("seafaredOneDay burning fuel", () => {
  it("should burn nothing when every task force holds its position off its port", () => {
    expect(seafaredOneDay(QUIET_SEAS, AT_WAR).burned).toStrictEqual([0, 0]);
  });

  it("should burn the battle fleet's day of fuel when it makes way toward a strike", () => {
    const seas: Seas = {
      ...QUIET_SEAS,
      divisions: [division({ nation: 0, province: 0 })],
      invasions: [LANDING],
    };

    expect(seafaredOneDay(seas, AT_WAR).burned).toStrictEqual([
      hullOf("battleship").fuel * SHIP_FUEL_PER_DAY,
      0,
    ]);
  });

  it("should burn twice the day's fuel and no more when a task force makes way into a battle", () => {
    const seas: Seas = {
      divisions: [division({ nation: 0, province: 0 })],
      invasions: [LANDING],
      navies: [
        {
          ...NO_NAVY,
          fleets: [force("main", "battleship", 5), ...NO_NAVY.fleets.slice(1)],
        },
        EASTERN_FLEET,
      ],
    };

    expect(seafaredOneDay(seas, AT_WAR).burned).toStrictEqual([
      2 * hullOf("battleship").fuel * SHIP_FUEL_PER_DAY,
      2 * hullOf("battleship").fuel * SHIP_FUEL_PER_DAY,
    ]);
  });

  it("should burn twice the day's fuel when a task force fights where it holds", () => {
    const seas: Seas = {
      divisions: [division({ nation: 0, province: 0 })],
      invasions: [LANDING],
      navies: [
        {
          ...NO_NAVY,
          fleets: [force("main", "battleship", 6), ...NO_NAVY.fleets.slice(1)],
        },
        EASTERN_FLEET,
      ],
    };

    expect(seafaredOneDay(seas, AT_WAR).burned).toStrictEqual([
      2 * hullOf("battleship").fuel * SHIP_FUEL_PER_DAY,
      2 * hullOf("battleship").fuel * SHIP_FUEL_PER_DAY,
    ]);
  });
});

describe("seafaredOneDay short of fuel", () => {
  const striking: Seas = {
    ...QUIET_SEAS,
    divisions: [division({ nation: 0, province: 0 })],
    invasions: [LANDING],
  };

  it("should keep the battle fleet in its zone when its nation holds no fuel and its engines make no way that day", () => {
    const dry = { ...coastsOn(ISLES_OWNERS, ISLES_WAR, 1, []), fuel: [0, 0] };

    expect(
      itemAt(ordersOf(seafaredOneDay(striking, dry).navies, 0), 0, {
        mission: "repair",
        zone: UNASSIGNED,
      })
    ).toStrictEqual({ mission: "patrol", zone: 5 });
  });

  it("should sail the battle fleet when its nation holds no fuel but its engines make way on a quarter of the days and that day is one", () => {
    const dry = { ...coastsOn(ISLES_OWNERS, ISLES_WAR, 4, []), fuel: [0, 0] };

    expect(
      itemAt(ordersOf(seafaredOneDay(striking, dry).navies, 0), 0, {
        mission: "repair",
        zone: UNASSIGNED,
      })
    ).toStrictEqual({ mission: "strike", zone: 6 });
  });

  it("should sail as if its tanks were empty when no stockpile is given for the nation", () => {
    const unlisted = { ...coastsOn(ISLES_OWNERS, ISLES_WAR, 1, []), fuel: [] };

    expect(
      itemAt(ordersOf(seafaredOneDay(striking, unlisted).navies, 0), 0, {
        mission: "repair",
        zone: UNASSIGNED,
      })
    ).toStrictEqual({ mission: "patrol", zone: 5 });
  });
});

describe(overseasRivals, () => {
  it("should name a nation that can carry a war across the sea when its battle fleet outweighs the other's navy by half again", () => {
    expect(
      overseasRivals(ISLES_WORLD, {
        navies: [FLEET, NO_NAVY],
        owners: ISLES_OWNERS,
      })
    ).toStrictEqual([{ one: 0, other: 1 }]);
  });

  it("should name nobody when the two battle fleets are as strong", () => {
    expect(
      overseasRivals(ISLES_WORLD, {
        navies: [EASTERN_FLEET, EASTERN_FLEET],
        owners: ISLES_OWNERS,
      })
    ).toStrictEqual([]);
  });

  it("should name nobody when the two nations' ground touches", () => {
    expect(
      overseasRivals(ISLES_WORLD, {
        navies: [FLEET, NO_NAVY],
        owners: Int32Array.from([0, 1, 1, 1, 1, UNASSIGNED, UNASSIGNED]),
      })
    ).toStrictEqual([]);
  });

  it("should name nobody when the other nation has no port", () => {
    expect(
      overseasRivals(ISLES_WORLD, {
        navies: [FLEET, NO_NAVY],
        owners: Int32Array.from([0, 0, 0, 0, 1, UNASSIGNED, UNASSIGNED]),
      })
    ).toStrictEqual([]);
  });
});
