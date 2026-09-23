import type { Diplomacy } from "./diplomacy";
import type { NationEconomy } from "./economy";
import type { Service } from "./espionage";
import { NO_SERVICE } from "./espionage";
import { valueAt } from "./grid";
import type { Gleaned, IntelTable } from "./intel";
import { intelOn, intelTableOf } from "./intel";
import { itemAt } from "./lookup";
import type { Networks } from "./networks";
import { NETWORK_FLOOR } from "./networks";
import type { ProvinceGraph } from "./provinces";
import { isLand } from "./provinces";
import type { Unrest } from "./unrest";

/** What every nation's intelligence on the others is read from, as the simulation holds it. */
export interface Espial {
  readonly diplomacy: Diplomacy;
  readonly economies: readonly NationEconomy[];
  readonly services: readonly Service[];
  readonly networks: Networks;
  readonly gleaned: Gleaned;
  readonly unrest: readonly Unrest[];
  /** Who holds each province, by province id. */
  readonly owners: Int32Array;
  readonly graph: ProvinceGraph;
}

/**
 * The share of each nation's land every other nation's network counts in,
 * by `observer * nations + target`, wherever that network was built.
 */
const coverageByPair = (espial: Espial): Float32Array => {
  const nations = espial.services.length;
  const covered = new Float32Array(nations * nations);
  const held = new Float32Array(nations);
  for (const [province, holder] of espial.owners.entries()) {
    if (holder < 0 || !isLand(espial.graph, province)) {
      continue;
    }
    held[holder] = valueAt(held, holder) + 1;
    for (const [observer, network] of espial.networks.entries()) {
      const pair = observer * nations + holder;
      covered[pair] =
        valueAt(covered, pair) +
        Number(
          observer !== holder && valueAt(network, province) >= NETWORK_FLOOR
        );
    }
  }
  return covered.map(
    (count, pair) => count / Math.max(1, valueAt(held, pair % nations))
  );
};

/** 1 where the observer holds resistance contacts against the target, by `observer * nations + target`. */
const contactsByPair = (
  unrest: readonly Unrest[],
  nations: number
): Uint8Array => {
  const contacts = new Uint8Array(nations * nations);
  for (const work of unrest) {
    if (work.kind === "contacts") {
      contacts[work.spy * nations + work.occupier] = 1;
    }
  }
  return contacts;
};

/** What every nation knows of every other today. */
export const intelOf = (espial: Espial): IntelTable => {
  const nations = espial.services.length;
  const infiltrated = new Uint8Array(nations * nations * 4);
  for (const [observer, service] of espial.services.entries()) {
    infiltrated.set(
      service.infiltrated.subarray(0, nations * 4),
      observer * nations * 4
    );
  }
  return intelTableOf({
    agencies: espial.services.map((service) => service.agency),
    ciphers: espial.services.map((service) => service.ciphers),
    contacts: contactsByPair(espial.unrest, nations),
    coverage: coverageByPair(espial),
    diplomacy: espial.diplomacy,
    gleaned: espial.gleaned,
    infiltrated,
    nations,
    tradeLaws: espial.economies.map((economy) => economy.tradeLaw),
  });
};

/**
 * What knowing an enemy better than it knows you does in a land battle,
 * after Hearts of Iron IV: from a lead of 5 points of army intel, 0.3% more
 * attack and defence a point, up to 15% at 50; a quarter more where the
 * nation's network counts in the province; and 15% more against a nation
 * whose revealed cipher it is reading.
 */
const LEAD_FLOOR = 5;
const EDGE_PER_POINT = 0.003;
const MOST_EDGE = 0.15;
const LOCAL_NETWORK = 0.25;
const REVEALED_EDGE = 0.15;
const POINTS = 100;

/** What each nation brings to a land battle from what it knows of the enemy. */
export interface Insight {
  readonly nations: number;
  /** The edge each nation's lead in army intel gives it, by `nation * nations + enemy`. */
  readonly lead: Float32Array;
  /** 1 where the nation is reading the enemy's revealed cipher, by `nation * nations + enemy`. */
  readonly revealed: Uint8Array;
  readonly networks: Networks;
}

/** The network of a nation the list does not reach, which counts nowhere. */
const NO_NETWORK = new Float32Array(0);

/** No nation bringing anything to a battle from what it knows. */
export const NO_INSIGHT: Insight = {
  lead: new Float32Array(0),
  nations: 0,
  networks: [],
  revealed: new Uint8Array(0),
};

/** What each nation brings to a land battle today from `table`. */
export const insightOf = (
  table: IntelTable,
  services: readonly Service[],
  networks: Networks
): Insight => {
  const { nations } = table;
  const lead = new Float32Array(nations * nations);
  const revealed = new Uint8Array(nations * nations);
  for (let nation = 0; nation < nations; nation += 1) {
    const { ciphers } = itemAt(services, nation, NO_SERVICE);
    for (let enemy = 0; enemy < nations; enemy += 1) {
      const points =
        (intelOn(table, nation, enemy).army -
          intelOn(table, enemy, nation).army) *
        POINTS;
      lead[nation * nations + enemy] =
        Math.min(MOST_EDGE, EDGE_PER_POINT * points) *
        Number(points >= LEAD_FLOOR);
      revealed[nation * nations + enemy] = Number(
        valueAt(ciphers.revealed, enemy) > 0
      );
    }
  }
  return { lead, nations, networks, revealed };
};

/**
 * The share `nation` adds to its divisions' attack and defence against
 * `enemy` in `province`, which is none against no enemy at all.
 */
export const edgeAgainst = (
  insight: Insight,
  nation: number,
  enemy: number,
  province: number
): number => {
  const pair = nation * insight.nations + enemy;
  const local = Number(
    valueAt(itemAt(insight.networks, nation, NO_NETWORK), province) >=
      NETWORK_FLOOR
  );
  return (
    (valueAt(insight.lead, pair) * (1 + LOCAL_NETWORK * local) +
      REVEALED_EDGE * valueAt(insight.revealed, pair)) *
    Number(enemy >= 0)
  );
};
