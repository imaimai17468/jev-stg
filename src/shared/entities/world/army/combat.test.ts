import { describe, expect, it } from "vite-plus/test";
import { OPENING_ARMOURY } from "../armoury";
import {
  AT_WAR,
  division,
  FULL_SUPPLY,
  LINE_GRAPH,
  LINE_OWNERS,
  LINE_WORLD,
} from "../army-fixture";
import type { Insight } from "../intelligence/insight";
import { NO_INSIGHT } from "../intelligence/insight";
import { itemAt, replacedAt } from "../lookup";
import { NO_MODIFIERS } from "../modifiers";
import type { LandProvince } from "../provinces";
import { landProvinces } from "../provinces";
import { UNASSIGNED } from "../spread";
import type { Wars } from "../wars";
import { declared, noWars } from "../wars";
import type { AirCover } from "./air-cover";
import { NO_AIR_COVER } from "./air-cover";
import type { Battle, Theatre } from "./combat";
import { foughtOneDay, withdrawn } from "./combat";
import type { Division } from "./divisions";

const FALLBACK: LandProvince = {
  cells: 0,
  id: -1,
  kind: "land",
  neighbours: [],
  terrain: "plains",
  x: 0,
  y: 0,
};

/** The line under `wars`, with neither nation's divisions improved by anything. */
const theatreOf = (wars: Wars): Theatre => ({
  air: NO_AIR_COVER,
  armouries: [OPENING_ARMOURY, OPENING_ARMOURY],
  insight: NO_INSIGHT,
  modifiers: [NO_MODIFIERS, NO_MODIFIERS],
  owners: LINE_OWNERS,
  supply: FULL_SUPPLY,
  wars,
});

const provinceAt = (id: number): LandProvince =>
  itemAt(landProvinces(LINE_WORLD.provinces), id, FALLBACK);

/** Province 2 is nation 1's, and nation 0 can reach it from province 1. */
const CONTESTED = provinceAt(2);

const stackOf = (count: number, nation: number): readonly Division[] =>
  Array.from({ length: count }, () => division({ nation, province: 2 }));

/** The first nation whose divisions break when a battle is fought to the end. */
const firstToBreak = (
  province: LandProvince,
  present: readonly Division[]
): number => {
  let battle: Battle = foughtOneDay(theatreOf(AT_WAR), province, present);
  while (battle.broken.length === 0) {
    battle = foughtOneDay(theatreOf(AT_WAR), province, battle.standing);
  }
  return itemAt(battle.broken, 0, division({ nation: -1 })).nation;
};

