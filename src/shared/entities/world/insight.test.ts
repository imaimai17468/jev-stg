import { describe, expect, it } from "vite-plus/test";
import { LINE_GRAPH, LINE_OWNERS } from "./army-fixture";
import { noCiphers } from "./cipher";
import { openingDiplomacy } from "./diplomacy";
import type { NationEconomy } from "./economy";
import { NO_ECONOMY } from "./economy";
import type { Service } from "./espionage";
import { openingServices, serviceFor } from "./espionage";
import { valueAt } from "./grid";
import type { Espial, Insight } from "./insight";
import { edgeAgainst, insightOf, intelOf } from "./insight";
import type { IntelLevels, IntelTable } from "./intel";
import { intelOn, NO_INTEL, noGleaned } from "./intel";
import { noNetworks } from "./networks";

/** An economy that lets nobody see into it. */
const CLOSED: NationEconomy = { ...NO_ECONOMY, tradeLaw: "closed-economy" };

/** The line's two closed economies with nothing gathered on each other. */
const espialOf = (patch: Partial<Espial>): Espial => ({
  diplomacy: openingDiplomacy(LINE_OWNERS, 2, []),
  economies: [CLOSED, CLOSED],
  gleaned: noGleaned(2),
  graph: LINE_GRAPH,
  networks: noNetworks(2, 5),
  owners: LINE_OWNERS,
  services: openingServices(2),
  unrest: [],
  ...patch,
});

/** What nation 0 knows of nation 1 from `espial`. */
const zeroOnOne = (espial: Espial): IntelLevels =>
  intelOn(intelOf(espial), 0, 1);

/** Nation 0's network counting in the one province `province`, and nation 1 with none. */
const networkIn = (province: number) => [
  Float32Array.from({ length: 5 }, (_, at) => 10 * Number(at === province)),
  new Float32Array(5),
];

describe(intelOf, () => {
  it("should gather each kind's network cap when the observer's network counts in half of the nation's land", () => {
    expect(zeroOnOne(espialOf({ networks: networkIn(2) }))).toStrictEqual({
      air: Math.fround(0.3),
      army: Math.fround(0.3),
      civilian: Math.fround(0.3),
      navy: Math.fround(0.4),
    });
  });

  it("should count no sea zone as the nation's land when the nation is set down as holding one", () => {
    expect(
      zeroOnOne(
        espialOf({
          networks: networkIn(4),
          owners: Int32Array.from([0, 0, 1, 1, 1]),
        })
      )
    ).toStrictEqual(NO_INTEL);
  });

  it("should gather a twentieth of the army when the observer holds resistance contacts against the nation", () => {
    expect(
      zeroOnOne(
        espialOf({
          unrest: [
            { daysLeft: 60, kind: "contacts", occupier: 1, share: 0.1, spy: 0 },
          ],
        })
      )
    ).toStrictEqual({ ...NO_INTEL, army: Math.fround(0.05) });
  });

  it("should gather nothing from resistance work when it is sabotage rather than contacts", () => {
    expect(
      zeroOnOne(
        espialOf({
          unrest: [
            { daysLeft: 90, kind: "sabotage", occupier: 1, share: 0.5, spy: 0 },
          ],
        })
      )
    ).toStrictEqual(NO_INTEL);
  });

  it("should gather a tenth of the army when the observer's service has infiltrated it", () => {
    const infiltrating: Service = {
      ...serviceFor(2),
      infiltrated: Uint8Array.from([0, 0, 0, 0, 0, 1, 0, 0]),
    };

    expect(
      zeroOnOne(espialOf({ services: [infiltrating, serviceFor(2)] }))
    ).toStrictEqual({ ...NO_INTEL, army: Math.fround(0.1) });
  });

  it("should see into the economy of a nation when its economy trades freely", () => {
    expect(
      zeroOnOne(
        espialOf({
          economies: [CLOSED, { ...CLOSED, tradeLaw: "free-trade" }],
        })
      ).civilian
    ).toBeCloseTo(0.4, 6);
  });
});

/** Two nations where nation 0 knows `army` of nation 1's army and nation 1 nothing of nation 0's. */
const tableKnowing = (army: number): IntelTable => ({
  levels: Float32Array.from(
    { length: 16 },
    (_, slot) => army * Number(slot === 5)
  ),
  nations: 2,
});

/** The edge nation 0's lead gives it against nation 1, when it knows `army` of nation 1's army. */
const leadKnowing = (army: number): number =>
  valueAt(insightOf(tableKnowing(army), [], []).lead, 1);

describe(insightOf, () => {
  it("should give 0.3% a point of the lead when the observer knows the enemy's army 20 points better", () => {
    expect(leadKnowing(0.2)).toBeCloseTo(0.06, 6);
  });

  it("should give nothing when the lead falls short of five points", () => {
    expect(leadKnowing(0.04)).toBe(0);
  });

  it("should give no more than 15% when the lead passes 50 points", () => {
    expect(leadKnowing(0.9)).toBe(Math.fround(0.15));
  });

  it("should mark the nation reading the enemy's cipher when its reveal is running", () => {
    const reading: Service = {
      ...serviceFor(2),
      ciphers: { ...noCiphers(2), revealed: Uint8Array.from([0, 5]) },
    };

    expect(
      insightOf(tableKnowing(0), [reading, serviceFor(2)], []).revealed
    ).toStrictEqual(Uint8Array.from([0, 1, 0, 0]));
  });
});

/** Two nations where nation 0 has a lead of 0.1 on nation 1, reading its cipher where `revealed`. */
const insightWith = (patch: Partial<Insight>): Insight => ({
  lead: Float32Array.from([0, 0.1, 0, 0]),
  nations: 2,
  networks: [],
  revealed: new Uint8Array(4),
  ...patch,
});

describe(edgeAgainst, () => {
  it("should add the lead's edge when the nation's network does not count in the province", () => {
    expect(edgeAgainst(insightWith({}), 0, 1, 2)).toBeCloseTo(0.1, 6);
  });

  it("should add a quarter more to the lead's edge when the nation's network counts in the province", () => {
    expect(
      edgeAgainst(insightWith({ networks: networkIn(2) }), 0, 1, 2)
    ).toBeCloseTo(0.125, 6);
  });

  it("should add 15% more when the nation is reading the enemy's revealed cipher", () => {
    expect(
      edgeAgainst(
        insightWith({ revealed: Uint8Array.from([0, 1, 0, 0]) }),
        0,
        1,
        2
      )
    ).toBeCloseTo(0.25, 6);
  });

  it("should add nothing when there is no enemy at all", () => {
    expect(edgeAgainst(insightWith({}), 0, -1, 2)).toBe(0);
  });
});
