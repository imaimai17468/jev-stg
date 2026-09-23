import { describe, expect, it } from "vite-plus/test";
import { division } from "./army-fixture";
import type { Backing } from "./divisions";
import {
  attackOf,
  canRaise,
  defenceOf,
  fieldedBy,
  marchDaysFor,
  menFor,
  paidForDivision,
  raisedAt,
  rested,
  terrainDefenceOf,
  worn,
} from "./divisions";
import type { NationEconomy } from "./economy";
import { NO_ECONOMY } from "./economy";
import type { Modifiers } from "./modifiers";
import { NO_MODIFIERS } from "./modifiers";

const ARMED: NationEconomy = {
  ...NO_ECONOMY,
  equipment: 1000,
  manpower: 20_000,
};

describe(raisedAt, () => {
  it("should stand a full division in the province when one is raised", () => {
    expect(raisedAt(2, 7)).toStrictEqual({
      arrival: "march",
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
  it("should call the men up and take the weapons out when a division is raised", () => {
    expect(paidForDivision(ARMED)).toStrictEqual({
      ...ARMED,
      equipment: 0,
      manpower: 0,
      recruited: 20_000,
    });
  });
});

/** A division of a nation with nothing researched, fully supplied. */
const SUPPLIED: Backing = { fill: 1, modifiers: NO_MODIFIERS };

/** A fully supplied division of a nation whose modifiers `bonus` raises. */
const backedBy = (bonus: Partial<Modifiers>): Backing => ({
  fill: 1,
  modifiers: { ...NO_MODIFIERS, ...bonus },
});

describe(attackOf, () => {
  it("should be worth half when the division has lost half its men", () => {
    expect(attackOf(division({ strength: 10_000 }), SUPPLIED)).toBe(3);
  });
});

describe("attackOf off a beach", () => {
  it("should be worth half when the division came ashore from a landing", () => {
    expect(attackOf(division({ arrival: "landing" }), SUPPLIED)).toBe(3);
  });
});

describe("attackOf under modifiers", () => {
  it("should hit harder when the nation's modifiers raise its attack", () => {
    expect(attackOf(division({}), backedBy({ attack: 0.5 }))).toBe(9);
  });
});

describe("attackOf out of supply", () => {
  it("should keep only the unsupplied share of its worth when the division gets no supply", () => {
    expect(
      attackOf(division({}), { fill: 0, modifiers: NO_MODIFIERS })
    ).toBeCloseTo(1.8);
  });
});

describe("defenceOf under modifiers", () => {
  it("should hold harder when the nation's modifiers raise its defence", () => {
    expect(defenceOf(division({}), backedBy({ defence: 0.5 }))).toBe(15);
  });
});

describe(defenceOf, () => {
  it("should be worth half when the division has lost half its men", () => {
    expect(defenceOf(division({ strength: 10_000 }), SUPPLIED)).toBe(5);
  });
});

describe(rested, () => {
  it("should recover a day of cohesion when the division is out of contact", () => {
    expect(rested(division({ organisation: 20 }), SUPPLIED)).toStrictEqual(
      division({ organisation: 23 })
    );
  });

  it("should recover faster and rest past the template's cohesion when the nation's doctrine raises both", () => {
    expect(
      rested(
        division({ organisation: 59 }),
        backedBy({ organisation: 0.5, recovery: 1 })
      ).organisation
    ).toBe(65);
  });

  it("should recover nothing when the division gets no supply", () => {
    expect(
      rested(division({ organisation: 20 }), {
        fill: 0,
        modifiers: NO_MODIFIERS,
      }).organisation
    ).toBe(20);
  });

  it("should stop at the template's cohesion when the division is already whole", () => {
    expect(rested(division({ organisation: 59 }), SUPPLIED).organisation).toBe(
      60
    );
  });
});

describe(worn, () => {
  it("should lose men in proportion to what its supply falls short by when the division is half supplied", () => {
    expect(worn(division({}), 0.5).strength).toBe(19_950);
  });

  it("should lose nothing when the division is fully supplied", () => {
    expect(worn(division({}), 1).strength).toBe(20_000);
  });

  it("should stop at no men when the division has almost none left", () => {
    expect(worn(division({ strength: 10 }), 0).strength).toBe(0);
  });
});

describe(fieldedBy, () => {
  it("should count each nation's divisions when several nations have some in the field", () => {
    expect(
      fieldedBy(
        [
          division({ nation: 1 }),
          division({ nation: 0 }),
          division({ nation: 1 }),
        ],
        3
      )
    ).toStrictEqual([1, 2, 0]);
  });
});

describe(menFor, () => {
  it("should call up a full division's men for each division when several are raised", () => {
    expect(menFor(3)).toBe(60_000);
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
