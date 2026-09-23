import type { Armies } from "./army";
import type { Diplomacy, Standing } from "./diplomacy";
import { INDEPENDENT, leftTheWar, peaceMade, puppetsOf } from "./diplomacy";
import { shareTransferred } from "./economy";
import { valueAt } from "./grid";
import type { World } from "./index";
import { sentHome } from "./muster";

/** What the victor takes from a nation that has surrendered. */
export type PeaceTerms = "annex" | "puppet" | "cede";

/** Every set of terms, from the harshest to the mildest. */
export const PEACE_TERMS: readonly PeaceTerms[] = ["annex", "puppet", "cede"];

/** Who dictates the peace, and what they dictate. */
export interface Settlement {
  readonly victor: number;
  readonly terms: PeaceTerms;
}

/** The armies and the diplomacy together, which is what a peace rewrites. */
export interface Settled {
  readonly armies: Armies;
  readonly diplomacy: Diplomacy;
}

/** The standing each set of terms leaves the loser in. */
const standingAfter = (settlement: Settlement): Standing => {
  if (settlement.terms === "annex") {
    return { by: settlement.victor, kind: "annexed" };
  }
  if (settlement.terms === "puppet") {
    return { kind: "puppet", overlord: settlement.victor };
  }
  return INDEPENDENT;
};

/**
 * The loser's ground, people and industry handed to the victor, and its army
 * disbanded, which is what annexing it means.
 */
const annexed = (armies: Armies, loser: number, victor: number): Armies => ({
  divisions: armies.divisions.filter((division) => division.nation !== loser),
  economies: shareTransferred(armies.economies, loser, victor, 1),
  owners: Int32Array.from(armies.owners, (owner) => {
    if (owner === loser) {
      return victor;
    }
    return owner;
  }),
});

/** The armies once the terms have moved whatever ground they move. */
const handedOver = (
  armies: Armies,
  loser: number,
  settlement: Settlement
): Armies => {
  if (settlement.terms === "annex") {
    return annexed(armies, loser, settlement.victor);
  }
  return armies;
};

/**
 * The diplomacy once the loser's puppets have followed it out of the war. A
 * loser that cedes keeps them and they make peace beside it, and one annexed or
 * made a puppet itself can no longer hold them, so they go free.
 */
const puppetsSettled = (
  diplomacy: Diplomacy,
  puppets: readonly number[],
  terms: PeaceTerms
): Diplomacy => {
  let settledPuppets = diplomacy;
  for (const puppet of puppets) {
    if (terms === "cede") {
      settledPuppets = peaceMade(settledPuppets, puppet);
      continue;
    }
    settledPuppets = leftTheWar(settledPuppets, puppet, INDEPENDENT);
  }
  return settledPuppets;
};

/**
 * The homelands once the peace is signed: every province that was the loser's
 * homeland or is still the loser's ground becomes the homeland of whoever
 * holds it now. A nation's next war then measures its surrender against what
 * it came out of this one holding, rather than against ground it already gave
 * up, which would have it surrender the day it declared.
 */
const redrawnHomelands = (
  cores: Int32Array,
  owners: Int32Array,
  loser: number
): Int32Array =>
  Int32Array.from(cores, (core, province) => {
    const owner = valueAt(owners, province);
    if (core === loser || owner === loser) {
      return owner;
    }
    return core;
  });

/**
 * The world after `loser` surrenders on `settlement`'s terms.
 *
 * Ground taken during the war was handed over the day it was taken, so ceding
 * keeps it where it is and ends the war, and the two harsher terms go further
 * from there. Every division the peace leaves on ground held by a nation it is
 * neither allied with nor fighting goes home.
 */
export const settled = (
  world: World,
  before: Settled,
  loser: number,
  settlement: Settlement
): Settled => {
  const diplomacy = puppetsSettled(
    leftTheWar(before.diplomacy, loser, standingAfter(settlement)),
    puppetsOf(before.diplomacy, loser),
    settlement.terms
  );
  const armies = handedOver(before.armies, loser, settlement);
  return {
    armies: {
      ...armies,
      divisions: sentHome(world, armies.owners, diplomacy, armies.divisions),
    },
    diplomacy: {
      ...diplomacy,
      cores: redrawnHomelands(diplomacy.cores, armies.owners, loser),
    },
  };
};
