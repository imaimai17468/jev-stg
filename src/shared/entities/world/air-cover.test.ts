import { describe, expect, it } from "vite-plus/test";
import type { AirCover, Battlefield } from "./air-cover";
import { coverOver, NO_AIR_COVER, supportOf } from "./air-cover";
import { AT_WAR, division, LINE_OWNERS, LINE_WORLD } from "./army-fixture";

/**
 * Nation 0's enemies hold most of the sky over its second province, and it
 * flies five planes of support there carrying forty ground attack.
 */
const COVER: AirCover = {
  enemy: [Float32Array.from([0.25, 0.75])],
  support: [Float32Array.from([0, 5])],
  supportAttack: [Float32Array.from([0, 40])],
};

/**
 * The line at war: nation 0 stands on its own ground in province 0 and on
 * nation 1's in province 2, nation 1 stands on nation 0's in province 1, and
 * nation 0 has a division in the sea zone nobody holds.
 */
const LINE_BATTLES: Battlefield = {
  airspace: LINE_WORLD.airspace,
  divisions: [
    division({ nation: 0, province: 0 }),
    division({ nation: 0, province: 2 }),
    division({ nation: 1, province: 1 }),
    division({ nation: 0, province: 4 }),
  ],
  owners: LINE_OWNERS,
  wars: AT_WAR,
};

describe(coverOver, () => {
  it("should read the enemy's superiority over the province when the nation has cover", () => {
    expect(coverOver(COVER, "enemy", 0, 1)).toBe(0.75);
  });

  it("should read the support the nation sends into the province when it flies some", () => {
    expect(coverOver(COVER, "support", 0, 1)).toBe(5);
  });

  it("should read the ground attack the nation's support carries into the province when it flies some", () => {
    expect(coverOver(COVER, "supportAttack", 0, 1)).toBe(40);
  });

  it("should read none when the nation has nothing overhead", () => {
    expect(coverOver(NO_AIR_COVER, "enemy", 0, 1)).toBe(0);
  });
});

describe(supportOf, () => {
  it("should spread each nation's planes and their ground attack over a region evenly among the battles it fights there when divisions stand on enemy ground", () => {
    expect(
      supportOf(
        LINE_BATTLES,
        {
          support: [Float32Array.from([40, 0]), Float32Array.from([10, 0])],
          supportAttack: [
            Float32Array.from([320, 0]),
            Float32Array.from([80, 0]),
          ],
        },
        5
      )
    ).toStrictEqual({
      support: [
        Float32Array.from([0, 20, 20, 0, 0]),
        Float32Array.from([0, 5, 5, 0, 0]),
      ],
      supportAttack: [
        Float32Array.from([0, 160, 160, 0, 0]),
        Float32Array.from([0, 40, 40, 0, 0]),
      ],
    });
  });
});
