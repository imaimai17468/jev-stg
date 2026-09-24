import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { joined } from "../diplomacy/diplomacy";
import { UNASSIGNED } from "../spread";
import type { Navy, Station, TaskForce } from "./navy";
import {
  builtOneDay,
  countOf,
  enemyHoldIn,
  fleetOf,
  fleetStrength,
  NO_NAVY,
  openingNavy,
  orderByRules,
  ordersFor,
  sailed,
  screeningOf,
  watersOf,
  weightOf,
  withOrder,
} from "./navy";
import { SEA_GRAPH, SHIPS_1936, ZERO_FIGHTS_ONE } from "./sea-fixture";
import { seaDistanceFrom } from "./seas";
import type { Ship, ShipClass } from "./ships";
import { classOf, launched, supremacyOf } from "./ships";

/** A 1936 warship of `shipClass` fresh from the dockyard, with whatever a test needs changed. */
const ship = (shipClass: ShipClass, patch: Partial<Ship> = {}): Ship => ({
  ...launched(SHIPS_1936[shipClass]),
  ...patch,
});

/** A battle fleet on patrol in zone 4, with whatever a test needs changed. */
const force = (patch: Partial<TaskForce>): TaskForce => ({
  mission: "patrol",
  role: "main",
  ships: [],
  zone: 4,
  ...patch,
});

/** A navy with nothing afloat and `fleets` in place of its three empty task forces. */
const navyOf = (fleets: readonly TaskForce[]): Navy => ({
  ...NO_NAVY,
  fleets,
});

/** A navy whose battle fleet holds `ships` in zone 4 and whose other task forces are empty. */
const withMain = (ships: readonly Ship[]): Navy =>
  navyOf([
    force({ ships }),
    force({ role: "escort", zone: UNASSIGNED }),
    force({ role: "raiders", zone: UNASSIGNED }),
  ]);

/** The classes of each task force's ships, battle fleet first. */
const classesOf = (navy: Navy): readonly (readonly ShipClass[])[] =>
  navy.fleets.map((fleet) => fleet.ships.map(classOf));

/** A nation whose port opens onto zone 4 and that wants its ships nowhere else. */
const QUIET: Station = {
  busiest: Option.none(),
  home: 4,
  landing: Option.none(),
  prey: Option.none(),
  threatened: Option.none(),
};

describe(fleetOf, () => {
  it("should give the navy's task force in that role when the navy keeps one", () => {
    const escort = force({ role: "escort", ships: [ship("destroyer")] });

    expect(
      fleetOf(navyOf([force({}), escort, force({ role: "raiders" })]), "escort")
    ).toStrictEqual(escort);
  });

  it("should give an empty task force nowhere when the navy keeps none in that role", () => {
    expect(fleetOf(navyOf([]), "raiders")).toStrictEqual({
      mission: "patrol",
      role: "raiders",
      ships: [],
      zone: UNASSIGNED,
    });
  });
});

describe(countOf, () => {
  it("should count only the ships of that class when the fleet mixes classes", () => {
    expect(
      countOf(
        force({
          ships: [ship("destroyer"), ship("cruiser"), ship("destroyer")],
        }),
        "destroyer"
      )
    ).toBe(2);
  });
});

describe(screeningOf, () => {
  it("should read full when the fleet has screens and no capital ship", () => {
    expect(screeningOf(force({ ships: [ship("destroyer")] }))).toBe(1);
  });

  it("should read full when the fleet has only submarines and so nothing to screen", () => {
    expect(screeningOf(force({ ships: [ship("submarine")] }))).toBe(1);
  });

  it("should read the share of three screens per capital ship when the fleet lacks some", () => {
    expect(
      screeningOf(force({ ships: [ship("battleship"), ship("destroyer")] }))
    ).toBeCloseTo(1 / 3);
  });

  it("should want three screens for a carrier as for a capital ship when the fleet carries one", () => {
    expect(
      screeningOf(force({ ships: [ship("carrier"), ship("destroyer")] }))
    ).toBeCloseTo(1 / 3);
  });

  it("should stop at full when the fleet has more screens than its capital ships want", () => {
    expect(
      screeningOf(
        force({
          ships: [
            ship("battleship"),
            ship("destroyer"),
            ship("destroyer"),
            ship("cruiser"),
            ship("cruiser"),
          ],
        })
      )
    ).toBe(1);
  });
});

