import { describe, expect, it } from "vite-plus/test";
import { division, nation } from "./army-fixture";
import type { Backing } from "./divisions";
import {
  attackOf,
  calledUpFor,
  canRaise,
  dailyLevy,
  defenceOf,
  fieldedBy,
  infantryEquipmentOf,
  marchDaysFor,
  menFor,
  openingDivisionCount,
  paidForDivision,
  raisedAt,
  regroupedEnough,
  rested,
  terrainDefenceOf,
  worn,
} from "./divisions";
import type { NationEconomy } from "./economy";
import { NO_ECONOMY } from "./economy";
import type { Leaning } from "./leaning";
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
      entrenchment: 0,
      kind: "infantry",
      marched: 0,
      movingTo: 7,
      nation: 2,
      organisation: 60,
      planning: 0,
      province: 7,
      strength: 20_000,
      task: "line",
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

/** A division of a nation with nothing researched but the 1936 equipment, fully supplied. */
const SUPPLIED: Backing = {
  air: 1,
  equipment: "infantry-equipment-1",
  fill: 1,
  insight: 0,
  modifiers: NO_MODIFIERS,
};

/** A fully supplied division of a nation whose modifiers `bonus` raises. */
const backedBy = (bonus: Partial<Modifiers>): Backing => ({
  ...SUPPLIED,
  modifiers: { ...NO_MODIFIERS, ...bonus },
});

describe(attackOf, () => {
  it("should be worth half when the division has lost half its men", () => {
    expect(attackOf(division({ strength: 10_000 }), SUPPLIED)).toBe(3);
  });
});

describe("attackOf after preparing", () => {
  it("should hit a third harder when the division has built the whole planning bonus", () => {
    expect(attackOf(division({ planning: 0.3 }), SUPPLIED)).toBeCloseTo(7.8);
  });

  it("should hit a tenth harder when the division is dug in five levels", () => {
    expect(attackOf(division({ entrenchment: 5 }), SUPPLIED)).toBeCloseTo(6.6);
  });
});

describe("defenceOf after preparing", () => {
  it("should hold a tenth better when the division is dug in five levels", () => {
    expect(defenceOf(division({ entrenchment: 5 }), SUPPLIED)).toBeCloseTo(11);
  });

  it("should hold no better when the division has only planned an attack", () => {
    expect(defenceOf(division({ planning: 0.3 }), SUPPLIED)).toBeCloseTo(10);
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
    expect(attackOf(division({}), { ...SUPPLIED, fill: 0 })).toBeCloseTo(1.8);
  });
});

describe("attackOf under the enemy's air superiority", () => {
  it("should keep only the share the enemy's sky leaves it when the enemy holds the air overhead", () => {
    expect(attackOf(division({}), { ...SUPPLIED, air: 0.65 })).toBeCloseTo(3.9);
  });
});

describe("attackOf with what its nation knows", () => {
  it("should hit harder by the share its insight adds when its nation knows the enemy better", () => {
    expect(attackOf(division({}), { ...SUPPLIED, insight: 0.15 })).toBeCloseTo(
      6.9
    );
  });
});

describe("attackOf with its nation's equipment", () => {
  it("should hit harder by the equipment's soft attack when its nation fields a newer generation", () => {
    expect(
      attackOf(division({}), { ...SUPPLIED, equipment: "infantry-equipment-3" })
    ).toBe(12);
  });
});

describe("defenceOf with its nation's equipment", () => {
  it("should hold harder by the equipment's defence when its nation fields a newer generation", () => {
    expect(
      defenceOf(division({}), {
        ...SUPPLIED,
        equipment: "infantry-equipment-2",
      })
    ).toBeCloseTo((10 * 28) / 22);
  });
});

describe(infantryEquipmentOf, () => {
  it("should arm the divisions with the 1918 kit when no infantry equipment is researched", () => {
    expect(infantryEquipmentOf(new Set(["fighter-1"]))).toBe(
      "basic-infantry-equipment"
    );
  });

  it("should arm the divisions with the newest generation when several are researched", () => {
    expect(
      infantryEquipmentOf(
        new Set([
          "basic-infantry-equipment",
          "infantry-equipment-1",
          "infantry-equipment-2",
        ])
      )
    ).toBe("infantry-equipment-2");
  });
});

describe("defenceOf with what its nation knows", () => {
  it("should hold harder by the share its insight adds when its nation knows the enemy better", () => {
    expect(defenceOf(division({}), { ...SUPPLIED, insight: 0.15 })).toBeCloseTo(
      11.5
    );
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
      rested(division({ organisation: 20 }), { ...SUPPLIED, fill: 0 })
        .organisation
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

describe(dailyLevy, () => {
  it("should raise one division at home and pay for it when the nation can afford one", () => {
    expect(dailyLevy(ARMED, nation(2, 7), 7)).toStrictEqual({
      divisions: [raisedAt(2, 7)],
      economy: paidForDivision(ARMED),
    });
  });

  it("should raise nothing and leave the economy alone when the nation cannot afford a division", () => {
    const short = { ...ARMED, equipment: 999 };

    expect(dailyLevy(short, nation(2, 7), 7)).toStrictEqual({
      divisions: [],
      economy: short,
    });
  });
});

describe(openingDivisionCount, () => {
  it.each([
    ["army", 5],
    ["navy", 3],
    ["industry", 3],
  ] satisfies readonly (readonly [Leaning, number])[])(
    "should put a %s nation's share of 400,000 men into %i divisions when the world opens",
    (leaning, count) => {
      expect(openingDivisionCount(400_000, leaning)).toBe(count);
    }
  );
});

describe(calledUpFor, () => {
  it("should move each division's men from the pool to the recruited without spending weapons when opening divisions are called up", () => {
    expect(calledUpFor(ARMED, 1)).toStrictEqual({
      ...ARMED,
      manpower: 0,
      recruited: 20_000,
    });
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

describe(regroupedEnough, () => {
  it.each([
    { organisation: 47, ready: false },
    { organisation: 48, ready: true },
  ])(
    "should answer $ready when a regrouping division has $organisation cohesion",
    ({ organisation, ready }) => {
      expect(regroupedEnough(division({ organisation, task: "regroup" }))).toBe(
        ready
      );
    }
  );
});
