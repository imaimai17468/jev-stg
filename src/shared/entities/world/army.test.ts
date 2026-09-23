import { describe, expect, it } from "vite-plus/test";
import type { Armies } from "./army";
import { armiesAfterOneDay } from "./army";
import {
  division,
  FULL_SUPPLY,
  LINE_OWNERS,
  LINE_WORLD,
  WAR_COMMAND,
} from "./army-fixture";
import type { NationEconomy } from "./economy";
import { NO_ECONOMY } from "./economy";
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

describe(armiesAfterOneDay, () => {
  it("should raise a division at the capital and take its cost out when a nation can afford one", () => {
    expect(
      armiesAfterOneDay(LINE_WORLD, WAR_COMMAND, startingWith({}))
    ).toStrictEqual({
      divisions: [division({ marched: 1, movingTo: 1, nation: 0 })],
      economies: [{ ...ARMED, equipment: 500, manpower: 10_000 }, NO_ECONOMY],
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

  it("should stand still when the division already stands on its border at peace", () => {
    const posted = startingWith({
      divisions: [division({ movingTo: 1, nation: 0, province: 1 })],
      economies: [NO_ECONOMY, NO_ECONOMY],
    });

    expect(
      armiesAfterOneDay(LINE_WORLD, { ...WAR_COMMAND, wars: noWars(2) }, posted)
        .divisions
    ).toStrictEqual([division({ movingTo: 1, nation: 0, province: 1 })]);
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
      division({ movingTo: 1, nation: 0, province: 1 }),
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
    ).toStrictEqual([division({ movingTo: 1, nation: 0, province: 1 })]);
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
});