describe(builtOneDay, () => {
  it("should build nothing when the nation has no port to launch from", () => {
    expect(builtOneDay(NO_NAVY, 1000, UNASSIGNED, SHIPS_1936)).toStrictEqual(
      NO_NAVY
    );
  });

  it("should carry the production into the next day when it does not pay for one", () => {
    expect(builtOneDay(NO_NAVY, 60, 4, SHIPS_1936)).toStrictEqual({
      ...NO_NAVY,
      progress: 60,
    });
  });

  it("should finish as many convoys as the production pays for and carry the rest when it pays for several", () => {
    expect(
      builtOneDay({ ...NO_NAVY, progress: 50 }, 220, 4, SHIPS_1936)
    ).toStrictEqual({
      ...NO_NAVY,
      convoys: 2,
      progress: 70,
    });
  });

  it("should send a new submarine to the raiders at the home port when the raiders have no ship yet", () => {
    expect(
      fleetOf(
        builtOneDay(withOrder(NO_NAVY, "submarine"), 451, 5, SHIPS_1936),
        "raiders"
      )
    ).toStrictEqual(
      force({ role: "raiders", ships: [ship("submarine")], zone: 5 })
    );
  });

  it("should send a new destroyer to the escorts when the battle fleet has no capital ship to screen", () => {
    expect(
      classesOf(
        builtOneDay(withOrder(NO_NAVY, "destroyer"), 1184.5, 4, SHIPS_1936)
      )
    ).toStrictEqual([[], ["destroyer"], []]);
  });

  it("should send a new destroyer to the battle fleet when its capital ships lack screens", () => {
    expect(
      classesOf(
        builtOneDay(
          withOrder(withMain([ship("battleship")]), "destroyer"),
          1184.5,
          4,
          SHIPS_1936
        )
      )
    ).toStrictEqual([["battleship", "destroyer"], [], []]);
  });

  it("should send a new destroyer to the battle fleet when its carrier lacks screens", () => {
    expect(
      classesOf(
        builtOneDay(
          withOrder(withMain([ship("carrier")]), "destroyer"),
          1184.5,
          4,
          SHIPS_1936
        )
      )
    ).toStrictEqual([["carrier", "destroyer"], [], []]);
  });

  it("should send a new carrier to the battle fleet when the dockyards finish one", () => {
    expect(
      classesOf(builtOneDay(withOrder(NO_NAVY, "carrier"), 8822, 4, SHIPS_1936))
    ).toStrictEqual([["carrier"], [], []]);
  });

  it("should leave the battle fleet where it is when a new battleship joins it at sea", () => {
    const atSea = navyOf([
      force({ ships: [ship("battleship")], zone: 6 }),
      force({ role: "escort", zone: UNASSIGNED }),
      force({ role: "raiders", zone: UNASSIGNED }),
    ]);

    expect(
      fleetOf(
        builtOneDay(withOrder(atSea, "battleship"), 12_960, 4, SHIPS_1936),
        "main"
      ).zone
    ).toBe(6);
  });

  it("should launch the newest design of the class at its cost when a newer design is researched than the one laid down", () => {
    expect(
      fleetOf(
        builtOneDay(
          withOrder({ ...NO_NAVY, progress: 1200 }, "destroyer"),
          151.25,
          4,
          { ...SHIPS_1936, destroyer: "destroyer-3" }
        ),
        "escort"
      ).ships
    ).toStrictEqual([launched("destroyer-3")]);
  });
});

describe(withOrder, () => {
  it("should keep the production already put in when the dockyards change what they build", () => {
    expect(withOrder({ ...NO_NAVY, progress: 80 }, "cruiser")).toStrictEqual({
      ...NO_NAVY,
      order: "cruiser",
      progress: 80,
    });
  });
});

