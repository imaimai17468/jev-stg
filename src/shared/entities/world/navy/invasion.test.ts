import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { division } from "../army-fixture";
import { UNASSIGNED } from "../spread";
import type { Beachhead, Invasion, Muster } from "./invasion";
import { invasionOutcome, invasionPlanned, landfallFor } from "./invasion";
import {
  ISLES_GRAPH,
  ISLES_OWNERS,
  ISLES_PEACE,
  ISLES_WAR,
} from "./sea-fixture";

/** The islands at war with nobody standing anywhere. */
const UNGUARDED: Beachhead = {
  diplomacy: ISLES_WAR,
  garrisons: new Map(),
  graph: ISLES_GRAPH,
  owners: ISLES_OWNERS,
};

/** Two of nation 0's divisions on its own island. */
const SPARE = [
  division({ nation: 0, province: 0 }),
  division({ nation: 0, province: 1 }),
];

/** Nation 0 ready to cross: convoys for four divisions, a fleet, and nobody facing it. */
const READY: Muster = {
  beachheads: [],
  facesEnemy: false,
  hasFleet: true,
  home: 5,
  idleConvoys: 20,
  nation: 0,
  spare: SPARE,
};

describe(landfallFor, () => {
  it("should pick the enemy coast with the least standing on it when one is guarded", () => {
    const guarded = { ...UNGUARDED, garrisons: new Map([[2, 20_000]]) };

    expect(landfallFor(guarded, 0, 5)).toStrictEqual(
      Option.some({ lane: [5, 6], target: 3 })
    );
  });

  it("should pick the lowest-numbered enemy coast when two are as guarded and as far", () => {
    expect(landfallFor(UNGUARDED, 0, 5)).toStrictEqual(
      Option.some({ lane: [5, 6], target: 2 })
    );
  });

  it("should pick the enemy coast nearest over the sea when two are as guarded", () => {
    const closer = {
      ...UNGUARDED,
      owners: Int32Array.from([0, 1, 1, 1, 1, UNASSIGNED, UNASSIGNED]),
    };

    expect(landfallFor(closer, 0, 5)).toStrictEqual(
      Option.some({ lane: [5], target: 1 })
    );
  });

  it("should find nowhere to land when the nation is fighting nobody", () => {
    expect(
      landfallFor({ ...UNGUARDED, diplomacy: ISLES_PEACE }, 0, 5)
    ).toStrictEqual(Option.none());
  });
});

describe(invasionPlanned, () => {
  it("should plan no crossing when the nation has no home port to sail from", () => {
    expect(
      invasionPlanned(UNGUARDED, { ...READY, home: -1 }, 10)
    ).toStrictEqual(Option.none());
  });

  it("should plan no transfer when no sea joins home to the beachhead and it has no fleet", () => {
    expect(
      invasionPlanned(
        UNGUARDED,
        { ...READY, beachheads: [4], hasFleet: false },
        10
      )
    ).toStrictEqual(Option.none());
  });

  it("should prepare a landing on the enemy coast for every spare division when the nation has a fleet and convoys", () => {
    expect(invasionPlanned(UNGUARDED, READY, 10)).toStrictEqual(
      Option.some({
        convoys: 10,
        crossing: "landing",
        divisions: SPARE,
        lane: [5, 6],
        nation: 0,
        readyOn: 24,
        target: 2,
      })
    );
  });

  it("should take no more than four divisions when more are spare", () => {
    const crowded = {
      ...READY,
      idleConvoys: 100,
      spare: [...SPARE, ...SPARE, ...SPARE],
    };

    expect(
      Option.map(
        invasionPlanned(UNGUARDED, crowded, 0),
        (invasion) => invasion.divisions.length
      )
    ).toStrictEqual(Option.some(4));
  });

  it("should take only the divisions its convoys carry when it has convoys for fewer than are spare", () => {
    expect(
      Option.map(
        invasionPlanned(UNGUARDED, { ...READY, idleConvoys: 9 }, 0),
        (invasion) => invasion.divisions.length
      )
    ).toStrictEqual(Option.some(1));
  });

  it("should plan nothing when the nation has too few convoys for one division", () => {
    expect(
      invasionPlanned(UNGUARDED, { ...READY, idleConvoys: 4 }, 0)
    ).toStrictEqual(Option.none());
  });

  it("should plan nothing when the nation's ground faces an enemy over land", () => {
    expect(
      invasionPlanned(UNGUARDED, { ...READY, facesEnemy: true }, 0)
    ).toStrictEqual(Option.none());
  });

  it("should plan nothing when the nation is fighting nobody", () => {
    expect(
      invasionPlanned({ ...UNGUARDED, diplomacy: ISLES_PEACE }, READY, 0)
    ).toStrictEqual(Option.none());
  });

  it("should plan nothing when the nation has no battle fleet and no beachhead", () => {
    expect(
      invasionPlanned(UNGUARDED, { ...READY, hasFleet: false }, 0)
    ).toStrictEqual(Option.none());
  });

  it("should plan nothing when the enemy holds no coast to land on", () => {
    const inland = {
      ...UNGUARDED,
      owners: Int32Array.from([0, 0, 0, 0, 1, UNASSIGNED, UNASSIGNED]),
    };

    expect(invasionPlanned(inland, READY, 0)).toStrictEqual(Option.none());
  });

  it("should send a transfer to its beachhead a day for each zone of the lane when it holds one, even without a fleet", () => {
    expect(
      invasionPlanned(
        UNGUARDED,
        { ...READY, beachheads: [3], hasFleet: false },
        10
      )
    ).toStrictEqual(
      Option.some({
        convoys: 10,
        crossing: "transfer",
        divisions: SPARE,
        lane: [5, 6],
        nation: 0,
        readyOn: 12,
        target: 3,
      })
    );
  });

  it("should take a day to transfer when the beachhead lies off the home port's own zone", () => {
    expect(
      Option.map(
        invasionPlanned(UNGUARDED, { ...READY, beachheads: [1] }, 10),
        (invasion) => ({ lane: invasion.lane, readyOn: invasion.readyOn })
      )
    ).toStrictEqual(Option.some({ lane: [5], readyOn: 11 }));
  });
});

