import { describe, expect, it } from "vite-plus/test";
import { AT_WAR, division, LINE_OWNERS, LINE_WORLD } from "./army-fixture";
import type { Diplomacy } from "./diplomacy";
import { joined, openingDiplomacy } from "./diplomacy";
import type { DivisionKind, Levy } from "./divisions";
import { raisedAt } from "./divisions";
import type { NationEconomy } from "./economy";
import { NO_ECONOMY } from "./economy";
import { musteredBy, sentHome } from "./muster";
import type { Nation } from "./nations";
import { UNASSIGNED } from "./spread";

/** The line's two nations at peace, and the same two at war. */
const PEACE: Diplomacy = openingDiplomacy(LINE_OWNERS, 2, []);
const WAR: Diplomacy = { ...PEACE, wars: AT_WAR };

/**
 * One division at home of the last kind it may raise for each step of the
 * nation's id and one more, each counted as recruited.
 */
const byId = (
  economy: NationEconomy,
  nation: Nation,
  home: number,
  unlocked: readonly DivisionKind[]
): Levy => ({
  divisions: Array.from({ length: nation.id + 1 }, () =>
    raisedAt(nation.id, home, unlocked.at(-1) ?? "infantry")
  ),
  economy: { ...economy, recruited: nation.id + 1 },
});

/** Infantry alone for the first nation, and cavalry besides for the second. */
const UNLOCKED_BY_ID: readonly (readonly DivisionKind[])[] = [
  ["infantry"],
  ["infantry", "cavalry"],
];

const unlockedById = (nation: number): readonly DivisionKind[] =>
  UNLOCKED_BY_ID.at(nation) ?? [];

describe(musteredBy, () => {
  it("should stand each nation's levy of the kinds it may raise at its capital and keep what it paid when it holds ground", () => {
    expect(
      musteredBy(
        LINE_WORLD,
        LINE_OWNERS,
        [NO_ECONOMY, NO_ECONOMY],
        unlockedById,
        byId
      )
    ).toStrictEqual({
      divisions: [
        raisedAt(0, 0, "infantry"),
        raisedAt(1, 3, "cavalry"),
        raisedAt(1, 3, "cavalry"),
      ],
      economies: [
        { ...NO_ECONOMY, recruited: 1 },
        { ...NO_ECONOMY, recruited: 2 },
      ],
    });
  });

  it("should raise nothing and leave the economy alone when the nation holds no ground", () => {
    expect(
      musteredBy(
        LINE_WORLD,
        Int32Array.from(LINE_WORLD.provinces, () => UNASSIGNED),
        [NO_ECONOMY, NO_ECONOMY],
        unlockedById,
        byId
      )
    ).toStrictEqual({ divisions: [], economies: [NO_ECONOMY, NO_ECONOMY] });
  });
});

describe(sentHome, () => {
  it("should leave a division where it stands when the ground is its own", () => {
    expect(
      sentHome(LINE_WORLD, LINE_OWNERS, PEACE, [division({ province: 1 })])
    ).toStrictEqual([division({ province: 1 })]);
  });

  it("should leave a division where it stands when it is at war with the ground's holder", () => {
    expect(
      sentHome(LINE_WORLD, LINE_OWNERS, WAR, [division({ province: 2 })])
    ).toStrictEqual([division({ province: 2 })]);
  });

  it("should send a division to its capital when peace leaves it on foreign ground", () => {
    const stranded = division({ marched: 1, movingTo: 3, province: 2 });

    expect(sentHome(LINE_WORLD, LINE_OWNERS, PEACE, [stranded])).toStrictEqual([
      division({ marched: 0, movingTo: 0, province: 0 }),
    ]);
  });

  it("should send a division home on foot when peace leaves it on the beach it landed on", () => {
    const beached = division({ arrival: "landing", province: 2 });

    expect(sentHome(LINE_WORLD, LINE_OWNERS, PEACE, [beached])).toStrictEqual([
      division({ movingTo: 0, province: 0 }),
    ]);
  });

  it("should disband a division when its nation holds no ground to return to", () => {
    const lost = Int32Array.from([1, 1, 1, 1, UNASSIGNED]);

    expect(
      sentHome(LINE_WORLD, lost, PEACE, [division({ province: 2 })])
    ).toStrictEqual([]);
  });

  it("should leave a division where it stands when the ground is its ally's", () => {
    const allies = joined(openingDiplomacy(LINE_OWNERS, 2, [1]), 0, 1);

    expect(
      sentHome(LINE_WORLD, LINE_OWNERS, allies, [division({ province: 2 })])
    ).toStrictEqual([division({ province: 2 })]);
  });
});
