import { describe, expect, it } from "vite-plus/test";
import type { World } from "@/shared/entities/world";
import {
  AT_WAR,
  land,
  LINE_OWNERS,
  LINE_WORLD,
  nation,
  worldOf,
} from "@/shared/entities/world/army-fixture";
import { battlePlanOf } from "@/shared/entities/world/battle-plan";
import { graphOf } from "@/shared/entities/world/provinces";
import type { Wars } from "@/shared/entities/world/wars";
import { declared, noWars } from "@/shared/entities/world/wars";
import { frontMarks, frontsOf } from "./front-marks";

/** Every nation's battle plan on `world` under `wars`. */
const plansOn = (world: World, owners: Int32Array, wars: Wars) =>
  world.nations.map((planner) =>
    battlePlanOf(
      world.provinces,
      world.nations,
      graphOf(world.provinces),
      owners,
      wars,
      planner.id
    )
  );

/**
 * Two provinces on a lattice two cells wide and three tall: nation 0's
 * province 0 takes the left column and the middle row, and nation 1's
 * province 1 the right-hand cells above and below it.
 */
const NOTCHED_WORLD: World = {
  ...worldOf([nation(0, 0), nation(1, 1)], [land(0, [1]), land(1, [0])]),
  cellProvince: Int32Array.from([0, 1, 0, 0, 0, 1]),
  grid: { height: 3, width: 2 },
};

/** The same two provinces side by side, a column each. */
const STRAIGHT_WORLD: World = {
  ...NOTCHED_WORLD,
  cellProvince: Int32Array.from([0, 1, 0, 1]),
  grid: { height: 2, width: 2 },
};

const NOTCHED_OWNERS = Int32Array.from([0, 1]);

describe(frontMarks, () => {
  it("should draw each side's front on its own side of the border, its fallback line, and an arrow to the enemy capital when two nations are at war", () => {
    expect(
      frontMarks(
        LINE_WORLD,
        LINE_OWNERS,
        AT_WAR,
        plansOn(LINE_WORLD, LINE_OWNERS, AT_WAR)
      )
    ).toStrictEqual([
      {
        colour: { blue: 0, green: 0, red: 0 },
        fallback: [{ towardX: -1, towardY: 0, x1: 1, x2: 1, y1: 0, y2: 1 }],
        front: [{ towardX: -1, towardY: 0, x1: 2, x2: 2, y1: 0, y2: 1 }],
        nation: 0,
        offensives: [
          [
            { x: 1.5, y: 0 },
            { x: 2, y: 0 },
            { x: 3, y: 0 },
          ],
        ],
      },
      {
        colour: { blue: 0, green: 0, red: 0 },
        fallback: [{ towardX: 1, towardY: 0, x1: 3, x2: 3, y1: 0, y2: 1 }],
        front: [{ towardX: 1, towardY: 0, x1: 2, x2: 2, y1: 0, y2: 1 }],
        nation: 1,
        offensives: [
          [
            { x: 1.5, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 0 },
          ],
        ],
      },
    ]);
  });

  it("should draw nothing when nobody is at war", () => {
    expect(
      frontMarks(
        LINE_WORLD,
        LINE_OWNERS,
        noWars(2),
        plansOn(LINE_WORLD, LINE_OWNERS, noWars(2))
      )
    ).toStrictEqual([]);
  });

  it("should draw no arrow when no enemy capital is left to reach", () => {
    const capitalTaken = Int32Array.from([0, 0, 1, 0, -1]);

    expect(
      frontMarks(
        LINE_WORLD,
        capitalTaken,
        AT_WAR,
        plansOn(LINE_WORLD, capitalTaken, AT_WAR)
      ).at(0)?.offensives
    ).toStrictEqual([]);
  });

  it("should join the edges of a border into one when it runs straight", () => {
    expect(
      frontMarks(
        STRAIGHT_WORLD,
        NOTCHED_OWNERS,
        AT_WAR,
        plansOn(STRAIGHT_WORLD, NOTCHED_OWNERS, AT_WAR)
      ).at(0)?.front
    ).toStrictEqual([{ towardX: -1, towardY: 0, x1: 1, x2: 1, y1: 0, y2: 2 }]);
  });

  it("should break the edges of a border when it turns away", () => {
    expect(
      frontMarks(
        NOTCHED_WORLD,
        NOTCHED_OWNERS,
        AT_WAR,
        plansOn(NOTCHED_WORLD, NOTCHED_OWNERS, AT_WAR)
      ).at(0)?.front
    ).toStrictEqual([
      { towardX: 0, towardY: 1, x1: 1, x2: 2, y1: 1, y2: 1 },
      { towardX: 0, towardY: -1, x1: 1, x2: 2, y1: 2, y2: 2 },
      { towardX: -1, towardY: 0, x1: 1, x2: 1, y1: 0, y2: 1 },
      { towardX: -1, towardY: 0, x1: 1, x2: 1, y1: 2, y2: 3 },
    ]);
  });

  it("should draw nothing for a nation that has no front when others are at war", () => {
    const bystander: World = {
      ...LINE_WORLD,
      nations: [...LINE_WORLD.nations, nation(2, 0)],
    };
    const wars = declared(noWars(3), { one: 0, other: 1 });

    expect(
      frontMarks(
        bystander,
        LINE_OWNERS,
        wars,
        plansOn(bystander, LINE_OWNERS, wars)
      ).map((mark) => mark.nation)
    ).toStrictEqual([0, 1]);
  });
});

describe(frontsOf, () => {
  it("should draw every nation's battle plan when it draws the plans itself", () => {
    expect(frontsOf(LINE_WORLD, LINE_OWNERS, AT_WAR)).toStrictEqual(
      frontMarks(
        LINE_WORLD,
        LINE_OWNERS,
        AT_WAR,
        plansOn(LINE_WORLD, LINE_OWNERS, AT_WAR)
      )
    );
  });
});
