import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { itemAt } from "./lookup";
import type { Nation } from "./nations";
import { graphOf } from "./provinces";
import { SEA_GRAPH, SEA_OWNERS, SEA_WORLD } from "./sea-fixture";
import {
  overlandBetween,
  aroundZone,
  coastOf,
  coastsHeldBy,
  homePortOf,
  isCoastal,
  landmassesOf,
  laneBetween,
  seaDistanceFrom,
  seaZones,
  stepAtSea,
  zonesOffshore,
} from "./seas";
import { UNASSIGNED } from "./spread";

/** A nation that holds nothing, where the fixture names none. */
const NOBODY: Nation = {
  capital: UNASSIGNED,
  colour: { blue: 0, green: 0, red: 0 },
  id: UNASSIGNED,
  leaning: "army",
  name: "",
};

/** The nation holding the first island. */
const NATION_ZERO = itemAt(SEA_WORLD.nations, 0, NOBODY);

/** The nation holding the second island. */
const NATION_ONE = itemAt(SEA_WORLD.nations, 1, NOBODY);

describe(coastOf, () => {
  it("should list every sea zone the province touches when it lies on the coast", () => {
    expect(coastOf(SEA_GRAPH, 1)).toStrictEqual([4, 5]);
  });

  it("should list nothing when the province touches only land", () => {
    expect(coastOf(SEA_GRAPH, 0)).toStrictEqual([]);
  });
});

describe(isCoastal, () => {
  it("should read coastal when the province touches a sea zone", () => {
    expect(isCoastal(SEA_GRAPH, 2)).toBeTruthy();
  });

  it("should read inland when the province touches no sea zone", () => {
    expect(isCoastal(SEA_GRAPH, 0)).toBeFalsy();
  });
});

describe(seaDistanceFrom, () => {
  it("should count the zones over the sea and leave land and cut-off water unassigned when walking from one zone", () => {
    expect([...seaDistanceFrom(SEA_GRAPH, [6])]).toStrictEqual([
      UNASSIGNED,
      UNASSIGNED,
      UNASSIGNED,
      UNASSIGNED,
      2,
      1,
      0,
      UNASSIGNED,
    ]);
  });
});

describe(stepAtSea, () => {
  it("should step to the neighbour one zone closer when the zone lies away from the target", () => {
    expect(stepAtSea(SEA_GRAPH, seaDistanceFrom(SEA_GRAPH, [6]), 4)).toBe(5);
  });

  it("should stay put when the zone is the target", () => {
    expect(stepAtSea(SEA_GRAPH, seaDistanceFrom(SEA_GRAPH, [6]), 6)).toBe(6);
  });

  it("should stay put when no sea reaches the zone from the target", () => {
    expect(stepAtSea(SEA_GRAPH, seaDistanceFrom(SEA_GRAPH, [6]), 7)).toBe(7);
  });

  it("should take the lowest-numbered neighbour when two lie one zone closer", () => {
    const diamond = graphOf([
      { cells: 1, id: 0, kind: "sea", neighbours: [1, 2], x: 0, y: 0 },
      { cells: 1, id: 1, kind: "sea", neighbours: [0, 3], x: 1, y: 0 },
      { cells: 1, id: 2, kind: "sea", neighbours: [0, 3], x: 1, y: 1 },
      { cells: 1, id: 3, kind: "sea", neighbours: [1, 2], x: 2, y: 0 },
    ]);

    expect(stepAtSea(diamond, seaDistanceFrom(diamond, [3]), 0)).toBe(1);
  });
});

describe(laneBetween, () => {
  it("should cross every zone from one end to the other, both included, when the sea joins them", () => {
    expect(laneBetween(SEA_GRAPH, [4], [6])).toStrictEqual([4, 5, 6]);
  });

  it("should start from the nearest of the zones it may leave from when there are several", () => {
    expect(laneBetween(SEA_GRAPH, [4, 5], [6])).toStrictEqual([5, 6]);
  });

  it("should be the one shared zone when the two ends overlap", () => {
    expect(laneBetween(SEA_GRAPH, [4, 5], [5, 6])).toStrictEqual([5]);
  });

  it("should be empty when no sea joins the two ends", () => {
    expect(laneBetween(SEA_GRAPH, [7], [6])).toStrictEqual([]);
  });

  it("should be empty when there is nothing to leave from", () => {
    expect(laneBetween(SEA_GRAPH, [], [6])).toStrictEqual([]);
  });
});