describe(foughtOneDay, () => {
  it("should rest the garrison when no enemy stands in the province", () => {
    const garrison = division({ nation: 1, organisation: 50, province: 2 });

    expect(
      foughtOneDay(theatreOf(AT_WAR), CONTESTED, [garrison])
    ).toStrictEqual({
      broken: [],
      captured: -1,
      fought: false,
      standing: [{ ...garrison, organisation: 53 }],
    });
  });

  it("should hand the province to the attacker when nobody is left defending it", () => {
    const attacker = division({ nation: 0, province: 2 });

    expect(
      foughtOneDay(theatreOf(AT_WAR), CONTESTED, [attacker])
    ).toStrictEqual({
      broken: [],
      captured: 0,
      fought: true,
      standing: [attacker],
    });
  });

  it("should hand the province to the heavier attacker when two of them are in it", () => {
    const wars = declared(declared(noWars(3), { one: 0, other: 1 }), {
      one: 1,
      other: 2,
    });
    const present = [...stackOf(2, 0), ...stackOf(1, 2)];

    expect(foughtOneDay(theatreOf(wars), CONTESTED, present).captured).toBe(0);
  });

  it("should cost the attacker more than the defender when the two are even", () => {
    const attacker = division({ nation: 0, province: 2 });
    const defender = division({ nation: 1, province: 2 });

    expect(
      foughtOneDay(theatreOf(AT_WAR), CONTESTED, [attacker, defender])
    ).toStrictEqual({
      broken: [],
      captured: -1,
      fought: true,
      standing: [
        { ...attacker, organisation: 55, strength: 19_700 },
        { ...defender, organisation: 57, strength: 19_820 },
      ],
    });
  });

  it("should take five cohesion off each attacker and three off each defender when ten meet ten on plains", () => {
    const battle = foughtOneDay(theatreOf(AT_WAR), CONTESTED, [
      ...stackOf(10, 0),
      ...stackOf(10, 1),
    ]);

    expect({
      attacker: 60 - itemAt(battle.standing, 0, division({})).organisation,
      defender: 60 - itemAt(battle.standing, 10, division({})).organisation,
    }).toStrictEqual({ attacker: 5, defender: 3 });
  });

  it("should leave the attackers past the combat width in reserve when more attack than the plains hold", () => {
    const battle = foughtOneDay(theatreOf(AT_WAR), CONTESTED, [
      ...stackOf(10, 0),
      ...stackOf(1, 1),
    ]);

    expect(
      battle.standing.filter(
        (fighter) => fighter.nation === 0 && fighter.organisation === 60
      )
    ).toHaveLength(2);
  });

  it("should widen the battle when the province is attacked from both sides", () => {
    const surrounded: Theatre = {
      ...theatreOf(AT_WAR),
      owners: Int32Array.from([0, 0, 1, 0, UNASSIGNED]),
    };

    const battle = foughtOneDay(surrounded, CONTESTED, [
      ...stackOf(14, 0),
      ...stackOf(1, 1),
    ]);

    expect(
      battle.standing.filter(
        (fighter) => fighter.nation === 0 && fighter.organisation === 60
      )
    ).toHaveLength(2);
  });

  it("should break the defenders first when three attack two on plains", () => {
    expect(firstToBreak(CONTESTED, [...stackOf(3, 0), ...stackOf(2, 1)])).toBe(
      1
    );
  });

  it("should break the attackers first when three attack two in the mountains", () => {
    const mountains: LandProvince = { ...CONTESTED, terrain: "mountains" };

    expect(firstToBreak(mountains, [...stackOf(3, 0), ...stackOf(2, 1)])).toBe(
      0
    );
  });

  it("should hand back a division that breaks under fire when its cohesion runs out", () => {
    const attacker = division({ nation: 0, organisation: 1, province: 2 });
    const defender = division({ nation: 1, province: 2 });

    expect(
      foughtOneDay(theatreOf(AT_WAR), CONTESTED, [attacker, defender]).broken
    ).toStrictEqual([{ ...attacker, organisation: -4, strength: 19_700 }]);
  });

  it("should leave an already broken defender out of the fight when fresh ones hold the province", () => {
    const fresh = division({ nation: 1, province: 2 });
    const spent = division({ nation: 1, organisation: 0, province: 2 });
    const attacker = division({ nation: 0, province: 2 });

    expect(
      foughtOneDay(theatreOf(AT_WAR), CONTESTED, [fresh, spent, attacker])
    ).toStrictEqual({
      broken: [spent],
      captured: -1,
      fought: true,
      standing: [
        { ...fresh, organisation: 57, strength: 19_820 },
        { ...attacker, organisation: 55, strength: 19_700 },
      ],
    });
  });

  it("should give the province up when only broken divisions are left defending it", () => {
    const spent = division({ nation: 1, organisation: 0, province: 2 });
    const attacker = division({ nation: 0, province: 2 });

    expect(
      foughtOneDay(theatreOf(AT_WAR), CONTESTED, [spent, attacker])
    ).toStrictEqual({
      broken: [spent],
      captured: 0,
      fought: true,
      standing: [attacker],
    });
  });

  it("should leave a nation at peace with the holder untouched when it stands in a battle", () => {
    const bystander = division({ nation: 2, province: 2 });
    const wars = declared(noWars(3), { one: 0, other: 1 });

    expect(
      foughtOneDay(theatreOf(wars), CONTESTED, [
        division({ nation: 0, province: 2 }),
        division({ nation: 1, province: 2 }),
        bystander,
      ]).standing.at(2)
    ).toStrictEqual(bystander);
  });
});