/** Nation 0's landing on province 2, ready on day 14. */
const LANDING: Invasion = {
  convoys: 5,
  crossing: "landing",
  divisions: [division({ nation: 0, province: 0 })],
  lane: [5, 6],
  nation: 0,
  readyOn: 14,
  target: 2,
};

/** Nation 0's transfer to province 3, which it holds. */
const TRANSFER: Invasion = { ...LANDING, crossing: "transfer", target: 3 };

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

/** A sea its side holds all of in every zone. */
const clearSea = (): number => 1;

/** A sea its side holds all of but half of zone 6, off the landing's target. */
const halfHeldOffTarget = (zone: number): number => 1 - Number(zone === 6) / 2;

describe(invasionOutcome, () => {
  it("should put the divisions ashore on the target still in their landing when it is ready and the sea is held", () => {
    expect(
      invasionOutcome(LANDING, ISLES_OWNERS, ISLES_WAR, 14, clearSea)
    ).toStrictEqual({
      divisions: [
        division({
          arrival: "landing",
          movingTo: 2,
          nation: 0,
          province: 2,
        }),
      ],
      kind: "landed",
    });
  });

  it("should leave the trenches behind when divisions that dug in at home go ashore", () => {
    expect(
      invasionOutcome(
        {
          ...LANDING,
          divisions: [division({ entrenchment: 5, nation: 0, province: 0 })],
        },
        ISLES_OWNERS,
        ISLES_WAR,
        14,
        clearSea
      )
    ).toStrictEqual({
      divisions: [
        division({
          arrival: "landing",
          movingTo: 2,
          nation: 0,
          province: 2,
        }),
      ],
      kind: "landed",
    });
  });

  it("should put a transfer's divisions ashore on foot when it reaches a coast its side holds", () => {
    expect(
      invasionOutcome(TRANSFER, BEACHHEAD_OWNERS, ISLES_WAR, 14, clearSea)
    ).toStrictEqual({
      divisions: [division({ movingTo: 3, nation: 0, province: 3 })],
      kind: "landed",
    });
  });

  it("should call a transfer off when the enemy has taken the coast it was bound for", () => {
    expect(
      invasionOutcome(TRANSFER, ISLES_OWNERS, ISLES_WAR, 14, clearSea)
    ).toStrictEqual({ kind: "called-off" });
  });

  it("should call a landing off when its target is no longer enemy ground", () => {
    expect(
      invasionOutcome(LANDING, ISLES_OWNERS, ISLES_PEACE, 14, clearSea)
    ).toStrictEqual({ kind: "called-off" });
  });

  it("should call a landing off when it has waited more than ninety days past its readiness", () => {
    expect(
      invasionOutcome(LANDING, ISLES_OWNERS, ISLES_WAR, 105, () => 0)
    ).toStrictEqual({ kind: "called-off" });
  });

  it("should keep waiting when it has waited exactly ninety days past its readiness", () => {
    expect(
      invasionOutcome(LANDING, ISLES_OWNERS, ISLES_WAR, 104, () => 0)
    ).toStrictEqual({ kind: "waiting" });
  });

  it("should wait when the preparation is not done", () => {
    expect(
      invasionOutcome(LANDING, ISLES_OWNERS, ISLES_WAR, 13, clearSea)
    ).toStrictEqual({ kind: "waiting" });
  });

  it("should wait when its side holds exactly half of a zone of the lane", () => {
    expect(
      invasionOutcome(LANDING, ISLES_OWNERS, ISLES_WAR, 14, halfHeldOffTarget)
    ).toStrictEqual({ kind: "waiting" });
  });
});