describe(openingNavy, () => {
  it("should open with no navy when the nation has no port", () => {
    expect(openingNavy(4, UNASSIGNED, SHIPS_1936)).toStrictEqual(NO_NAVY);
  });

  it("should put the capital ships in first so three destroyers screen them and the rest escort when the nation has a port", () => {
    expect(classesOf(openingNavy(4, 4, SHIPS_1936))).toStrictEqual([
      [
        "battleship",
        "destroyer",
        "destroyer",
        "destroyer",
        "cruiser",
        "cruiser",
      ],
      ["destroyer", "destroyer", "destroyer", "destroyer", "destroyer"],
      ["submarine", "submarine", "submarine", "submarine"],
    ]);
  });

  it("should put a carrier in beside the battleships so the destroyers screen it too when the nation has ten dockyards", () => {
    expect(classesOf(openingNavy(10, 4, SHIPS_1936))).toStrictEqual([
      [
        "battleship",
        "battleship",
        "carrier",
        ...Array.from({ length: 9 }, () => "destroyer"),
        ...Array.from({ length: 5 }, () => "cruiser"),
      ],
      Array.from({ length: 11 }, () => "destroyer"),
      Array.from({ length: 10 }, () => "submarine"),
    ]);
  });

  it("should float ten convoys for each dockyard when the nation has a port", () => {
    expect(openingNavy(4, 4, SHIPS_1936).convoys).toBe(40);
  });
});

describe(ordersFor, () => {
  it("should leave a task force with no ships on patrol when it has nothing to repair", () => {
    expect(ordersFor(force({ ships: [] }), QUIET)).toStrictEqual({
      mission: "patrol",
      target: 4,
    });
  });

  it("should send the task force home to repair when half its hull is gone", () => {
    expect(
      ordersFor(force({ ships: [ship("destroyer", { hp: 19 })] }), QUIET)
    ).toStrictEqual({ mission: "repair", target: 4 });
  });

  it("should send the task force home to repair when its cohesion is shaken", () => {
    expect(
      ordersFor(
        force({ ships: [ship("destroyer", { organisation: 10 })] }),
        QUIET
      )
    ).toStrictEqual({ mission: "repair", target: 4 });
  });

  it("should keep the task force repairing when its hull is not yet mended", () => {
    expect(
      ordersFor(
        force({ mission: "repair", ships: [ship("destroyer", { hp: 32 })] }),
        QUIET
      )
    ).toStrictEqual({ mission: "repair", target: 4 });
  });

  it("should keep the task force repairing when its cohesion is not yet back", () => {
    expect(
      ordersFor(
        force({
          mission: "repair",
          ships: [ship("destroyer", { organisation: 28 })],
        }),
        QUIET
      )
    ).toStrictEqual({ mission: "repair", target: 4 });
  });

  it("should put the task force back on patrol when it has repaired", () => {
    expect(
      ordersFor(
        force({ mission: "repair", ships: [ship("destroyer", { hp: 38 })] }),
        QUIET
      )
    ).toStrictEqual({ mission: "patrol", target: 4 });
  });

  it("should send the battle fleet to strike the landing's lane when a landing is planned and a zone is threatened", () => {
    expect(
      ordersFor(force({ ships: [ship("battleship")] }), {
        ...QUIET,
        landing: Option.some(6),
        threatened: Option.some(5),
      })
    ).toStrictEqual({ mission: "strike", target: 6 });
  });

  it("should send the battle fleet to strike the threatened zone when no landing is planned", () => {
    expect(
      ordersFor(force({ ships: [ship("battleship")] }), {
        ...QUIET,
        threatened: Option.some(5),
      })
    ).toStrictEqual({ mission: "strike", target: 5 });
  });

  it("should keep the battle fleet on patrol off its port when nothing wants it", () => {
    expect(
      ordersFor(force({ ships: [ship("battleship")] }), QUIET)
    ).toStrictEqual({
      mission: "patrol",
      target: 4,
    });
  });

  it("should send the escorts to the busiest lane zone when convoys cross one", () => {
    expect(
      ordersFor(force({ role: "escort", ships: [ship("destroyer")] }), {
        ...QUIET,
        busiest: Option.some(5),
      })
    ).toStrictEqual({ mission: "escort", target: 5 });
  });

  it("should keep the escorts on patrol off their port when no convoy is running", () => {
    expect(
      ordersFor(force({ role: "escort", ships: [ship("destroyer")] }), QUIET)
    ).toStrictEqual({ mission: "patrol", target: 4 });
  });

  it("should send the raiders after the enemy's busiest lane zone when there is one", () => {
    expect(
      ordersFor(force({ role: "raiders", ships: [ship("submarine")] }), {
        ...QUIET,
        prey: Option.some(6),
      })
    ).toStrictEqual({ mission: "raid", target: 6 });
  });

  it("should keep the raiders on patrol off their port when there is no enemy lane", () => {
    expect(
      ordersFor(force({ role: "raiders", ships: [ship("submarine")] }), QUIET)
    ).toStrictEqual({ mission: "patrol", target: 4 });
  });
});