describe(homePortOf, () => {
  it("should open onto the lowest-numbered zone of the coastal province nearest the muster when the nation reaches the sea", () => {
    expect(
      homePortOf(SEA_WORLD, SEA_GRAPH, SEA_OWNERS, NATION_ZERO, 0)
    ).toStrictEqual(Option.some({ province: 1, zone: 4 }));
  });

  it("should take the coastal province the nation musters in when it musters on the coast", () => {
    expect(
      homePortOf(SEA_WORLD, SEA_GRAPH, SEA_OWNERS, NATION_ONE, 3)
    ).toStrictEqual(Option.some({ province: 3, zone: 7 }));
  });

  it("should have none when the nation has nowhere to muster", () => {
    expect(
      homePortOf(SEA_WORLD, SEA_GRAPH, SEA_OWNERS, NATION_ZERO, UNASSIGNED)
    ).toStrictEqual(Option.none());
  });

  it("should have none when the muster stands on another nation's ground", () => {
    expect(
      homePortOf(SEA_WORLD, SEA_GRAPH, SEA_OWNERS, NATION_ZERO, 2)
    ).toStrictEqual(Option.none());
  });

  it("should have none when the nation's ground reaching the muster touches no sea", () => {
    const owners = Int32Array.from([0, 1, 1, 1, -1, -1, -1, -1]);

    expect(
      homePortOf(SEA_WORLD, SEA_GRAPH, owners, NATION_ZERO, 0)
    ).toStrictEqual(Option.none());
  });
});

describe(seaZones, () => {
  it("should list the sea zones alone when the world holds land and sea", () => {
    expect(seaZones(SEA_WORLD.provinces)).toStrictEqual([4, 5, 6, 7]);
  });
});

describe(aroundZone, () => {
  it("should list the zone first and then the sea zones beside it when land touches it too", () => {
    expect(aroundZone(SEA_GRAPH, 5)).toStrictEqual([5, 4, 6]);
  });
});

describe(coastsHeldBy, () => {
  it("should list the nation's provinces that touch the sea when other nations hold coasts too", () => {
    expect(coastsHeldBy(SEA_WORLD, SEA_GRAPH, SEA_OWNERS, 1)).toStrictEqual([
      2, 3,
    ]);
  });

  it("should list only the coast when the nation also holds inland ground", () => {
    expect(coastsHeldBy(SEA_WORLD, SEA_GRAPH, SEA_OWNERS, 0)).toStrictEqual([
      1,
    ]);
  });
});

describe(landmassesOf, () => {
  it("should number each island by its lowest province id and leave the sea unassigned when two islands share a strait", () => {
    expect([...landmassesOf(SEA_GRAPH)]).toStrictEqual([
      0,
      0,
      2,
      2,
      UNASSIGNED,
      UNASSIGNED,
      UNASSIGNED,
      UNASSIGNED,
    ]);
  });
});

describe(zonesOffshore, () => {
  it("should list each zone once in id order when several provinces touch the same one", () => {
    expect(zonesOffshore(SEA_GRAPH, [3, 2, 1, 0])).toStrictEqual([4, 5, 6, 7]);
  });
});

describe(overlandBetween, () => {
  it.each([
    {
      expected: true,
      musters: [0, 1],
      when: "both capitals stand on one island",
    },
    {
      expected: false,
      musters: [0, 2],
      when: "the sea parts the two capitals",
    },
    { expected: false, musters: [-1, 0], when: "one of them musters nowhere" },
  ])("should read $expected when $when", ({ expected, musters }) => {
    expect(overlandBetween(landmassesOf(SEA_GRAPH), musters, 0, 1)).toBe(
      expected
    );
  });
});
