import { describe, expect, it } from "vite-plus/test";
import type { Agency, AgencyUpgrade } from "./agency";
import { NO_AGENCY } from "./agency";
import { AT_WAR, division } from "./army-fixture";
import type { Ciphers } from "./cipher";
import { noCiphers } from "./cipher";
import { joined, openingDiplomacy } from "./diplomacy";
import type { Fighting, Gleaned, IntelLevels, Sources } from "./intel";
import {
  clashesOf,
  extractedOneDay,
  foughtOneDay,
  intelOn,
  intelTableOf,
  NO_INTEL,
  noGleaned,
} from "./intel";
import type { Navy } from "./navy";
import { NO_NAVY } from "./navy";
import type { Random } from "./random";
import { launched } from "./ships";
import { noWars } from "./wars";

/** Two nations with nothing in the field, the sea or the air, at war with each other. */
const QUIET: Fighting = {
  divisions: [],
  nations: 2,
  navies: [NO_NAVY, NO_NAVY],
  power: [],
  wars: AT_WAR,
};

/** A navy with only its main fleet at sea, `ships` destroyers in `zone`. */
const fleetIn = (zone: number, ships: number): Navy => ({
  ...NO_NAVY,
  fleets: [
    {
      mission: "patrol",
      role: "main",
      ships: Array.from({ length: ships }, () => launched("destroyer-2")),
      zone,
    },
  ],
});

describe(clashesOf, () => {
  it("should count a battle and each side's enemy divisions for both nations when they are at war in one province", () => {
    const fighting: Fighting = {
      ...QUIET,
      divisions: [
        division({ nation: 0, province: 2 }),
        division({ nation: 0, province: 2 }),
        division({ nation: 1, province: 2 }),
      ],
    };

    expect([...clashesOf(fighting)]).toStrictEqual([
      0, 0, 0, 0.015, 0, 0, 0.02, 0, 0, 0, 0, 0,
    ]);
  });

  it("should count nothing when the two nations standing in one province are at peace", () => {
    const fighting: Fighting = {
      ...QUIET,
      divisions: [
        division({ nation: 0, province: 2 }),
        division({ nation: 1, province: 2 }),
      ],
      wars: noWars(2),
    };

    expect([...clashesOf(fighting)]).toStrictEqual(
      Array.from({ length: 12 }, () => 0)
    );
  });

  it("should count a naval battle and each side's enemy ships when both nations have ships in one sea zone", () => {
    const fighting: Fighting = {
      ...QUIET,
      navies: [fleetIn(4, 2), fleetIn(4, 1)],
    };

    expect([...clashesOf(fighting)]).toStrictEqual([
      0, 0, 0, 0, 0.015, 0, 0, 0.02, 0, 0, 0, 0,
    ]);
  });

  it("should count an air battle over each region both nations flew over when either flew over another alone", () => {
    const fighting: Fighting = {
      ...QUIET,
      power: [Float32Array.from([0, 1]), Float32Array.from([1, 1])],
    };

    expect([...clashesOf(fighting)]).toStrictEqual([
      0, 0, 0, 0, 0, 0.01, 0, 0, 0.01, 0, 0, 0,
    ]);
  });
});

/** What nation 0 has gathered on nation 1 by fighting, army, navy and air in that order. */
const gleanedFighting = (army: number, navy: number, air: number): Gleaned => ({
  ...noGleaned(2),
  fought: Float32Array.from([0, 0, 0, army, navy, air, 0, 0, 0, 0, 0, 0]),
});

/** A day's fighting for nation 0 against nation 1 with `base` of each kind. */
const clashOf = (army: number, navy: number, air: number): Float64Array =>
  Float64Array.from([0, 0, 0, army, navy, air, 0, 0, 0, 0, 0, 0]);

/** What nation 0 has gathered on nation 1 by fighting, army, navy and air. */
const foughtOnOne = (gleaned: Gleaned): readonly number[] => [
  ...gleaned.fought.subarray(3, 6),
];

describe(foughtOneDay, () => {
  it("should gather a quarter of the log of one plus the base and a tenth of it when a land battle is fought", () => {
    const [army] = foughtOnOne(
      foughtOneDay(noGleaned(2), clashOf(0.015, 0, 0))
    );

    expect(army).toBeCloseTo(0.25 * Math.log1p(0.015) + 0.0015, 6);
  });

  it("should gather the log of one plus a fifth of the base and a tenth of it when an air battle is fought", () => {
    const air = foughtOnOne(foughtOneDay(noGleaned(2), clashOf(0, 0, 0.5))).at(
      2
    );

    expect(air).toBeCloseTo(Math.log1p(0.1) + 0.05, 6);
  });

  it("should stop at each kind's cap when the day's fighting would gather more", () => {
    expect(
      foughtOnOne(foughtOneDay(noGleaned(2), clashOf(100, 100_000, 100)))
    ).toStrictEqual([Math.fround(0.3), Math.fround(0.4), Math.fround(0.25)]);
  });

  it("should keep 98.5% of what it had when no fighting happens that day", () => {
    const [army] = foughtOnOne(
      foughtOneDay(gleanedFighting(0.2, 0, 0), clashOf(0, 0, 0))
    );

    expect(army).toBeCloseTo(0.197, 6);
  });
});

