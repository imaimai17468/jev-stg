import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  AIR_GRAPH,
  AIR_OWNERS,
  AIR_PEACE,
  AIR_WAR,
  AIR_WORLD,
  airForceOf,
  wing,
} from "./air-war-fixture";
import type { DropZone } from "./airborne";
import { dropTargetFor, paradropsOneDay, transportsFor } from "./airborne";
import { division } from "./army-fixture";
import { paradropped } from "./divisions";
import { declared } from "./wars";

describe(transportsFor, () => {
  it.each([
    { divisions: 0, transports: 0 },
    { divisions: 1, transports: 50 },
    { divisions: 3, transports: 135 },
  ])(
    "should take $transports transport planes when $divisions paratrooper divisions drop at once",
    ({ divisions, transports }) => {
      expect(transportsFor(divisions)).toBe(transports);
    }
  );
});

/** Nations 0 and 1 at war over the air world, with every sky open. */
const ZONE: DropZone = {
  airspace: AIR_WORLD.airspace,
  enemySky: () => 0,
  graph: AIR_GRAPH,
  owners: AIR_OWNERS,
  wars: AIR_WAR.wars,
};

/** A paratrooper division of nation 0 standing at its capital, out of reach of the front. */
const PARATROOPER = division({
  kind: "paratroopers",
  nation: 0,
  organisation: 70,
  province: 0,
});

/** Nation 0's `planes` transport planes based in province 1, which reaches nation 1's province 2. */
const transportsAtOne = (planes: number) => [
  airForceOf([wing({ base: 1, model: "transport-plane-1", planes })]),
  airForceOf([]),
  airForceOf([]),
];

describe(paradropsOneDay, () => {
  it("should drop a ready paratrooper onto the enemy province in the base's range when the nation has the transports and the sky", () => {
    expect(
      paradropsOneDay(ZONE, transportsAtOne(50), [PARATROOPER])
    ).toStrictEqual({
      divisions: [paradropped(PARATROOPER, 2)],
      drops: [{ base: 1, divisions: [PARATROOPER], nation: 0, target: 2 }],
    });
  });

  it("should drop only as many paratroopers as the transports carry when there are more of them", () => {
    expect(
      paradropsOneDay(ZONE, transportsAtOne(95), [
        PARATROOPER,
        PARATROOPER,
        PARATROOPER,
      ]).divisions.map((moved) => moved.province)
    ).toStrictEqual([2, 2, 0]);
  });

  it.each([
    { planes: 45, why: "the transports fall short of the fewest a drop takes" },
    { planes: 0, why: "the nation has no transports" },
  ])("should drop nothing when $why", ({ planes }) => {
    expect(
      paradropsOneDay(ZONE, transportsAtOne(planes), [PARATROOPER]).drops
    ).toStrictEqual([]);
  });

  it("should drop nothing when the nation is at peace", () => {
    expect(
      paradropsOneDay({ ...ZONE, wars: AIR_PEACE.wars }, transportsAtOne(50), [
        PARATROOPER,
      ])
    ).toStrictEqual({ divisions: [PARATROOPER], drops: [] });
  });

  it.each([
    { closed: 1, where: "over the base" },
    { closed: 2, where: "over the target" },
  ])(
    "should drop nothing when the enemy holds too much of the sky $where",
    ({ closed }) => {
      expect(
        paradropsOneDay(
          {
            ...ZONE,
            enemySky: (_, province) => 0.31 * Number(province === closed),
          },
          transportsAtOne(50),
          [PARATROOPER]
        ).drops
      ).toStrictEqual([]);
    }
  );

  it.each([
    {
      standing: division({ nation: 0, province: 0 }),
      why: "the division is not paratroopers",
    },
    {
      standing: { ...PARATROOPER, province: 1 },
      why: "the paratroopers stand beside enemy ground",
    },
    {
      standing: division({ ...PARATROOPER, task: "regroup" }),
      why: "the paratroopers are regrouping after they broke",
    },
    {
      standing: { ...PARATROOPER, province: 2 },
      why: "the paratroopers stand on enemy ground",
    },
    {
      standing: { ...PARATROOPER, nation: 1, province: 3 },
      why: "the paratroopers belong to a nation with no transports",
    },
  ])("should drop nothing when $why", ({ standing }) => {
    expect(
      paradropsOneDay(ZONE, transportsAtOne(50), [standing]).drops
    ).toStrictEqual([]);
  });

  it("should leave fighters out of the planes a drop counts when a base holds no transports", () => {
    expect(
      paradropsOneDay(
        ZONE,
        [
          airForceOf([wing({ base: 1, model: "fighter-1", planes: 100 })]),
          airForceOf([]),
          airForceOf([]),
        ],
        [PARATROOPER]
      ).drops
    ).toStrictEqual([]);
  });

  it("should hold paratroopers back and count a day off their penalties when their last drop's penalties have not worn off", () => {
    expect(
      paradropsOneDay(ZONE, transportsAtOne(50), [
        { ...PARATROOPER, dropped: 3 },
      ])
    ).toStrictEqual({
      divisions: [{ ...PARATROOPER, dropped: 2 }],
      drops: [],
    });
  });

  it("should drop nothing when no enemy province lies in the base's range", () => {
    expect(
      paradropsOneDay(
        ZONE,
        [
          airForceOf([
            wing({ base: 0, model: "transport-plane-1", planes: 50 }),
          ]),
          airForceOf([]),
          airForceOf([]),
        ],
        [PARATROOPER]
      ).drops
    ).toStrictEqual([]);
  });
});

describe(dropTargetFor, () => {
  /** Nation 1 at war with both its neighbours, so its base in province 2 reaches enemies in 1 and 4. */
  const twoFronts: DropZone = {
    ...ZONE,
    wars: declared(AIR_WAR.wars, { one: 1, other: 2 }),
  };

  it.each([
    {
      guarded: new Map<number, number>(),
      target: 1,
      why: "no one stands on either",
    },
    {
      guarded: new Map([[1, 20_000]]),
      target: 4,
      why: "men stand on the lower one",
    },
  ])("should pick province $target when $why", ({ guarded, target }) => {
    expect(dropTargetFor(twoFronts, guarded, 1, 2)).toStrictEqual(
      Option.some(target)
    );
  });
});