/** Nothing over province 2 but one reading of `nation`'s close air support there. */
const overTheBattle = (
  nation: number,
  value: number
): readonly Float32Array[] =>
  replacedAt(
    [new Float32Array(4), new Float32Array(4)],
    nation,
    Float32Array.from([0, 0, value, 0])
  );

/**
 * Nothing over the line but `planes` close air support planes of `nation`
 * over province 2, carrying `groundAttack` each, the 1936 design's unless
 * given.
 */
const supportedBy = (
  nation: number,
  planes: number,
  groundAttack = 8
): AirCover => ({
  enemy: [],
  support: overTheBattle(nation, planes),
  supportAttack: overTheBattle(nation, planes * groundAttack),
});

/** The organisation each of one attacker and one defender holds after a day on province 2 under `air`. */
const organisationUnder = (air: AirCover, insight: Insight = NO_INSIGHT) => {
  const battle = foughtOneDay(
    { ...theatreOf(AT_WAR), air, insight },
    CONTESTED,
    [division({ nation: 0, province: 2 }), division({ nation: 1, province: 2 })]
  );
  return battle.standing.map((fighter) => fighter.organisation);
};

describe("foughtOneDay with the nations' equipment", () => {
  it("should take more off the defender's organisation when the attacker's nation fields newer infantry equipment", () => {
    const battle = foughtOneDay(
      {
        ...theatreOf(AT_WAR),
        armouries: [
          { ...OPENING_ARMOURY, infantry: "infantry-equipment-3" },
          OPENING_ARMOURY,
        ],
      },
      CONTESTED,
      [
        division({ nation: 0, province: 2 }),
        division({ nation: 1, province: 2 }),
      ]
    );

    expect(
      battle.standing.map((fighter) => fighter.organisation)
    ).toStrictEqual([55, 54]);
  });
});

describe("foughtOneDay under the planes", () => {
  it("should take the attacker's close air support off the defender's organisation when ten planes fly over the battle", () => {
    const [, defender] = organisationUnder(supportedBy(0, 10));

    expect(defender).toBeCloseTo(48.6, 10);
  });

  it("should take no more than thirty planes a division of the enemy line into the battle when a hundred fly over it", () => {
    const [, defender] = organisationUnder(supportedBy(0, 100));

    expect(defender).toBeCloseTo(31.8, 10);
  });

  it("should take the holder's close air support off the attacker's organisation when its planes fly over the battle", () => {
    const [attacker] = organisationUnder(supportedBy(1, 10));

    expect(attacker).toBeCloseTo(46.6, 10);
  });

  it("should strike harder by the ground attack the planes carry when they are a newer design", () => {
    const [, defender] = organisationUnder(supportedBy(0, 10, 13));

    expect(defender).toBeCloseTo(60 - 3 - 10 * 13 * 0.035 * 3, 10);
  });

  it("should take the joining planes' share of the ground attack all of them carry when more fly than the battle takes", () => {
    const [, defender] = organisationUnder(supportedBy(0, 100, 10));

    expect(defender).toBeCloseTo(60 - 3 - 30 * 10 * 0.035 * 3, 10);
  });

  it("should take nothing off the defender's organisation from the air when no planes fly over the battle", () => {
    const [, defender] = organisationUnder(supportedBy(0, 0));

    expect(defender).toBe(57);
  });

  it("should cut the defender's worth by 35% when its enemies hold the whole sky over it", () => {
    const [attacker] = organisationUnder({
      enemy: [new Float32Array(4), Float32Array.from([0, 0, 1, 0])],
      support: [],
      supportAttack: [],
    });

    expect(attacker).toBeCloseTo(60 - 5 * 0.65, 10);
  });
});

/** Three nations where only `nation` reads `enemy`'s revealed cipher. */
const readingOf = (nation: number, enemy: number): Insight => ({
  lead: new Float32Array(9),
  nations: 3,
  networks: [],
  revealed: Uint8Array.from({ length: 9 }, (_, pair) =>
    Number(pair === nation * 3 + enemy)
  ),
});

