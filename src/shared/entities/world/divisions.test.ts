import { describe, expect, it } from "vite-plus/test";
import { division, nation } from "./army-fixture";
import type { Backing, DivisionKind } from "./divisions";
import {
  attackOf,
  calledUpFor,
  canRaise,
  dailyLevyBeside,
  dropWornOff,
  defenceOf,
  fieldedBy,
  infantryEquipmentOf,
  kindsUnlockedBy,
  marchDaysFor,
  menFor,
  nextKindFor,
  openingKindsOf,
  paradropped,
  paidForDivision,
  raisedAt,
  regroupedEnough,
  rested,
  supplyUseOf,
  terrainDefenceOf,
  unlockedKindsOf,
  worn,
} from "./divisions";
import type { NationEconomy } from "./economy";
import { NO_ECONOMY } from "./economy";
import type { Leaning } from "./leaning";
import type { Modifiers } from "./modifiers";
import { NO_MODIFIERS } from "./modifiers";
import type { TechId } from "./techs";
import { TECH_IDS } from "./techs";
import type { Terrain } from "./terrain";

const ARMED: NationEconomy = {
  ...NO_ECONOMY,
  equipment: 1000,
  manpower: 20_000,
};

describe(raisedAt, () => {
  it("should stand a full division in the province when one is raised", () => {
    expect(raisedAt(2, 7, "infantry")).toStrictEqual({
      arrival: "march",
      dropped: 0,
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
    expect(canRaise(ARMED, "infantry")).toBeTruthy();
  });

  it("should refuse a division when the weapons are short", () => {
    expect(canRaise({ ...ARMED, equipment: 999 }, "infantry")).toBeFalsy();
  });

  it("should refuse a division when the men are short", () => {
    expect(canRaise({ ...ARMED, manpower: 19_999 }, "infantry")).toBeFalsy();
  });
});

describe(paidForDivision, () => {
  it("should call the men up and take the weapons out when a division is raised", () => {
    expect(paidForDivision(ARMED, "infantry")).toStrictEqual({
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
    expect(attackOf(division({ strength: 10_000 }), SUPPLIED, "plains")).toBe(
      3
    );
  });
});

describe("attackOf after preparing", () => {
  it("should hit a third harder when the division has built the whole planning bonus", () => {
    expect(
      attackOf(division({ planning: 0.3 }), SUPPLIED, "plains")
    ).toBeCloseTo(7.8);
  });

  it("should hit a tenth harder when the division is dug in five levels", () => {
    expect(
      attackOf(division({ entrenchment: 5 }), SUPPLIED, "plains")
    ).toBeCloseTo(6.6);
  });
});

describe("defenceOf after preparing", () => {
  it("should hold a tenth better when the division is dug in five levels", () => {
    expect(
      defenceOf(division({ entrenchment: 5 }), SUPPLIED, "plains")
    ).toBeCloseTo(11);
  });

  it("should hold no better when the division has only planned an attack", () => {
    expect(
      defenceOf(division({ planning: 0.3 }), SUPPLIED, "plains")
    ).toBeCloseTo(10);
  });
});

describe("attackOf off a beach", () => {
  it("should be worth half when the division came ashore from a landing", () => {
    expect(attackOf(division({ arrival: "landing" }), SUPPLIED, "plains")).toBe(
      3
    );
  });
});

describe("attackOf under modifiers", () => {
  it("should hit harder when the nation's modifiers raise its attack", () => {
    expect(attackOf(division({}), backedBy({ attack: 0.5 }), "plains")).toBe(9);
  });
});

describe("attackOf out of supply", () => {
  it("should keep only the unsupplied share of its worth when the division gets no supply", () => {
    expect(
      attackOf(division({}), { ...SUPPLIED, fill: 0 }, "plains")
    ).toBeCloseTo(1.8);
  });
});

describe("attackOf under the enemy's air superiority", () => {
  it("should keep only the share the enemy's sky leaves it when the enemy holds the air overhead", () => {
    expect(
      attackOf(division({}), { ...SUPPLIED, air: 0.65 }, "plains")
    ).toBeCloseTo(3.9);
  });
});

describe("attackOf with what its nation knows", () => {
  it("should hit harder by the share its insight adds when its nation knows the enemy better", () => {
    expect(
      attackOf(division({}), { ...SUPPLIED, insight: 0.15 }, "plains")
    ).toBeCloseTo(6.9);
  });
});

describe("attackOf with its nation's equipment", () => {
  it("should hit harder by the equipment's soft attack when its nation fields a newer generation", () => {
    expect(
      attackOf(
        division({}),
        { ...SUPPLIED, equipment: "infantry-equipment-3" },
        "plains"
      )
    ).toBe(12);
  });
});

describe("defenceOf with its nation's equipment", () => {
  it("should hold harder by the equipment's defence when its nation fields a newer generation", () => {
    expect(
      defenceOf(
        division({}),
        {
          ...SUPPLIED,
          equipment: "infantry-equipment-2",
        },
        "plains"
      )
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
    expect(
      defenceOf(division({}), { ...SUPPLIED, insight: 0.15 }, "plains")
    ).toBeCloseTo(11.5);
  });
});

describe("defenceOf under modifiers", () => {
  it("should hold harder when the nation's modifiers raise its defence", () => {
    expect(defenceOf(division({}), backedBy({ defence: 0.5 }), "plains")).toBe(
      15
    );
  });
});

describe(defenceOf, () => {
  it("should be worth half when the division has lost half its men", () => {
    expect(defenceOf(division({ strength: 10_000 }), SUPPLIED, "plains")).toBe(
      5
    );
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

/** Every kind of division, as a nation that has researched them all may raise. */
const EVERY_KIND: readonly DivisionKind[] = unlockedKindsOf(new Set(TECH_IDS));

describe(dailyLevyBeside, () => {
  it("should raise one division of the kind its mix is shortest of at home and pay for it when the nation can afford one", () => {
    expect(
      dailyLevyBeside([])(ARMED, nation(2, 7), 7, EVERY_KIND)
    ).toStrictEqual({
      divisions: [raisedAt(2, 7, "infantry")],
      economy: paidForDivision(ARMED, "infantry"),
    });
  });

  it("should raise nothing and leave the economy alone when the nation cannot afford a division", () => {
    const short = { ...ARMED, equipment: 999 };

    expect(
      dailyLevyBeside([])(short, nation(2, 7), 7, EVERY_KIND)
    ).toStrictEqual({
      divisions: [],
      economy: short,
    });
  });

  it("should save its weapons rather than raise infantry when the kind its mix is short of costs more than it has", () => {
    const infantry = Array.from({ length: 6 }, () => division({ nation: 2 }));

    expect(
      dailyLevyBeside(infantry)(ARMED, nation(2, 7), 7, EVERY_KIND)
    ).toStrictEqual({
      divisions: [],
      economy: ARMED,
    });
  });

  it("should count only its own divisions when another nation's stand in the field", () => {
    const foreign = Array.from({ length: 6 }, () => division({ nation: 1 }));

    expect(
      dailyLevyBeside(foreign)(ARMED, nation(2, 7), 7, EVERY_KIND).divisions
    ).toStrictEqual([raisedAt(2, 7, "infantry")]);
  });

  it("should raise the kind its government chose when its research has unlocked that kind", () => {
    const chosen: NationEconomy = {
      ...ARMED,
      equipment: 2000,
      raising: "marines",
    };

    expect(
      dailyLevyBeside([])(chosen, nation(2, 7), 7, EVERY_KIND).divisions
    ).toStrictEqual([raisedAt(2, 7, "marines")]);
  });

  it("should raise the kind its mix is shortest of when its free men fall short of a division of the kind its government chose", () => {
    const chosen: NationEconomy = {
      ...ARMED,
      equipment: 10_000,
      manpower: 21_000,
      raising: "motorized",
    };

    expect(
      dailyLevyBeside([])(chosen, nation(2, 7), 7, EVERY_KIND).divisions
    ).toStrictEqual([raisedAt(2, 7, "infantry")]);
  });

  it("should raise the kind its mix is shortest of when the kind its government chose is not unlocked", () => {
    const chosen: NationEconomy = { ...ARMED, raising: "heavy-armour" };

    expect(
      dailyLevyBeside([])(chosen, nation(2, 7), 7, ["infantry", "cavalry"])
        .divisions
    ).toStrictEqual([raisedAt(2, 7, "infantry")]);
  });
});

describe(nextKindFor, () => {
  it.each([
    { fielded: [], kind: "infantry", leaning: "army", unlocked: EVERY_KIND },
    {
      fielded: [["infantry", 6]],
      kind: "cavalry",
      leaning: "army",
      unlocked: EVERY_KIND,
    },
    {
      fielded: [["infantry", 6]],
      kind: "marines",
      leaning: "navy",
      unlocked: EVERY_KIND,
    },
    {
      fielded: [["infantry", 6]],
      kind: "motorized",
      leaning: "industry",
      unlocked: EVERY_KIND,
    },
    {
      fielded: [["infantry", 6]],
      kind: "light-armour",
      leaning: "navy",
      unlocked: ["infantry", "cavalry", "light-armour"],
    },
    {
      fielded: [["infantry", 6]],
      kind: "infantry",
      leaning: "army",
      unlocked: [],
    },
  ] satisfies readonly {
    fielded: readonly (readonly [DivisionKind, number])[];
    kind: DivisionKind;
    leaning: Leaning;
    unlocked: readonly DivisionKind[];
  }[])(
    "should raise $kind next when a $leaning nation that may raise $unlocked fields $fielded",
    ({ fielded, kind, leaning, unlocked }) => {
      expect(nextKindFor(leaning, new Map(fielded), unlocked)).toBe(kind);
    }
  );
});

describe(unlockedKindsOf, () => {
  it.each([
    { kinds: ["infantry", "cavalry"], researched: [] },
    {
      kinds: ["infantry", "cavalry", "motorized", "marines"],
      researched: ["early-truck", "truck", "marines-1"],
    },
  ] satisfies readonly {
    kinds: readonly DivisionKind[];
    researched: readonly TechId[];
  }[])(
    "should let the nation raise $kinds when it has researched $researched",
    ({ kinds, researched }) => {
      expect(unlockedKindsOf(new Set(researched))).toStrictEqual(kinds);
    }
  );
});

describe(kindsUnlockedBy, () => {
  it.each([
    { kinds: ["medium-armour"], tech: "medium-tank-1" },
    { kinds: [], tech: "light-tank-1" },
  ] satisfies readonly { kinds: readonly DivisionKind[]; tech: TechId }[])(
    "should name $kinds as unlocked when $tech is researched",
    ({ kinds, tech }) => {
      expect(kindsUnlockedBy(tech)).toStrictEqual(kinds);
    }
  );
});

describe(openingKindsOf, () => {
  it("should raise its mix in turn until the next division needs more men than its share holds when the world opens", () => {
    expect(openingKindsOf(400_000, "army", EVERY_KIND)).toStrictEqual([
      "infantry",
      "cavalry",
      "infantry",
      "motorized",
    ]);
  });

  it("should raise only the kinds its research has unlocked when the world opens", () => {
    expect(
      openingKindsOf(400_000, "army", ["infantry", "cavalry"])
    ).toStrictEqual([
      "infantry",
      "infantry",
      "infantry",
      "cavalry",
      "infantry",
    ]);
  });
});

describe(calledUpFor, () => {
  it("should call up the men of the kinds raised when the opening divisions are not infantry", () => {
    expect(
      calledUpFor({ ...ARMED, manpower: 30_000 }, ["motorized"])
    ).toStrictEqual({
      ...ARMED,
      manpower: 6000,
      recruited: 24_000,
    });
  });

  it("should move each division's men from the pool to the recruited without spending weapons when opening divisions are called up", () => {
    expect(calledUpFor(ARMED, ["infantry"])).toStrictEqual({
      ...ARMED,
      manpower: 0,
      recruited: 20_000,
    });
  });
});

describe(marchDaysFor, () => {
  it("should take longer when the ground is mountains rather than plains", () => {
    expect(marchDaysFor("infantry", "mountains")).toBeGreaterThan(
      marchDaysFor("infantry", "plains")
    );
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

describe("raisedAt for an armoured division", () => {
  it("should stand its tanks and motorized infantry at their averaged cohesion when a light armour division is raised", () => {
    expect(raisedAt(2, 7, "light-armour")).toStrictEqual({
      ...raisedAt(2, 7, "infantry"),
      kind: "light-armour",
      organisation: 35,
      strength: 17_000,
    });
  });
});

describe("canRaise for an armoured division", () => {
  it("should refuse a light armour division when the weapons are enough only for infantry", () => {
    expect(canRaise(ARMED, "light-armour")).toBeFalsy();
  });
});

describe("marchDaysFor by kind", () => {
  it.each([
    { days: 2 / 3, kind: "motorized", terrain: "plains" },
    { days: 5 / 1.2, kind: "mountaineers", terrain: "mountains" },
    { days: 2, kind: "light-armour", terrain: "forest" },
    { days: 5 / ((4 * 1.6 * 0.95) / 4), kind: "cavalry", terrain: "mountains" },
  ] satisfies readonly {
    days: number;
    kind: DivisionKind;
    terrain: Terrain;
  }[])(
    "should take $days days when a $kind division walks into $terrain",
    ({ days, kind, terrain }) => {
      expect(marchDaysFor(kind, terrain)).toBeCloseTo(days);
    }
  );
});

describe("attackOf by kind and ground", () => {
  it.each([
    { attack: 6 * 1.35, kind: "mountaineers", terrain: "mountains" },
    { attack: 9.5, kind: "light-armour", terrain: "plains" },
    {
      attack: (6 * (5 * 13 * 0.8 + 5 * 6 * 0.9)) / 60,
      kind: "light-armour",
      terrain: "forest",
    },
    { attack: 6.6, kind: "mechanized", terrain: "plains" },
  ] satisfies readonly {
    attack: number;
    kind: DivisionKind;
    terrain: Terrain;
  }[])(
    "should be worth $attack when a $kind division attacks into $terrain",
    ({ attack, kind, terrain }) => {
      expect(
        attackOf(
          division({ kind, strength: raisedAt(0, 0, kind).strength }),
          SUPPLIED,
          terrain
        )
      ).toBeCloseTo(attack);
    }
  );
});

describe("attackOf off a beach by kind", () => {
  it.each([
    { attack: 6, kind: "marines" },
    { attack: 0.9, kind: "heavy-armour" },
  ] satisfies readonly { attack: number; kind: DivisionKind }[])(
    "should be worth $attack when a $kind division attacks from a landing",
    ({ attack, kind }) => {
      expect(
        attackOf(
          division({
            arrival: "landing",
            kind,
            strength: raisedAt(0, 0, kind).strength,
          }),
          SUPPLIED,
          "plains"
        )
      ).toBeCloseTo(attack);
    }
  );
});

describe("defenceOf by kind and ground", () => {
  it.each([
    { defence: 130 / 22, kind: "light-armour", terrain: "plains" },
    { defence: 480 / 22, kind: "mechanized", terrain: "plains" },
    { defence: 11, kind: "mountaineers", terrain: "mountains" },
  ] satisfies readonly {
    defence: number;
    kind: DivisionKind;
    terrain: Terrain;
  }[])(
    "should be worth $defence when a $kind division holds $terrain",
    ({ defence, kind, terrain }) => {
      expect(
        defenceOf(
          division({ kind, strength: raisedAt(0, 0, kind).strength }),
          SUPPLIED,
          terrain
        )
      ).toBeCloseTo(defence);
    }
  );
});

describe(supplyUseOf, () => {
  it.each([
    { kind: "infantry", use: 1 },
    { kind: "light-armour", use: 2.375 },
  ] satisfies readonly { kind: DivisionKind; use: number }[])(
    "should use $use infantry divisions' supply when the division is $kind",
    ({ kind, use }) => {
      expect(supplyUseOf(kind)).toBeCloseTo(use);
    }
  );
});

describe("rested by kind", () => {
  it("should recover a third faster when the division's battalions carry special forces' morale", () => {
    expect(
      rested(division({ kind: "marines", organisation: 20 }), SUPPLIED)
        .organisation
    ).toBeCloseTo(24);
  });
});

describe("worn by kind", () => {
  it("should lose men against its own kind's full strength when an armoured division is half supplied", () => {
    expect(
      worn(division({ kind: "light-armour", strength: 17_000 }), 0.5).strength
    ).toBeCloseTo(16_957.5);
  });
});

describe(paradropped, () => {
  it("should stand the division on the target with two fifths of its kind's cohesion, five days of penalties and no trenches or plans when a full division that dug in at home drops", () => {
    expect(
      paradropped(
        division({
          entrenchment: 5,
          kind: "paratroopers",
          organisation: 70,
          planning: 0.2,
          province: 0,
        }),
        4
      )
    ).toStrictEqual(
      division({
        dropped: 5,
        kind: "paratroopers",
        movingTo: 4,
        organisation: 28,
        province: 4,
      })
    );
  });

  it("should keep its cohesion when the division drops with less than a paradrop leaves", () => {
    expect(
      paradropped(division({ kind: "paratroopers", organisation: 20 }), 4)
        .organisation
    ).toBe(20);
  });
});

describe(dropWornOff, () => {
  it.each([
    { after: 4, before: 5 },
    { after: 0, before: 0 },
  ])(
    "should leave $after days of penalties when the division had $before",
    ({ after, before }) => {
      expect(dropWornOff(division({ dropped: before })).dropped).toBe(after);
    }
  );
});

describe("attackOf after a paradrop", () => {
  it.each([
    { attack: 6 * 0.7, dropped: 5 },
    { attack: 6 * 0.7, dropped: 4 },
    { attack: 6, dropped: 3 },
  ])(
    "should be worth $attack when the division has $dropped days of its drop's penalties left",
    ({ attack, dropped }) => {
      expect(attackOf(division({ dropped }), SUPPLIED, "plains")).toBeCloseTo(
        attack
      );
    }
  );
});

describe("rested after a paradrop", () => {
  it("should recover a fifth of a day's cohesion when the division is still under its drop's penalties", () => {
    expect(
      rested(division({ dropped: 1, organisation: 20 }), SUPPLIED).organisation
    ).toBeCloseTo(20.6);
  });
});
