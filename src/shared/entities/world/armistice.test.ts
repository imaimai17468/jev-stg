import { describe, expect, it } from "vite-plus/test";
import {
  armisticesDue,
  noQuiet,
  quietOneDay,
  touchedBetween,
} from "./armistice";
import { AT_WAR, division, LINE_OWNERS, LINE_WORLD } from "./army-fixture";
import { ISLES_OWNERS, ISLES_WORLD } from "./navy/sea-fixture";
import { noWars } from "./wars";

/** Two nations that never touched. */
const untouched = (): boolean => false;

describe(noQuiet, () => {
  it("should count no quiet days for any pair when the table is new", () => {
    expect(noQuiet(2)).toStrictEqual(new Int32Array(4));
  });
});

describe(quietOneDay, () => {
  it("should count a day longer for a pair at war when the two did not touch", () => {
    expect(
      quietOneDay(Int32Array.from([0, 5, 5, 0]), AT_WAR, untouched)
    ).toStrictEqual(Int32Array.from([0, 6, 6, 0]));
  });

  it("should start the count again when a pair at war touched today", () => {
    expect(
      quietOneDay(Int32Array.from([0, 5, 5, 0]), AT_WAR, () => true)
    ).toStrictEqual(noQuiet(2));
  });

  it("should count nothing for a pair at peace when the two did not touch", () => {
    expect(
      quietOneDay(Int32Array.from([0, 5, 5, 0]), noWars(2), untouched)
    ).toStrictEqual(noQuiet(2));
  });
});

describe(armisticesDue, () => {
  it("should name the pair when it has gone a hundred and eighty days without touching", () => {
    expect(armisticesDue(Int32Array.from([0, 180, 180, 0]), 2)).toStrictEqual([
      { one: 0, other: 1 },
    ]);
  });

  it("should name nobody when the pair is a day short of a hundred and eighty", () => {
    expect(armisticesDue(Int32Array.from([0, 179, 179, 0]), 2)).toStrictEqual(
      []
    );
  });
});

describe(touchedBetween, () => {
  it("should read a touch when the two nations' ground borders", () => {
    expect(touchedBetween(LINE_WORLD, LINE_OWNERS, [])(0, 1)).toBeTruthy();
  });

  it("should read no touch when the sea parts the two nations and nobody stands on the other's ground", () => {
    expect(
      touchedBetween(ISLES_WORLD, ISLES_OWNERS, [
        division({ nation: 0, province: 0 }),
      ])(0, 1)
    ).toBeFalsy();
  });

  it("should read no touch between two others when a division stands on ground nobody holds", () => {
    expect(
      touchedBetween(ISLES_WORLD, ISLES_OWNERS, [
        division({ nation: 1, province: 5 }),
      ])(0, 1)
    ).toBeFalsy();
  });

  it("should read a touch asked the other way round when a division of one stands on the other's ground", () => {
    expect(
      touchedBetween(ISLES_WORLD, ISLES_OWNERS, [
        division({ nation: 0, province: 2 }),
      ])(1, 0)
    ).toBeTruthy();
  });
});
