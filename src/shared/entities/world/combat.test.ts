import { describe, expect, it } from "vite-plus/test";
import {
  AT_WAR,
  division,
  FULL_SUPPLY,
  LINE_GRAPH,
  LINE_OWNERS,
  LINE_WORLD,
} from "./army-fixture";
import type { Battle, Theatre } from "./combat";
import { foughtOneDay, withdrawn } from "./combat";
import type { Division } from "./divisions";
import { itemAt } from "./lookup";
import { NO_MODIFIERS } from "./modifiers";
import type { LandProvince } from "./provinces";
import { landProvinces } from "./provinces";
import { UNASSIGNED } from "./spread";
import type { Wars } from "./wars";
import { declared, noWars } from "./wars";

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

describe(withdrawn, () => {
  it("should fall back onto ground its nation holds when a broken division has some behind it", () => {
    const beaten = division({ nation: 0, organisation: -4, province: 2 });

    expect(withdrawn(LINE_GRAPH, LINE_OWNERS, beaten)).toStrictEqual([
      { ...beaten, marched: 0, movingTo: 1, organisation: 0, province: 1 },
    ]);
  });

  it("should be lost when a broken division has nothing of its own behind it", () => {
    const pocket = division({ nation: 0, organisation: -4, province: 3 });

    expect(withdrawn(LINE_GRAPH, LINE_OWNERS, pocket)).toStrictEqual([]);
  });
});
