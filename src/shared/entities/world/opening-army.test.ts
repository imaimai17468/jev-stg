import { describe, expect, it } from "vite-plus/test";
import { land, nation, sea, worldOf } from "./army-fixture";
import type { Division, DivisionKind, Task } from "./divisions";
import { raisedAt } from "./divisions";
import type { NationEconomy } from "./economy/economy";
import { NO_ECONOMY } from "./economy/economy";
import type { Nation } from "./geography/nations";
import { groundOf, openingLevyIn, openingPostsOf } from "./opening-army";
import { UNASSIGNED } from "./spread";

/** `count` infantry divisions' kinds. */
const infantry = (count: number): readonly DivisionKind[] =>
  Array.from({ length: count }, () => "infantry");

const manned = (manpower: number): NationEconomy => ({
  ...NO_ECONOMY,
  manpower,
});

/** `count` divisions of `owner` at `province`, each set to `task`. */
const posted = (
  count: number,
  owner: number,
  province: number,
  task: Task
): readonly Division[] =>
  Array.from({ length: count }, () => ({
    ...raisedAt(owner, province, "infantry"),
    task,
  }));

/**
 * Nation 0 holds a coastal capital in 0, a port behind it in 1, a border
 * province in 2 facing nation 1's 3 and 4, and an island in 6 across the
 * sea zone 5.
 */
const EMPIRE = worldOf(
  [nation(0, 0), nation(1, 3)],
  [
    land(0, [1, 5]),
    land(1, [0, 2, 5]),
    land(2, [1, 3]),
    land(3, [2, 4]),
    land(4, [3]),
    sea(5, [0, 1, 6]),
    land(6, [5]),
  ]
);
const EMPIRE_OWNERS = Int32Array.from([0, 0, 0, 1, 1, UNASSIGNED, 0]);

/** Nation 0's capital in 0 between its provinces 1 and 2, which face nation 1's 3 and nation 2's 4. */
const BETWEEN = worldOf(
  [nation(0, 0), nation(1, 3), nation(2, 4)],
  [
    land(0, [1, 2]),
    land(1, [0, 3]),
    land(2, [0, 4]),
    land(3, [1]),
    land(4, [2]),
  ]
);
const BETWEEN_OWNERS = Int32Array.from([0, 0, 0, 1, 2]);

const INDUSTRIAL: Nation = { ...nation(0, 0), leaning: "industry" };

describe(openingPostsOf, () => {
  it("should post divisions to the capital, the border, a home port and the ground overseas by the leaning's shares when the nation has all four", () => {
    expect(
      openingPostsOf(
        groundOf(EMPIRE, EMPIRE_OWNERS, []),
        nation(0, 0),
        0,
        infantry(20)
      )
    ).toStrictEqual([
      ...posted(2, 0, 0, "garrison"),
      ...posted(16, 0, 2, "line"),
      ...posted(1, 0, 1, "garrison"),
      ...posted(1, 0, 6, "garrison"),
    ]);
  });

  it("should put more of the border's divisions against the neighbour with more men when the nation faces two", () => {
    expect(
      openingPostsOf(
        groundOf(BETWEEN, BETWEEN_OWNERS, [
          NO_ECONOMY,
          manned(300_000),
          manned(100_000),
        ]),
        nation(0, 0),
        0,
        infantry(9)
      )
    ).toStrictEqual([
      ...posted(1, 0, 0, "garrison"),
      ...posted(6, 0, 1, "line"),
      ...posted(2, 0, 2, "line"),
    ]);
  });

  it("should deal a border's divisions over its provinces the most populous first when the border runs through several", () => {
    const world = worldOf(
      [nation(0, 0), nation(1, 3)],
      [
        land(0, [1, 2]),
        land(1, [0, 3]),
        { ...land(2, [0, 3]), cells: 20 },
        land(3, [1, 2]),
      ]
    );

    expect(
      openingPostsOf(
        groundOf(world, Int32Array.from([0, 0, 0, 1]), []),
        INDUSTRIAL,
        0,
        infantry(4)
      )
    ).toStrictEqual([
      ...posted(1, 0, 0, "garrison"),
      { ...raisedAt(0, 2, "infantry"), task: "line" },
      { ...raisedAt(0, 1, "infantry"), task: "line" },
      { ...raisedAt(0, 2, "infantry"), task: "line" },
    ]);
  });

  it("should keep every division at the capital when the nation has no border, port or ground overseas", () => {
    expect(
      openingPostsOf(
        groundOf(
          worldOf([nation(0, 0)], [land(0, [])]),
          Int32Array.from([0]),
          []
        ),
        nation(0, 0),
        0,
        infantry(3)
      )
    ).toStrictEqual(posted(3, 0, 0, "garrison"));
  });

  it("should raise each division as the kind at its place in the list when the kinds are mixed", () => {
    expect(
      openingPostsOf(
        groundOf(
          worldOf([nation(0, 0)], [land(0, [])]),
          Int32Array.from([0]),
          []
        ),
        nation(0, 0),
        0,
        ["infantry", "cavalry"]
      )
    ).toStrictEqual([
      { ...raisedAt(0, 0, "infantry"), task: "garrison" },
      { ...raisedAt(0, 0, "cavalry"), task: "garrison" },
    ]);
  });
});

describe(openingLevyIn, () => {
  it("should post as many divisions as the nation's manpower and leaning give it and call their men up when the world opens", () => {
    const levied = openingLevyIn(
      groundOf(worldOf([nation(0, 0)], [land(0, [])]), Int32Array.from([0]), [])
    );

    expect(
      levied(manned(100_000), nation(0, 0), 0, ["infantry", "cavalry"])
    ).toStrictEqual({
      divisions: posted(1, 0, 0, "garrison"),
      economy: { ...manned(80_000), recruited: 20_000 },
    });
  });
});
