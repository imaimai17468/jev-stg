import { describe, expect, it } from "vite-plus/test";
import { AT_WAR, LINE_WORLD } from "./army-fixture";
import type { Diplomacy } from "./diplomacy/diplomacy";
import { openingDiplomacy } from "./diplomacy/diplomacy";
import type { Skies } from "./skies";
import {
  combatKeptUnder,
  paceUnder,
  skiesBelow,
  skyLostBy,
  superiorityOf,
} from "./skies";
import { UNASSIGNED } from "./spread";
import { declared, noWars } from "./wars";

/** Nations 0 and 1 at war, and nation 2 at peace with both. */
const TWO_AT_WAR_ONE_NEUTRAL: Diplomacy = {
  ...openingDiplomacy(Int32Array.from([0, 1, 2]), 3, []),
  wars: declared(noWars(3), { one: 0, other: 1 }),
};

/**
 * Three regions: nation 1 outflies nation 0 in the second, nation 0 outflies
 * it in the first, and nobody flies over the third; the neutral nation flies
 * over the first.
 */
const THREE_REGIONS: Skies = {
  diplomacy: TWO_AT_WAR_ONE_NEUTRAL,
  power: [
    Float32Array.from([30, 0, 0]),
    Float32Array.from([10, 50, 0]),
    Float32Array.from([100, 0, 0]),
  ],
};

/** The line world's two regions, nation 0 ahead over the land and nation 1 alone over the sea. */
const LINE_SKIES: Skies = {
  diplomacy: {
    ...openingDiplomacy(Int32Array.from([0, 0, 1, 1, UNASSIGNED]), 2, []),
    wars: AT_WAR,
  },
  power: [Float32Array.from([30, 0]), Float32Array.from([10, 50])],
};

describe(superiorityOf, () => {
  it("should share each sky between the nation's side and its enemies and leave an empty sky at none when a neutral flies too", () => {
    expect(superiorityOf(THREE_REGIONS, 0)).toStrictEqual({
      enemy: Float32Array.from([0.25, 1, 0]),
      own: Float32Array.from([0.75, 0, 0]),
    });
  });
});

describe(combatKeptUnder, () => {
  it.each<{ enemy: number; kept: number }>([
    { enemy: 0.4, kept: 1 },
    { enemy: 0.6, kept: 0.93 },
    { enemy: 1, kept: 0.65 },
  ])(
    "should keep $kept of their worth in battle when the enemy holds $enemy of the sky",
    ({ enemy, kept }) => {
      expect(combatKeptUnder(enemy)).toBeCloseTo(kept);
    }
  );
});

describe(paceUnder, () => {
  it.each<{ enemy: number; kept: number }>([
    { enemy: 0.4, kept: 1 },
    { enemy: 1, kept: 0.7 },
  ])(
    "should keep $kept of their speed when the enemy holds $enemy of the sky",
    ({ enemy, kept }) => {
      expect(paceUnder(enemy)).toBeCloseTo(kept);
    }
  );
});

describe(skiesBelow, () => {
  it("should lay each nation's shares over the provinces of each region when two nations fight over two regions", () => {
    expect(skiesBelow(LINE_SKIES, LINE_WORLD.airspace, 5)).toStrictEqual({
      enemy: [
        Float32Array.from([0.25, 0.25, 0.25, 0.25, 1]),
        Float32Array.from([0.75, 0.75, 0.75, 0.75, 0]),
      ],
      lift: [
        Float32Array.from([0.75, 0.75, 0.75, 0.75, 0]),
        Float32Array.from([0.25, 0.25, 0.25, 0.25, 1]),
      ],
    });
  });
});

/** Nations 0 and 1 at war, and nobody else. */
const TWO_AT_WAR: Diplomacy = {
  ...openingDiplomacy(Int32Array.from([0, 1]), 2, []),
  wars: AT_WAR,
};

describe(skyLostBy, () => {
  it("should count the share of the skies both sides fly over that the enemy holds above six tenths when they meet over some regions", () => {
    const skies: Skies = {
      diplomacy: TWO_AT_WAR,
      power: [
        Float32Array.from([30, 10, 0, 0]),
        Float32Array.from([10, 50, 20, 0]),
      ],
    };

    expect(skyLostBy(skies, 0)).toBe(0.5);
  });

  it("should count none when the enemy flies only where the nation does not", () => {
    const skies: Skies = {
      diplomacy: TWO_AT_WAR,
      power: [Float32Array.from([30, 0]), Float32Array.from([0, 50])],
    };

    expect(skyLostBy(skies, 0)).toBe(0);
  });

  it("should count none when no enemy flies anywhere", () => {
    expect(skyLostBy(THREE_REGIONS, 2)).toBe(0);
  });
});
