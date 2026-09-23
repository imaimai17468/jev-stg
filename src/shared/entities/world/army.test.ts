import { describe, expect, it } from "vite-plus/test";
import type { Armies, Command } from "./army";
import { armiesAfterOneDay } from "./army";
import {
  division,
  FULL_SUPPLY,
  land,
  LINE_OWNERS,
  LINE_WORLD,
  nation,
  WAR_COMMAND,
  worldOf,
} from "./army-fixture";
import type { NationEconomy } from "./economy";
import { NO_ECONOMY } from "./economy";
import { itemAt } from "./lookup";
import { noWars } from "./wars";

/** Enough men and weapons for one division and change. */
const ARMED: NationEconomy = {
  ...NO_ECONOMY,
  equipment: 1500,
  manpower: 30_000,
};

const startingWith = (patch: Partial<Armies>): Armies => ({
  divisions: [],
  economies: [ARMED, NO_ECONOMY],
  owners: LINE_OWNERS,
  ...patch,
});

/** The two nations at war, with nation 0's enemies holding the whole sky over every province. */
const UNDER_ENEMY_SKY: Command = {
  ...WAR_COMMAND,
  air: {
    enemy: [Float32Array.from([1, 1, 1, 1, 1]), new Float32Array(5)],
    support: [],
    supportAttack: [],
  },
};

/**
 * Nation 0 holding province 0, and nation 1 the three beyond it: its capital
 * in province 1 beside nation 0's ground, and province 2 beside it too but
 * two provinces from the capital.
 */
const FORK_WORLD = worldOf(
  [nation(0, 0), nation(1, 1)],
  [land(0, [1, 2]), land(1, [0, 3]), land(2, [0, 3]), land(3, [1, 2])]
);

/** The same ground with nation 1's capital in province 3, as far from both of nation 0's neighbours. */
const DIAMOND_WORLD = worldOf(
  [nation(0, 0), nation(1, 3)],
  FORK_WORLD.provinces
);

const FORK_OWNERS = Int32Array.from([0, 1, 1, 1]);

/** Nation 0's four divisions in province 0, and `defenders` of nation 1's in province 1. */
const forkedWith = (defenders: number): Armies => ({
  divisions: [
    ...Array.from({ length: 4 }, () => division({ nation: 0, province: 0 })),
    ...Array.from({ length: defenders }, () =>
      division({ movingTo: 1, nation: 1, province: 1 })
    ),
  ],
  economies: [NO_ECONOMY, NO_ECONOMY],
  owners: FORK_OWNERS,
});

/** Where each division's trenches and planning stand, which is all the preparation tests read. */
const preparation = (armies: Armies) =>
  armies.divisions.map(({ entrenchment, planning }) => ({
    entrenchment,
    planning,
  }));