describe(sailed, () => {
  it("should stay nowhere under its new mission when the task force has no ships", () => {
    expect(
      sailed(
        SEA_GRAPH,
        force({ zone: 5 }),
        { mission: "strike", target: 6 },
        seaDistanceFrom(SEA_GRAPH, [6])
      )
    ).toStrictEqual(force({ mission: "strike", zone: UNASSIGNED }));
  });

  it("should move one zone toward the target and restore cohesion but not the hull when it sails out", () => {
    expect(
      sailed(
        SEA_GRAPH,
        force({ ships: [ship("destroyer", { hp: 20, organisation: 10 })] }),
        { mission: "strike", target: 6 },
        seaDistanceFrom(SEA_GRAPH, [6])
      )
    ).toStrictEqual(
      force({
        mission: "strike",
        ships: [ship("destroyer", { hp: 20, organisation: 13.5 })],
        zone: 5,
      })
    );
  });

  it("should mend the hull when it lies in its home port to repair", () => {
    expect(
      sailed(
        SEA_GRAPH,
        force({ ships: [ship("destroyer", { hp: 20 })], zone: 5 }),
        { mission: "repair", target: 4 },
        seaDistanceFrom(SEA_GRAPH, [4])
      ).ships.map((one) => one.hp)
    ).toStrictEqual([20.8]);
  });

  it("should leave the hull as it is when it is still on its way home to repair", () => {
    expect(
      sailed(
        SEA_GRAPH,
        force({ ships: [ship("destroyer", { hp: 20 })], zone: 6 }),
        { mission: "repair", target: 4 },
        seaDistanceFrom(SEA_GRAPH, [4])
      ).ships.map((one) => one.hp)
    ).toStrictEqual([20]);
  });

  it("should not recover past full cohesion when the ship is nearly whole", () => {
    expect(
      sailed(
        SEA_GRAPH,
        force({ ships: [ship("destroyer", { hp: 39.9, organisation: 34 })] }),
        { mission: "repair", target: 4 },
        seaDistanceFrom(SEA_GRAPH, [4])
      ).ships
    ).toStrictEqual([ship("destroyer")]);
  });
});

describe(weightOf, () => {
  it("should count a whole battleship's supremacy when it is on a strike", () => {
    expect(
      weightOf(force({ mission: "strike", ships: [ship("battleship")] }))
    ).toBeCloseTo(supremacyOf(SHIPS_1936.battleship));
  });

  it("should count three quarters of it when the fleet is on patrol", () => {
    expect(weightOf(force({ ships: [ship("battleship")] }))).toBeCloseTo(
      supremacyOf(SHIPS_1936.battleship) * 0.75
    );
  });

  it("should count by what is left of the hull when the ship is damaged", () => {
    expect(
      weightOf(
        force({ mission: "strike", ships: [ship("destroyer", { hp: 20 })] })
      )
    ).toBeCloseTo(supremacyOf(SHIPS_1936.destroyer) / 2);
  });

  it("should count nothing when the fleet is making for port to repair", () => {
    expect(
      weightOf(force({ mission: "repair", ships: [ship("battleship")] }))
    ).toBe(0);
  });
});

describe(watersOf, () => {
  it("should lay the fleet's weight over its own zone and the zones beside it when its other task forces are empty", () => {
    const main = force({
      mission: "strike",
      ships: [ship("battleship")],
      zone: 5,
    });
    const weight = weightOf(main);

    expect(
      watersOf(
        SEA_GRAPH,
        [
          navyOf([
            main,
            force({ role: "escort", zone: UNASSIGNED }),
            force({ role: "raiders", zone: UNASSIGNED }),
          ]),
        ],
        []
      )
    ).toStrictEqual([
      Float32Array.from([0, 0, 0, 0, weight, weight, weight, 0]),
    ]);
  });

  it("should grow the fleet's weight by the lift its nation holds over the zone it is in when its air superiority lifts it", () => {
    const main = force({
      mission: "strike",
      ships: [ship("battleship")],
      zone: 5,
    });
    const lifted = Math.fround(weightOf(main) * 1.5);

    expect(
      watersOf(
        SEA_GRAPH,
        [
          navyOf([
            main,
            force({ role: "escort", zone: UNASSIGNED }),
            force({ role: "raiders", zone: UNASSIGNED }),
          ]),
        ],
        [Float32Array.from([0, 0, 0, 0, 1, 0.5, 1, 0])]
      )
    ).toStrictEqual([
      Float32Array.from([0, 0, 0, 0, lifted, lifted, lifted, 0]),
    ]);
  });
});

