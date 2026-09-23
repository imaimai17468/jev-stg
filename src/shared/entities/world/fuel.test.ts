import { describe, expect, it } from "vite-plus/test";
import {
  enginesKeptWith,
  FUEL_CAPACITY,
  fuelShareOf,
  gunsKeptWith,
  makesWayOn,
  oilWanted,
  planesKeptWith,
  refined,
} from "./fuel";

describe(refined, () => {
  it("should add 48 fuel for each unit of oil when the stockpile has room", () => {
    expect(refined(100, 2)).toBe(196);
  });

  it("should stop at the capacity when the oil would overfill the stockpile", () => {
    expect(refined(FUEL_CAPACITY - 10, 1)).toBe(FUEL_CAPACITY);
  });

  it("should refine nothing when the oil falls below zero", () => {
    expect(refined(100, -3)).toBe(100);
  });
});

describe(oilWanted, () => {
  it("should ask for the oil that refines into yesterday's burn when fuel was burned", () => {
    expect(oilWanted(96)).toBe(2);
  });
});

describe(fuelShareOf, () => {
  it("should cover the share the stockpile holds when it falls short of the demand", () => {
    expect(fuelShareOf(25, 100)).toBeCloseTo(0.25);
  });

  it("should cover all of it when the stockpile holds more than the demand", () => {
    expect(fuelShareOf(300, 100)).toBe(1);
  });

  it("should cover all of it when nothing is wanted and nothing is held", () => {
    expect(fuelShareOf(0, 0)).toBe(1);
  });
});

describe(planesKeptWith, () => {
  it("should keep a quarter when the planes have no fuel", () => {
    expect(planesKeptWith(0)).toBe(0.25);
  });
});

describe(gunsKeptWith, () => {
  it("should keep three quarters when the guns have half their fuel", () => {
    expect(gunsKeptWith(0.5)).toBe(0.75);
  });
});

describe(enginesKeptWith, () => {
  it("should keep everything when the engines have all their fuel", () => {
    expect(enginesKeptWith(1)).toBe(1);
  });
});

describe(makesWayOn, () => {
  it.each<{ day: number; moves: boolean }>([
    { day: 1, moves: false },
    { day: 2, moves: true },
    { day: 3, moves: false },
    { day: 4, moves: true },
  ])(
    "should make way $moves on day $day when the engines keep half their speed",
    ({ day, moves }) => {
      expect(makesWayOn(day, 0.5)).toBe(moves);
    }
  );
});