describe(armiesAfterOneDay, () => {
  it("should raise a division at the capital and take its cost out when a nation can afford one", () => {
    expect(
      armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, startingWith({}))
    ).toStrictEqual({
      divisions: [division({ marched: 1, movingTo: 1, nation: 0 })],
      economies: [
        { ...ARMED, equipment: 500, manpower: 10_000, recruited: 20_000 },
        NO_ECONOMY,
      ],
      owners: LINE_OWNERS,
    });
  });

  it("should raise nothing when no nation can pay for a division", () => {
    const broke = startingWith({ economies: [NO_ECONOMY, NO_ECONOMY] });

    expect(
      armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, broke).divisions
    ).toStrictEqual([]);
  });

  it("should muster on ground it still holds when a nation has lost its capital", () => {
    const pushed = startingWith({ owners: Int32Array.from([1, 0, 1, 1, -1]) });

    expect(
      armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, pushed).divisions.at(0)
        ?.province
    ).toBe(1);
  });

  it("should raise nothing when a nation holds no ground at all", () => {
    const overrun = startingWith({ owners: Int32Array.from([1, 1, 1, 1, -1]) });

    expect(
      armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, overrun).divisions
    ).toStrictEqual([]);
  });

  it("should arrive in the next province when the march has taken its days", () => {
    const walking = startingWith({
      divisions: [division({ marched: 1, movingTo: 1, nation: 0 })],
      economies: [NO_ECONOMY, NO_ECONOMY],
    });

    expect(
      armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, walking).divisions
    ).toStrictEqual([
      division({ marched: 0, movingTo: 1, nation: 0, province: 1 }),
    ]);
  });

  it("should come off the beach when a division that landed arrives in the next province", () => {
    const landed = startingWith({
      divisions: [
        division({ arrival: "landing", marched: 1, movingTo: 1, nation: 0 }),
      ],
      economies: [NO_ECONOMY, NO_ECONOMY],
    });

    expect(
      armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, landed).divisions
    ).toStrictEqual([
      division({ marched: 0, movingTo: 1, nation: 0, province: 1 }),
    ]);
  });

  it("should take the province when an attacker stands in it and nobody defends it", () => {
    const invaded = startingWith({
      divisions: [division({ nation: 0, province: 2 })],
      economies: [NO_ECONOMY, NO_ECONOMY],
    });

    expect(
      armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, invaded).owners
    ).toStrictEqual(Int32Array.from([0, 0, 0, 1, -1]));
  });

  it("should hold the attacker in place when the province it took was fought over", () => {
    const invaded = startingWith({
      divisions: [division({ nation: 0, province: 2 })],
      economies: [NO_ECONOMY, NO_ECONOMY],
    });

    expect(
      armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, invaded).divisions
    ).toStrictEqual([division({ nation: 0, province: 2 })]);
  });

  it("should keep walking when the march into the next province has days left", () => {
    const setting = startingWith({
      divisions: [division({ marched: 0, movingTo: 1, nation: 0 })],
      economies: [NO_ECONOMY, NO_ECONOMY],
    });

    expect(
      armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, setting).divisions
    ).toStrictEqual([division({ marched: 1, movingTo: 1, nation: 0 })]);
  });

  it("should walk three tenths slower when its enemies hold the whole sky over the ground it walks from", () => {
    const setting = startingWith({
      divisions: [division({ marched: 0, movingTo: 1, nation: 0 })],
      economies: [NO_ECONOMY, NO_ECONOMY],
    });

    expect(
      itemAt(
        armiesAfterOneDay(LINE_WORLD, UNDER_ENEMY_SKY, setting).divisions,
        0,
        division({})
      ).marched
    ).toBeCloseTo(0.7, 10);
  });

  it("should set out at the slower pace when its enemies hold the whole sky and it turns toward a new province", () => {
    expect(
      itemAt(
        armiesAfterOneDay(LINE_WORLD, UNDER_ENEMY_SKY, startingWith({}))
          .divisions,
        0,
        division({})
      ).marched
    ).toBeCloseTo(0.7, 10);
  });

  it("should stand still when the division already stands on its border at peace", () => {
    const posted = startingWith({
      divisions: [division({ movingTo: 1, nation: 0, province: 1 })],
      economies: [NO_ECONOMY, NO_ECONOMY],
    });

    expect(
      armiesAfterOneDay(LINE_WORLD, { ...WAR_COMMAND, wars: noWars(2) }, posted)
        .divisions
    ).toStrictEqual([
      division({ entrenchment: 1, movingTo: 1, nation: 0, province: 1 }),
    ]);
  });

  it("should send all but the garrison into the enemy's province when it is left undefended", () => {
    const massed = startingWith({
      divisions: [
        division({ movingTo: 1, nation: 0, province: 1 }),
        division({ movingTo: 1, nation: 0, province: 1 }),
      ],
      economies: [NO_ECONOMY, NO_ECONOMY],
    });

    expect(
      armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, massed).divisions
    ).toStrictEqual([
      division({
        entrenchment: 1,
        movingTo: 1,
        nation: 0,
        planning: 0.02,
        province: 1,
      }),
      division({ marched: 1, movingTo: 2, nation: 0, province: 1 }),
    ]);
  });

  it("should hold the line when a lone division is all that stands on it", () => {
    const alone = startingWith({
      divisions: [division({ movingTo: 1, nation: 0, province: 1 })],
      economies: [NO_ECONOMY, NO_ECONOMY],
    });

    expect(
      armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, alone).divisions
    ).toStrictEqual([
      division({
        entrenchment: 1,
        movingTo: 1,
        nation: 0,
        planning: 0.02,
        province: 1,
      }),
    ]);
  });

  it("should hold the line when the enemy's garrison outweighs the attack", () => {
    const outmatched = startingWith({
      divisions: [
        division({ movingTo: 1, nation: 0, province: 1 }),
        division({ movingTo: 1, nation: 0, province: 1 }),
        division({ movingTo: 2, nation: 1, province: 2 }),
      ],
      economies: [NO_ECONOMY, NO_ECONOMY],
    });

    expect(
      armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, outmatched)
        .divisions.filter((standing) => standing.nation === 0)
        .map((standing) => standing.movingTo)
    ).toStrictEqual([1, 1]);
  });

  it("should hold the line when a defensive stance asks for more than the attack brings", () => {
    const cautious = startingWith({
      divisions: [
        division({ movingTo: 1, nation: 0, province: 1 }),
        division({ movingTo: 1, nation: 0, province: 1 }),
        division({ movingTo: 1, nation: 0, province: 1 }),
        division({ movingTo: 2, nation: 1, province: 2 }),
      ],
      economies: [NO_ECONOMY, NO_ECONOMY],
    });

    expect(
      armiesAfterOneDay(
        LINE_WORLD,
        { ...WAR_COMMAND, stances: ["defensive", "balanced"] },
        cautious
      )
        .divisions.filter((standing) => standing.nation === 0)
        .map((standing) => standing.movingTo)
    ).toStrictEqual([1, 1, 1]);
  });

  it("should keep both sides where they stand when a battle is on in the province", () => {
    const attacker = division({ movingTo: 2, nation: 0, province: 2 });
    const defender = division({ movingTo: 2, nation: 1, province: 2 });
    const battle = startingWith({
      divisions: [attacker, defender],
      economies: [NO_ECONOMY, NO_ECONOMY],
    });

    expect(
      armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, battle).divisions.map(
        (standing) => standing.province
      )
    ).toStrictEqual([2, 2]);
  });

  it("should lose a broken division when its only ground behind it is taken the same day", () => {
    const pinned = startingWith({
      divisions: [
        division({ nation: 0, province: 2 }),
        division({ nation: 1, organisation: 1, province: 2 }),
        division({ nation: 0, province: 3 }),
      ],
      economies: [NO_ECONOMY, NO_ECONOMY],
    });

    expect(
      armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, pinned).divisions.filter(
        (standing) => standing.nation === 1
      )
    ).toStrictEqual([]);
  });

  it("should take the last of the loser's people and factories when it loses all its ground in a day", () => {
    const loser: NationEconomy = {
      ...NO_ECONOMY,
      civilianFactories: 4,
      militaryFactories: 2,
      population: 600_000,
    };
    const overrun = startingWith({
      divisions: [
        division({ nation: 0, province: 2 }),
        division({ nation: 0, province: 3 }),
      ],
      economies: [NO_ECONOMY, loser],
    });

    expect(
      armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, overrun).economies.at(1)
    ).toStrictEqual({
      ...loser,
      civilianFactories: 0,
      militaryFactories: 0,
      population: 0,
    });
  });

  it("should lose a division whose last men the day's attrition wears away when its supply does not reach it", () => {
    const cutOff = {
      ...WAR_COMMAND,
      supply: {
        ...FULL_SUPPLY,
        capacity: [0, 1].map(() =>
          Float32Array.from(LINE_WORLD.provinces, () => 0)
        ),
      },
    };
    const spent = startingWith({
      divisions: [division({ nation: 1, province: 3, strength: 50 })],
      economies: [NO_ECONOMY, NO_ECONOMY],
    });

    expect(
      armiesAfterOneDay(LINE_WORLD, cutOff, spent).divisions
    ).toStrictEqual([]);
  });

  describe("with the line full", () => {
    /** Nation 0's front province 1 supplies two divisions and already holds ten. */
    const fullLine = {
      ...WAR_COMMAND,
      supply: {
        ...FULL_SUPPLY,
        capacity: [
          Float32Array.from([1000, 2, 1000, 1000, 0]),
          Float32Array.from(LINE_WORLD.provinces, () => 1000),
        ],
        demand: new Map([[2, 10]]),
      },
    };

    it("should send the divisions past the line province's posting back into reserve when the whole line is full", () => {
      const crowded = startingWith({
        divisions: Array.from({ length: 10 }, () =>
          division({ nation: 0, province: 1 })
        ),
        economies: [NO_ECONOMY, NO_ECONOMY],
      });

      expect(
        armiesAfterOneDay(LINE_WORLD, fullLine, crowded).divisions.map(
          (moved) => moved.movingTo
        )
      ).toStrictEqual([1, 2, 0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it("should keep a reserve where it stands when the province behind the line has room for it", () => {
      const reserve = startingWith({
        divisions: Array.from({ length: 3 }, () =>
          division({ nation: 0, province: 0 })
        ),
        economies: [NO_ECONOMY, NO_ECONOMY],
      });

      expect(
        armiesAfterOneDay(LINE_WORLD, fullLine, reserve).divisions.map(
          (moved) => moved.movingTo
        )
      ).toStrictEqual([0, 0, 0]);
    });
  });

  describe("under a battle plan", () => {
    it.each([
      { defenders: 1, target: 1, why: "the attack outweighs its garrison" },
      {
        defenders: 3,
        target: 2,
        why: "its garrison outweighs the attack and the weaker neighbour does not",
      },
    ])(
      "should attack province $target when the capital's neighbour is held by $defenders and $why",
      ({ defenders, target }) => {
        expect(
          armiesAfterOneDay(FORK_WORLD, WAR_COMMAND, forkedWith(defenders))
            .divisions.filter((standing) => standing.nation === 0)
            .map((standing) => standing.movingTo)
        ).toStrictEqual([0, target, target, target]);
      }
    );

    it("should attack the weaker of two neighbours when the offensive runs as near its objective through both", () => {
      expect(
        armiesAfterOneDay(DIAMOND_WORLD, WAR_COMMAND, forkedWith(1))
          .divisions.filter((standing) => standing.nation === 0)
          .map((standing) => standing.movingTo)
      ).toStrictEqual([0, 2, 2, 2]);
    });

    it("should fall back onto its fallback line to regroup when a defender breaks", () => {
      const beaten = startingWith({
        divisions: [
          division({ movingTo: 2, nation: 0, province: 2 }),
          division({ movingTo: 2, nation: 1, organisation: 1, province: 2 }),
        ],
        economies: [NO_ECONOMY, NO_ECONOMY],
      });

      expect(
        armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, beaten)
          .divisions.filter((standing) => standing.nation === 1)
          .map(({ movingTo, organisation, province, task }) => ({
            movingTo,
            organisation,
            province,
            task,
          }))
      ).toStrictEqual([
        { movingTo: 3, organisation: 0, province: 3, task: "regroup" },
      ]);
    });

    it("should walk a regrouping division toward the fallback line when it has not recovered", () => {
      const regrouping = startingWith({
        divisions: [
          division({
            movingTo: 1,
            nation: 0,
            organisation: 10,
            province: 1,
            task: "regroup",
          }),
        ],
        economies: [NO_ECONOMY, NO_ECONOMY],
      });

      expect(
        armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, regrouping).divisions
      ).toStrictEqual([
        division({
          marched: 1,
          movingTo: 0,
          nation: 0,
          organisation: 13,
          province: 1,
          task: "regroup",
        }),
      ]);
    });

    it("should put a regrouping division back under the line's orders when it has recovered", () => {
      const recovered = startingWith({
        divisions: [
          division({
            marched: 1,
            movingTo: 1,
            nation: 0,
            organisation: 50,
            province: 0,
            task: "regroup",
          }),
        ],
        economies: [NO_ECONOMY, NO_ECONOMY],
      });

      expect(
        armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, recovered).divisions
      ).toStrictEqual([
        division({ entrenchment: 1, nation: 0, organisation: 53, province: 0 }),
      ]);
    });
  });

  describe("preparing for battle", () => {
    it("should abandon the trenches and spend the planning of the divisions it sends on when the enemy province beside them is undefended", () => {
      const massed = startingWith({
        divisions: [
          division({
            entrenchment: 5,
            movingTo: 1,
            nation: 0,
            planning: 0.3,
            province: 1,
          }),
          division({
            entrenchment: 5,
            movingTo: 1,
            nation: 0,
            planning: 0.3,
            province: 1,
          }),
        ],
        economies: [NO_ECONOMY, NO_ECONOMY],
      });

      expect(
        preparation(armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, massed))
      ).toStrictEqual([
        { entrenchment: 6, planning: 0.3 },
        { entrenchment: 0, planning: 0.29 },
      ]);
    });

    it("should abandon the trenches of a division when it arrives in a new province", () => {
      const arriving = startingWith({
        divisions: [
          division({
            entrenchment: 5,
            marched: 1,
            movingTo: 1,
            nation: 0,
            planning: 0.3,
            province: 0,
          }),
        ],
        economies: [NO_ECONOMY, NO_ECONOMY],
      });

      expect(
        preparation(armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, arriving))
      ).toStrictEqual([{ entrenchment: 0, planning: 0.29 }]);
    });

    it("should abandon the trenches of a division when it sets out behind its own line", () => {
      const reserve = startingWith({
        divisions: [
          division({ entrenchment: 5, nation: 0, planning: 0.3, province: 0 }),
        ],
        economies: [NO_ECONOMY, NO_ECONOMY],
      });

      expect(
        preparation(armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, reserve))
      ).toStrictEqual([{ entrenchment: 0, planning: 0.29 }]);
    });

    it("should spend the planning of an attacker when it takes the undefended province it stands in", () => {
      const taking = startingWith({
        divisions: [
          division({ movingTo: 2, nation: 0, planning: 0.3, province: 2 }),
        ],
        economies: [NO_ECONOMY, NO_ECONOMY],
      });

      expect(
        preparation(armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, taking))
      ).toStrictEqual([{ entrenchment: 0, planning: 0.29 }]);
    });

    it("should spend the attacker's planning and keep the defender's trenches when a battle is on in the province", () => {
      const battle = startingWith({
        divisions: [
          division({
            entrenchment: 5,
            movingTo: 2,
            nation: 0,
            planning: 0.3,
            province: 2,
          }),
          division({
            entrenchment: 5,
            movingTo: 2,
            nation: 1,
            planning: 0.3,
            province: 2,
          }),
        ],
        economies: [NO_ECONOMY, NO_ECONOMY],
      });

      expect(
        preparation(armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, battle))
      ).toStrictEqual([
        { entrenchment: 0, planning: 0.29 },
        { entrenchment: 5, planning: 0.3 },
      ]);
    });
  });
});