/** Nation 0 with 1 in zone 5, its enemy nation 1 with 3, and nation 2, at war with neither, with 100. */
const CONTESTED_WATERS: readonly Float32Array[] = [
  Float32Array.from([0, 0, 0, 0, 0, 1, 0, 0]),
  Float32Array.from([0, 0, 0, 0, 0, 3, 0, 0]),
  Float32Array.from([0, 0, 0, 0, 0, 100, 0, 0]),
];

describe(enemyHoldIn, () => {
  it("should weigh the enemy against the nation alone and leave a nation at war with neither out when three are at sea", () => {
    expect(
      enemyHoldIn(
        { diplomacy: ZERO_FIGHTS_ONE, waters: CONTESTED_WATERS },
        0,
        5
      )
    ).toBe(0.75);
  });

  it("should count an ally's ships on the nation's side when the two share a faction", () => {
    const allies = joined(joined(ZERO_FIGHTS_ONE, 0, 0), 2, 0);

    expect(
      enemyHoldIn({ diplomacy: allies, waters: CONTESTED_WATERS }, 0, 5)
    ).toBeCloseTo(3 / 104);
  });

  it("should read none when no ship is in the zone", () => {
    expect(
      enemyHoldIn(
        { diplomacy: ZERO_FIGHTS_ONE, waters: CONTESTED_WATERS },
        0,
        4
      )
    ).toBe(0);
  });
});

describe(fleetStrength, () => {
  it("should add every warship's supremacy across the task forces whatever their hulls when the navy is afloat", () => {
    const navy = navyOf([
      force({ ships: [ship("battleship", { hp: 1 })] }),
      force({ role: "escort", ships: [ship("destroyer")] }),
      force({ role: "raiders" }),
    ]);

    expect(fleetStrength(navy)).toBeCloseTo(
      supremacyOf(SHIPS_1936.battleship) + supremacyOf(SHIPS_1936.destroyer)
    );
  });
});

describe(orderByRules, () => {
  it("should build convoys when the lanes want more than the navy has", () => {
    expect(orderByRules(NO_NAVY, false, 1)).toBe("convoy");
  });

  it("should build a cruiser when the capital ships lack screens and the destroyers already pair every cruiser", () => {
    expect(orderByRules(withMain([ship("battleship")]), false, 0)).toBe(
      "cruiser"
    );
  });

  it("should build a destroyer when the capital ships lack screens and the cruisers outnumber half the destroyers", () => {
    expect(
      orderByRules(withMain([ship("battleship"), ship("cruiser")]), false, 0)
    ).toBe("destroyer");
  });

  it("should build a submarine when the nation is at war and has fewer than one for every two destroyers", () => {
    expect(
      orderByRules(withMain([ship("destroyer"), ship("destroyer")]), true, 0)
    ).toBe("submarine");
  });

  it("should build a battleship when the nation is at war and has submarines enough", () => {
    expect(
      orderByRules(
        withMain([ship("destroyer"), ship("destroyer"), ship("submarine")]),
        true,
        0
      )
    ).toBe("battleship");
  });

  it("should build a cruiser when the carriers lack screens and the destroyers already pair every cruiser", () => {
    expect(orderByRules(withMain([ship("carrier")]), false, 0)).toBe("cruiser");
  });

  it("should build a carrier when the nation holds fewer carriers than battleships and its capital ships are screened", () => {
    expect(
      orderByRules(
        withMain([
          ship("battleship"),
          ship("destroyer"),
          ship("destroyer"),
          ship("cruiser"),
        ]),
        false,
        0
      )
    ).toBe("carrier");
  });

  it("should build a battleship when the nation holds as many carriers as battleships and its capital ships are screened", () => {
    expect(
      orderByRules(
        withMain([
          ship("battleship"),
          ship("carrier"),
          ...Array.from({ length: 4 }, () => ship("destroyer")),
          ship("cruiser"),
          ship("cruiser"),
        ]),
        false,
        0
      )
    ).toBe("battleship");
  });

  it("should build a battleship when the nation is at peace and its capital ships are screened", () => {
    expect(
      orderByRules(withMain([ship("destroyer"), ship("destroyer")]), false, 0)
    ).toBe("battleship");
  });
});
