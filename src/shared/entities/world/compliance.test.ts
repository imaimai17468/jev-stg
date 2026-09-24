import { describe, expect, it } from "vite-plus/test";
import { LINE_OWNERS, LINE_PLANTS, LINE_WORLD } from "./army-fixture";
import type { Compliance } from "./compliance";
import {
  compliedOneDay,
  FULL_REACH,
  occupancyOf,
  reachUnder,
  reachByNation,
  startCompliance,
} from "./compliance";
import { UNASSIGNED } from "./spread";

/** The line as it opened: provinces 0 and 1 are nation 0's, 2 and 3 nation 1's. */
const OPENED = startCompliance(LINE_OWNERS);

/** Nation 0 holding nation 1's province 2, halfway come round. */
const OCCUPIED: Compliance = {
  ...OPENED,
  holders: Int32Array.from([0, 0, 0, 1, UNASSIGNED]),
  levels: Float32Array.from([1, 1, 0.5, 1, 1]),
};

const OCCUPIED_OWNERS = Int32Array.from([0, 0, 0, 1, UNASSIGNED]);

/** No operatives stirring anything anywhere on the line. */
const CALM = new Float32Array(5);

/** Reach on the line for both nations, with `sabotage` keeping factories idle. */
const lineReach = (
  owners: Int32Array,
  compliance: Compliance,
  sabotage: Float32Array
) =>
  reachByNation(LINE_WORLD.provinces, owners, compliance, {
    nations: 2,
    plants: LINE_PLANTS,
    sabotage,
  });

/** The level of province 2 after one day with `owners` and `resistance`. */
const levelOfTwo = (
  compliance: Compliance,
  owners: Int32Array,
  resistance: Float32Array = CALM
): number => compliedOneDay(compliance, owners, resistance).levels[2] ?? -1;

describe(compliedOneDay, () => {
  it("should leave every province fully compliant when nobody has taken anything", () => {
    expect([...compliedOneDay(OPENED, LINE_OWNERS, CALM).levels]).toStrictEqual(
      [1, 1, 1, 1, 1]
    );
  });

  it("should start a province at no compliance when it is taken from the nation it belongs to", () => {
    expect(levelOfTwo(OPENED, OCCUPIED_OWNERS)).toBe(0);
  });

  it("should bring an occupied province a day further round when its occupier keeps it", () => {
    expect(levelOfTwo(OCCUPIED, OCCUPIED_OWNERS)).toBeCloseTo(0.500335, 6);
  });

  it("should slow an occupied province's gain by its resistance when operatives have stirred some", () => {
    expect(
      levelOfTwo(
        OCCUPIED,
        OCCUPIED_OWNERS,
        Float32Array.from([0, 0, 0.5, 0, 0])
      )
    ).toBeCloseTo(0.49996, 6);
  });

  it("should halve an occupied province's compliance when one occupier hands it to another", () => {
    expect(
      levelOfTwo(OCCUPIED, Int32Array.from([0, 0, 5, 1, UNASSIGNED]))
    ).toBe(0.25);
  });

  it("should give a province back its full compliance when the nation it belongs to retakes it", () => {
    expect(levelOfTwo(OCCUPIED, LINE_OWNERS)).toBe(1);
  });

  it("should record who each province's level is worked out for when a day passes", () => {
    expect([
      ...compliedOneDay(OPENED, OCCUPIED_OWNERS, CALM).holders,
    ]).toStrictEqual([0, 0, 0, 1, UNASSIGNED]);
  });
});

describe(occupancyOf, () => {
  it("should read home when the province is the holder's own ground", () => {
    expect(occupancyOf(OCCUPIED, 0, 0)).toStrictEqual({ kind: "home" });
  });

  it("should read the level it has come round to when the holder occupies the province", () => {
    expect(occupancyOf(OCCUPIED, 0, 2)).toStrictEqual({
      kind: "occupied",
      level: 0.5,
    });
  });

  it("should read ground as just taken when its level was worked out for another holder", () => {
    expect(occupancyOf(OPENED, 0, 2)).toStrictEqual({
      kind: "occupied",
      level: 0,
    });
  });
});

describe(reachUnder, () => {
  it("should draw on everything when the province is the holder's own ground", () => {
    expect(reachUnder(occupancyOf(OCCUPIED, 0, 0))).toStrictEqual(FULL_REACH);
  });

  it("should draw on occupied ground as far as its compliance goes when the holder occupies the province", () => {
    expect(reachUnder(occupancyOf(OCCUPIED, 0, 2))).toStrictEqual({
      factories: 0.25 + 0.65 * 0.5,
      manpower: 0.02 + 0.18 * 0.5,
    });
  });
});

describe(reachByNation, () => {
  it("should draw on everything when a nation holds only its own ground", () => {
    expect(lineReach(LINE_OWNERS, OPENED, CALM)).toStrictEqual([
      FULL_REACH,
      FULL_REACH,
    ]);
  });

  it("should draw on occupied ground as far as its compliance goes when a nation holds some", () => {
    const [occupier] = lineReach(OCCUPIED_OWNERS, OCCUPIED, CALM);

    expect(occupier).toStrictEqual({
      factories: 0.8583333333333334,
      manpower: 0.7033333333333334,
    });
  });

  it("should count ground as just taken when its level was worked out for another holder", () => {
    const [occupier] = lineReach(OCCUPIED_OWNERS, OPENED, CALM);

    expect(occupier).toStrictEqual({
      factories: (2 + 0.25) / 3,
      manpower: (2 + 0.02) / 3,
    });
  });

  it("should work fewer factories when sabotage keeps some of a nation's idle", () => {
    const [saboteur] = lineReach(
      LINE_OWNERS,
      OPENED,
      Float32Array.from([0.5, 0, 0, 0, 0])
    );

    expect(saboteur).toStrictEqual({ factories: 0.75, manpower: 1 });
  });

  it("should draw on everything when a nation holds nothing", () => {
    expect(
      lineReach(
        Int32Array.from([0, 0, 0, UNASSIGNED, UNASSIGNED]),
        OPENED,
        CALM
      ).at(1)
    ).toStrictEqual(FULL_REACH);
  });
});
