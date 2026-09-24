import { describe, expect, it } from "vite-plus/test";
import { AT_WAR } from "../army-fixture";
import { itemAt } from "../lookup";
import { noWars } from "../wars";
import type { Flight } from "./air-combat";
import { destroyedIn, foughtInTheAir } from "./air-combat";
import type { AirframeModel } from "./aircraft";

/** `planes` of `model` flown by `nation` with all of them in the air. */
const flight = (
  nation: number,
  model: AirframeModel,
  planes: number
): Flight => ({
  efficiency: 1,
  model,
  nation,
  planes,
});

/** Nation 0's fighters, split over two flights, against nation 1's fighters. */
const DOGFIGHT: readonly Flight[] = [
  flight(0, "fighter-1", 60),
  flight(0, "fighter-1", 40),
  flight(1, "fighter-1", 100),
];

/** A flight nobody can read from the result. */
const NO_FLIGHT: Flight = flight(-1, "fighter-1", 0);

/** The planes left in the flight at `index` of what `foughtInTheAir` returned. */
const planesLeft = (flights: readonly Flight[], index: number): number =>
  itemAt(flights, index, NO_FLIGHT).planes;

describe(destroyedIn, () => {
  it("should bring down fire over air defence when the two are the same plane", () => {
    expect(destroyedIn(100, "fighter-1", "fighter-1")).toBeCloseTo(
      ((360 + 45) * 0.01) / 10
    );
  });

  it("should lose some fire to a more agile target when the attacker is the clumsier plane", () => {
    expect(destroyedIn(100, "close-air-support-1", "fighter-1")).toBeCloseTo(
      ((120 - 120 * 0.45 * (50 / 35 - 1) + 11.7) * 0.01) / 10
    );
  });

  it("should gain fire for the difference in speed when the attacker is the faster plane", () => {
    expect(destroyedIn(100, "fighter-1", "naval-bomber-1")).toBeCloseTo(
      ((360 + 360 * 0.65 * (500 / 230 - 1) + 45) * 0.01) / 12
    );
  });

  it("should bring down a thousandth of a plane when the fire is too weak to do more", () => {
    expect(destroyedIn(0.01, "fighter-1", "fighter-1")).toBe(0.001);
  });
});

describe(foughtInTheAir, () => {
  it("should leave every flight whole when the nations are at peace", () => {
    expect(foughtInTheAir(DOGFIGHT, noWars(2))).toStrictEqual(DOGFIGHT);
  });

  it("should take losses off both sides when the nations are at war", () => {
    expect(
      foughtInTheAir(DOGFIGHT, AT_WAR).map(
        (fought, index) => fought.planes < planesLeft(DOGFIGHT, index)
      )
    ).toStrictEqual([true, true, true]);
  });

  it("should take a group's losses off its flights by their numbers when one nation flies two flights of a kind", () => {
    const fought = foughtInTheAir(DOGFIGHT, AT_WAR);

    expect(planesLeft(fought, 0) / planesLeft(fought, 1)).toBeCloseTo(1.5);
  });

  it("should lose the same share each battle when two equal wings of fighters meet", () => {
    expect(
      planesLeft(
        foughtInTheAir(
          [flight(0, "fighter-1", 100), flight(1, "fighter-1", 100)],
          AT_WAR
        ),
        0
      )
    ).toBeCloseTo(100 * (1 - 0.405 / 100) ** 3);
  });

  it("should leave the enemy untouched when a group sends none of its planes", () => {
    expect(
      planesLeft(
        foughtInTheAir(
          [
            { ...flight(0, "fighter-1", 100), efficiency: 0 },
            flight(1, "fighter-1", 100),
          ],
          AT_WAR
        ),
        1
      )
    ).toBe(100);
  });

  it("should send no more than three times the enemy when the attackers far outnumber it", () => {
    expect(
      planesLeft(
        foughtInTheAir(
          [flight(0, "fighter-1", 400), flight(1, "close-air-support-1", 100)],
          AT_WAR
        ),
        1
      )
    ).toBeCloseTo(
      planesLeft(
        foughtInTheAir(
          [flight(0, "fighter-1", 350), flight(1, "close-air-support-1", 100)],
          AT_WAR
        ),
        1
      )
    );
  });

  it("should leave a flight with no planes at none when the enemy fires on it", () => {
    expect(
      planesLeft(
        foughtInTheAir(
          [flight(0, "fighter-1", 100), flight(1, "close-air-support-1", 0)],
          AT_WAR
        ),
        1
      )
    ).toBe(0);
  });
});
