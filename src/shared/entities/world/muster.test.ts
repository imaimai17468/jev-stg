import { describe, expect, it } from "vite-plus/test";
import { AT_WAR, division, LINE_OWNERS, LINE_WORLD } from "./army-fixture";
import type { Diplomacy } from "./diplomacy";
import { joined, openingDiplomacy } from "./diplomacy";
import { sentHome } from "./muster";
import { UNASSIGNED } from "./spread";

/** The line's two nations at peace, and the same two at war. */
const PEACE: Diplomacy = openingDiplomacy(LINE_OWNERS, 2, []);
const WAR: Diplomacy = { ...PEACE, wars: AT_WAR };

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
