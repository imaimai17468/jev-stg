import { describe, expect, it } from "vite-plus/test";
import { division } from "./army-fixture";
import {
  attackOf,
  canRaise,
  defenceOf,
  marchDaysFor,
  paidForDivision,
  raisedAt,
  rested,
  terrainDefenceOf,
} from "./divisions";
import type { NationEconomy } from "./economy";
import { NO_ECONOMY } from "./economy";

const ARMED: NationEconomy = {
  ...NO_ECONOMY,
  equipment: 1000,
  manpower: 20_000,
};

describe(raisedAt, () => {
  it("should stand a full division in the province when one is raised", () => {
    expect(raisedAt(2, 7)).toStrictEqual({
      kind: "infantry",
      marched: 0,
      movingTo: 7,
      nation: 2,
      organisation: 60,
      province: 7,
      strength: 20_000,
    });
  });
});

describe(canRaise, () => {
  it("should allow a division when the nation has exactly what one costs", () => {
    expect(canRaise(ARMED)).toBeTruthy();
  });

  it("should refuse a division when the weapons are short", () => {
    expect(canRaise({ ...ARMED, equipment: 999 })).toBeFalsy();
  });

  it("should refuse a division when the men are short", () => {
    expect(canRaise({ ...ARMED, manpower: 19_999 })).toBeFalsy();
  });
});

describe(paidForDivision, () => {
  it("should take the men and the weapons out when a division is raised", () => {
    expect(paidForDivision(ARMED)).toStrictEqual({
      ...ARMED,
      equipment: 0,
      manpower: 0,
    });
  });
});

describe(attackOf, () => {
  it("should be worth half when the division has lost half its men", () => {
    expect(attackOf(division({ strength: 10_000 }))).toBe(3);
  });
});

describe(defenceOf, () => {
  it("should be worth half when the division has lost half its men", () => {
    expect(defenceOf(division({ strength: 10_000 }))).toBe(5);
  });
});

describe(rested, () => {
  it("should recover a day of cohesion when the division is out of contact", () => {
    expect(rested(division({ organisation: 20 }))).toStrictEqual(
      division({ organisation: 23 })
    );
  });

  it("should stop at the template's cohesion when the division is already whole", () => {
    expect(rested(division({ organisation: 59 })).organisation).toBe(60);
  });
});

describe(marchDaysFor, () => {
  it("should take longer when the ground is mountains rather than plains", () => {
    expect(marchDaysFor("mountains")).toBeGreaterThan(marchDaysFor("plains"));
  });
});

describe(terrainDefenceOf, () => {
  it("should be worth more when the ground is mountains rather than plains", () => {
    expect(terrainDefenceOf("mountains")).toBeGreaterThan(
      terrainDefenceOf("plains")
    );
  });
});