/** A draw that always lands at the bottom of its range. */
const LOWEST: Random = { below: () => 0, unit: () => 0 };

/** What nation 0 has extracted from nation 1's operatives, each kind in order. */
const extractedOnOne = (gleaned: Gleaned): readonly number[] => [
  ...gleaned.extracted.subarray(4, 8),
];

/** An agency founded with `upgrades` bought. */
const agencyWith = (upgrades: readonly AgencyUpgrade[]): Agency => ({
  ...NO_AGENCY,
  standing: "founded",
  upgrades,
});

/** Nation 0 holding one of nation 1's operatives, with `agency` running its interrogations. */
const holdingOne = (agency: Agency) => ({
  agencies: [agency, NO_AGENCY],
  held: Uint8Array.from([0, 1, 0, 0]),
});

/** What one captive gives up a day at the lowest draw. */
const LOWEST_GAIN = Math.log1p(0.03) + 0.015;

describe(extractedOneDay, () => {
  it("should gather the same of every kind from a captive when the captor holds one of the spy's operatives", () => {
    expect(
      extractedOnOne(
        extractedOneDay(noGleaned(2), holdingOne(NO_AGENCY), LOWEST)
      )
    ).toStrictEqual(Array.from({ length: 4 }, () => Math.fround(LOWEST_GAIN)));
  });

  it("should gather a quarter more when the captor's agency knows interrogation techniques", () => {
    const [civilian] = extractedOnOne(
      extractedOneDay(
        noGleaned(2),
        holdingOne(agencyWith(["interrogation-techniques"])),
        LOWEST
      )
    );

    expect(civilian).toBeCloseTo(LOWEST_GAIN * 1.25, 6);
  });

  it("should stop at each kind's cap when the captive would give up more", () => {
    const full: Gleaned = {
      ...noGleaned(2),
      extracted: Float32Array.from([
        0, 0, 0, 0, 0.5, 0.4, 0.4, 0.3, 0, 0, 0, 0, 0, 0, 0, 0,
      ]),
    };

    expect(
      extractedOnOne(extractedOneDay(full, holdingOne(NO_AGENCY), LOWEST))
    ).toStrictEqual([0.5, 0.4, 0.4, 0.3].map(Math.fround));
  });

  it("should keep 95% of what captives gave up when the captor holds none of the spy's operatives", () => {
    const held: Gleaned = {
      ...noGleaned(2),
      extracted: Float32Array.from([
        0, 0, 0, 0, 0.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ]),
    };

    const [civilian] = extractedOnOne(
      extractedOneDay(held, { agencies: [], held: new Uint8Array(4) }, LOWEST)
    );

    expect(civilian).toBeCloseTo(0.19, 6);
  });
});

/** Two nations at peace, neither with any source on the other. */
const sourcesOf = (patch: Partial<Sources>): Sources => ({
  agencies: [NO_AGENCY, NO_AGENCY],
  ciphers: [noCiphers(2), noCiphers(2)],
  contacts: new Uint8Array(4),
  coverage: new Float32Array(4),
  diplomacy: openingDiplomacy(new Int32Array(0), 2, []),
  gleaned: noGleaned(2),
  infiltrated: new Uint8Array(16),
  nations: 2,
  tradeLaws: ["closed-economy", "closed-economy"],
  ...patch,
});

/** What nation 0 knows of nation 1 from `sources`. */
const zeroOnOne = (sources: Sources): IntelLevels =>
  intelOn(intelTableOf(sources), 0, 1);

/** `levels` as a `Float32Array` holds them. */
const stored = (levels: IntelLevels): IntelLevels => ({
  air: Math.fround(levels.air),
  army: Math.fround(levels.army),
  civilian: Math.fround(levels.civilian),
  navy: Math.fround(levels.navy),
});

/** Nation 0's ciphers with `progress` put into nation 1's and `revealed` days of its reveal left. */
const cipherOnOne = (progress: number, revealed: number): Ciphers => ({
  progress: Float64Array.from([0, progress]),
  revealed: Uint8Array.from([0, revealed]),
});

/** Nation 0's infiltration of nation 1's army. */
const ARMY_INFILTRATED = Uint8Array.from([
  0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]);

