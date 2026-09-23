import { describe, expect, it } from "vite-plus/test";
import { atWar, declared, enemiesOf, noWars, peaceFor, warCount } from "./wars";

describe(atWar, () => {
  it("should read peace when nobody has declared anything", () => {
    expect(atWar(noWars(3), 0, 1)).toBeFalsy();
  });
});

describe(declared, () => {
  it("should put both nations at war when one declares on the other", () => {
    const wars = declared(noWars(3), { one: 2, other: 0 });

    expect([atWar(wars, 0, 2), atWar(wars, 2, 0)]).toStrictEqual([true, true]);
  });

  it("should leave the nations outside the pair at peace when one is declared", () => {
    const wars = declared(noWars(3), { one: 2, other: 0 });

    expect(atWar(wars, 0, 1)).toBeFalsy();
  });
});

describe(enemiesOf, () => {
  it("should name every nation a nation is fighting when it has more than one", () => {
    const wars = declared(declared(noWars(3), { one: 0, other: 1 }), {
      one: 0,
      other: 2,
    });

    expect(enemiesOf(wars, 0)).toStrictEqual([1, 2]);
  });
});

describe(peaceFor, () => {
  it("should end every war the nation fights when it makes peace", () => {
    const wars = declared(declared(noWars(3), { one: 0, other: 1 }), {
      one: 0,
      other: 2,
    });

    expect(peaceFor(wars, 0)).toStrictEqual(noWars(3));
  });

  it("should leave the wars between other nations alone when one makes peace", () => {
    const wars = declared(declared(noWars(3), { one: 0, other: 1 }), {
      one: 1,
      other: 2,
    });

    expect(enemiesOf(peaceFor(wars, 0), 2)).toStrictEqual([1]);
  });
});

describe(warCount, () => {
  it("should count each pair of enemies once when two wars are fought", () => {
    const wars = declared(declared(noWars(3), { one: 0, other: 1 }), {
      one: 1,
      other: 2,
    });

    expect(warCount(wars)).toBe(2);
  });
});
