import { describe, expect, it } from "vite-plus/test";
import { division } from "./army-fixture";
import type { Diplomacy } from "./diplomacy";
import { INDEPENDENT, standingOf, warDeclared } from "./diplomacy";
import { ROW_PEACE, ROW_WORLD } from "./diplomacy-fixture";
import { NO_ECONOMY } from "./economy/economy";
import type { PeaceTerms, Settled } from "./peace";
import { settled } from "./peace";
import { UNASSIGNED } from "./spread";
import { enemiesOf } from "./wars";

/**
 * Nation 0 at war with nation 1 and its puppet 3. Nation 0 has taken
 * province 1, nation 1 still holds province 2 which it took from nation 2
 * before, and one of nation 1's divisions stands in province 0 attacking.
 */
const WAR: Diplomacy = warDeclared(
  {
    ...ROW_PEACE,
    standings: [
      INDEPENDENT,
      INDEPENDENT,
      INDEPENDENT,
      { kind: "puppet", overlord: 1 },
    ],
  },
  0,
  1
);

const BEFORE: Settled = {
  armies: {
    divisions: [
      division({ nation: 1, province: 0 }),
      division({ nation: 0, province: 1 }),
    ],
    economies: [
      { ...NO_ECONOMY, population: 300_000 },
      { ...NO_ECONOMY, population: 300_000 },
      NO_ECONOMY,
      NO_ECONOMY,
    ],
    owners: Int32Array.from([0, 0, 1, 3, UNASSIGNED]),
  },
  diplomacy: WAR,
};

describe(settled, () => {
  it.each([
    { raised: 0.1, terms: "annex" },
    { raised: 0.05, terms: "puppet" },
    { raised: 0.02, terms: "cede" },
  ] satisfies readonly {
    readonly raised: number;
    readonly terms: PeaceTerms;
  }[])(
    "should raise world tension by $raised when the loser signs $terms terms",
    ({ raised, terms }) => {
      const after = settled(ROW_WORLD, BEFORE, 1, { terms, victor: 0 });

      expect(after.diplomacy.tension - WAR.tension).toBeCloseTo(raised);
    }
  );

  it("should hand the loser's ground to the victor when it is annexed", () => {
    const after = settled(ROW_WORLD, BEFORE, 1, { terms: "annex", victor: 0 });

    expect([...after.armies.owners]).toStrictEqual([0, 0, 0, 3, UNASSIGNED]);
  });

  it("should hand the loser's people to the victor when it is annexed", () => {
    const after = settled(ROW_WORLD, BEFORE, 1, { terms: "annex", victor: 0 });

    expect(
      after.armies.economies.map((economy) => economy.population)
    ).toStrictEqual([600_000, 0, 0, 0]);
  });

  it("should disband the loser's army when it is annexed", () => {
    const after = settled(ROW_WORLD, BEFORE, 1, { terms: "annex", victor: 0 });

    expect(after.armies.divisions).toStrictEqual([
      division({ nation: 0, province: 1 }),
    ]);
  });

  it("should end the loser's wars under the victor when it is made a puppet", () => {
    const after = settled(ROW_WORLD, BEFORE, 1, { terms: "puppet", victor: 0 });

    expect({
      enemies: enemiesOf(after.diplomacy.wars, 1),
      standing: standingOf(after.diplomacy, 1),
    }).toStrictEqual({
      enemies: [],
      standing: { kind: "puppet", overlord: 0 },
    });
  });

  it("should send the loser's attackers home when it cedes what it lost", () => {
    const after = settled(ROW_WORLD, BEFORE, 1, { terms: "cede", victor: 0 });

    expect(after.armies.divisions).toStrictEqual([
      division({ movingTo: 2, nation: 1, province: 2 }),
      division({ nation: 0, province: 1 }),
    ]);
  });

  it("should free the loser's puppets from the war when it is annexed", () => {
    const after = settled(ROW_WORLD, BEFORE, 1, { terms: "annex", victor: 0 });

    expect({
      enemies: enemiesOf(after.diplomacy.wars, 3),
      standing: standingOf(after.diplomacy, 3),
    }).toStrictEqual({ enemies: [], standing: INDEPENDENT });
  });

  it("should keep the loser's puppets and bring them out of the war beside it when it cedes", () => {
    const after = settled(ROW_WORLD, BEFORE, 1, { terms: "cede", victor: 0 });

    expect({
      enemies: enemiesOf(after.diplomacy.wars, 3),
      standing: standingOf(after.diplomacy, 3),
    }).toStrictEqual({
      enemies: [],
      standing: { kind: "puppet", overlord: 1 },
    });
  });

  it("should make the loser's lost and kept ground the homeland of whoever holds it when it surrenders", () => {
    const after = settled(ROW_WORLD, BEFORE, 1, { terms: "cede", victor: 0 });

    expect([...after.diplomacy.cores]).toStrictEqual([0, 0, 1, 3, UNASSIGNED]);
  });
});