describe(intelTableOf, () => {
  it("should know nothing of a nation when no source reaches it", () => {
    expect(zeroOnOne(sourcesOf({}))).toStrictEqual(NO_INTEL);
  });

  it("should see into the economy and the navy of a nation when that nation trades freely", () => {
    expect(
      zeroOnOne(sourcesOf({ tradeLaws: ["closed-economy", "free-trade"] }))
    ).toStrictEqual(stored({ ...NO_INTEL, civilian: 0.4, navy: 0.2 }));
  });

  it("should gather half of each kind's network cap when the network counts in a quarter of the nation's land", () => {
    expect(
      zeroOnOne(sourcesOf({ coverage: Float32Array.from([0, 0.25, 0, 0]) }))
    ).toStrictEqual(
      stored({ air: 0.15, army: 0.15, civilian: 0.15, navy: 0.2 })
    );
  });

  it("should gather a tenth of a kind when the observer has infiltrated it", () => {
    expect(
      zeroOnOne(sourcesOf({ infiltrated: ARMY_INFILTRATED }))
    ).toStrictEqual(stored({ ...NO_INTEL, army: 0.1 }));
  });

  it("should gather a fifth more from its assets when the observer's agency has invisible ink", () => {
    expect(
      zeroOnOne(
        sourcesOf({
          agencies: [agencyWith(["invisible-ink"]), NO_AGENCY],
          infiltrated: ARMY_INFILTRATED,
        })
      )
    ).toStrictEqual(stored({ ...NO_INTEL, army: 0.12 }));
  });

  it("should gather a twentieth of the army when the observer holds resistance contacts against the nation", () => {
    expect(
      zeroOnOne(sourcesOf({ contacts: Uint8Array.from([0, 1, 0, 0]) }))
    ).toStrictEqual(stored({ ...NO_INTEL, army: 0.05 }));
  });

  it("should raise a kind by a quarter when the observer's agency has that kind's department", () => {
    expect(
      zeroOnOne(
        sourcesOf({
          agencies: [agencyWith(["army-department"]), NO_AGENCY],
          contacts: Uint8Array.from([0, 1, 0, 0]),
        })
      )
    ).toStrictEqual(stored({ ...NO_INTEL, army: 0.0625 }));
  });

  it("should gather nothing from a cipher when the observer has not yet broken it", () => {
    expect(
      zeroOnOne(sourcesOf({ ciphers: [cipherOnOne(11_999, 0), noCiphers(2)] }))
    ).toStrictEqual(NO_INTEL);
  });

  it("should gather a tenth of every kind when the observer has broken the nation's cipher", () => {
    expect(
      zeroOnOne(sourcesOf({ ciphers: [cipherOnOne(12_000, 0), noCiphers(2)] }))
    ).toStrictEqual(stored({ air: 0.1, army: 0.1, civilian: 0.1, navy: 0.1 }));
  });

  it("should gather three fifths of every kind when the observer is reading the nation's revealed cipher", () => {
    expect(
      zeroOnOne(sourcesOf({ ciphers: [cipherOnOne(12_000, 30), noCiphers(2)] }))
    ).toStrictEqual(stored({ air: 0.6, army: 0.6, civilian: 0.6, navy: 0.6 }));
  });

  it("should add what fighting and captives gathered when the observer has both", () => {
    const gleaned: Gleaned = {
      extracted: Float32Array.from([
        0, 0, 0, 0, 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ]),
      fought: Float32Array.from([0, 0, 0, 0.1, 0.2, 0.25, 0, 0, 0, 0, 0, 0]),
      nations: 2,
    };

    expect(zeroOnOne(sourcesOf({ gleaned }))).toStrictEqual(
      stored({ air: 0.25, army: 0.1, civilian: 0.1, navy: 0.2 })
    );
  });

  it("should know no more than everything when the sources add up past it", () => {
    expect(
      zeroOnOne(
        sourcesOf({
          ciphers: [cipherOnOne(12_000, 30), noCiphers(2)],
          coverage: Float32Array.from([0, 0.5, 0, 0]),
          tradeLaws: ["closed-economy", "free-trade"],
        })
      ).civilian
    ).toBe(1);
  });

  it("should know nothing of itself when it trades freely", () => {
    expect(
      intelOn(
        intelTableOf(sourcesOf({ tradeLaws: ["free-trade", "free-trade"] })),
        0,
        0
      )
    ).toStrictEqual(NO_INTEL);
  });
});

/** Three nations with nations 0 and 1 in one faction, where only `observer` has infiltrated `target`'s army. */
const infiltratedAmong = (observer: number, target: number): Sources => ({
  agencies: [NO_AGENCY, NO_AGENCY, NO_AGENCY],
  ciphers: [],
  contacts: new Uint8Array(9),
  coverage: new Float32Array(9),
  diplomacy: joined(openingDiplomacy(new Int32Array(0), 3, [0]), 1, 0),
  gleaned: noGleaned(3),
  infiltrated: Uint8Array.from({ length: 36 }, (_, slot) =>
    Number(slot === (observer * 3 + target) * 4 + 1)
  ),
  nations: 3,
  tradeLaws: [],
});

describe("intelTableOf among allies", () => {
  it("should gain 30% of an ally's lead when the ally knows more of a third nation", () => {
    expect(intelOn(intelTableOf(infiltratedAmong(1, 2)), 0, 2)).toStrictEqual(
      stored({ ...NO_INTEL, army: 0.3 * Math.fround(0.1) })
    );
  });

  it("should learn nothing of itself when its ally knows something of it", () => {
    expect(intelOn(intelTableOf(infiltratedAmong(1, 0)), 0, 0)).toStrictEqual(
      NO_INTEL
    );
  });

  it("should gain nothing from what a nation outside its faction knows when that nation knows more", () => {
    expect(intelOn(intelTableOf(infiltratedAmong(2, 1)), 0, 1)).toStrictEqual(
      NO_INTEL
    );
  });
});