/** Nations 0 and 2 both at war with nation 1, the holder of province 2. */
const TWO_FRONTS = declared(declared(noWars(3), { one: 0, other: 1 }), {
  one: 1,
  other: 2,
});

/** The organisation each division keeps after a day on province 2 under `insight`, with two of nation 0 and one of nation 2 attacking one of nation 1. */
const organisationKnowing = (insight: Insight): readonly number[] =>
  foughtOneDay({ ...theatreOf(TWO_FRONTS), insight }, CONTESTED, [
    ...stackOf(2, 0),
    ...stackOf(1, 2),
    ...stackOf(1, 1),
  ]).standing.map((fighter) => fighter.organisation);

describe("foughtOneDay with what each side knows", () => {
  it("should strike the defender harder when the attacker reads the holder's revealed cipher", () => {
    const [, defender] = organisationUnder(NO_AIR_COVER, readingOf(0, 1));

    expect(defender).toBeCloseTo(60 - 3 * 1.15, 5);
  });

  it("should strike the attackers harder when the holder reads the cipher of the attacker with the most men", () => {
    const [attacker] = organisationKnowing(readingOf(1, 0));

    expect(attacker).toBeCloseTo(60 - (5 * 1.15) / 3, 10);
  });

  it("should fight as though it knew nothing when the holder reads only the cipher of the weaker attacker", () => {
    expect(organisationKnowing(readingOf(1, 2))).toStrictEqual(
      organisationKnowing(NO_INSIGHT)
    );
  });
});

/** How far each province of the line is from a fallback line through province 0. */
const FALLBACK_AT_HOME = Int32Array.from([0, 1, -1, -1, -1]);

describe(withdrawn, () => {
  it("should fall back onto ground its nation holds to regroup when a broken division has some behind it", () => {
    const beaten = division({ nation: 0, organisation: -4, province: 2 });

    expect(
      withdrawn(LINE_GRAPH, LINE_OWNERS, FALLBACK_AT_HOME, beaten)
    ).toStrictEqual([
      {
        ...beaten,
        marched: 0,
        movingTo: 1,
        organisation: 0,
        province: 1,
        task: "regroup",
      },
    ]);
  });

  it("should fall back on foot when the broken division came ashore from a landing", () => {
    const beached = division({
      arrival: "landing",
      nation: 0,
      organisation: -4,
      province: 2,
    });

    expect(
      withdrawn(LINE_GRAPH, LINE_OWNERS, FALLBACK_AT_HOME, beached)
    ).toStrictEqual([
      division({
        movingTo: 1,
        nation: 0,
        organisation: 0,
        province: 1,
        task: "regroup",
      }),
    ]);
  });

  it("should fall back toward the fallback line when its nation holds ground on both sides", () => {
    const flanked = Int32Array.from([1, 0, 1, 0, -1]);
    const nearerTheLine = Int32Array.from([-1, 2, -1, 0, -1]);
    const beaten = division({ nation: 0, organisation: -4, province: 2 });

    expect(
      withdrawn(LINE_GRAPH, flanked, nearerTheLine, beaten).map(
        (fallen) => fallen.province
      )
    ).toStrictEqual([3]);
  });

  it("should fall back onto the first ground of its own when no fallback line reaches any of it", () => {
    const beaten = division({ nation: 0, organisation: -4, province: 2 });

    expect(
      withdrawn(
        LINE_GRAPH,
        Int32Array.from([1, 0, 1, 0, -1]),
        Int32Array.from([-1, -1, -1, -1, -1]),
        beaten
      ).map((fallen) => fallen.province)
    ).toStrictEqual([1]);
  });

  it("should be lost when a broken division has nothing of its own behind it", () => {
    const pocket = division({ nation: 0, organisation: -4, province: 3 });

    expect(
      withdrawn(LINE_GRAPH, LINE_OWNERS, FALLBACK_AT_HOME, pocket)
    ).toStrictEqual([]);
  });
});
