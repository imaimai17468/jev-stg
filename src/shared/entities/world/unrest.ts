import type { Compliance } from "./compliance";
import { countedDown } from "./countdown";
import type { Networks } from "./geography/networks";
import { NETWORK_FLOOR } from "./geography/networks";
import { valueAt } from "./grid";
import { itemAt } from "./lookup";

/** What a nation's operatives have stirred up against an occupier. */
export type UnrestKind = "contacts" | "strengthened" | "sabotage";

/** One piece of resistance work a nation has running against an occupier. */
export interface Unrest {
  readonly kind: UnrestKind;
  /** The nation whose operatives set it running. */
  readonly spy: number;
  /** The nation whose occupation it works against. */
  readonly occupier: number;
  readonly daysLeft: number;
  /**
   * What it adds to the resistance where it reaches, or, for sabotage, the
   * share of the occupied factories there it keeps from working.
   */
  readonly share: number;
}

/**
 * The days each kind runs, and what each adds before the spy's agency raises
 * it. Contacts run 60 days and add 10% to the resistance target after Hearts
 * of Iron IV, and strengthening adds another 10%. The wiki gives no duration
 * for strengthening or sabotage and no number for what sabotage does, so
 * those are this game's own.
 */
const TERMS = {
  contacts: { days: 60, share: 0.1 },
  sabotage: { days: 90, share: 0.5 },
  strengthened: { days: 60, share: 0.1 },
} satisfies Readonly<
  Record<UnrestKind, { readonly days: number; readonly share: number }>
>;

/**
 * The resistance work `kind` sets running for `spy` against `occupier`, with
 * `raised` of it on top from the spy's agency. Contacts give only the
 * resistance they reach, so the agency raises the other two.
 */
export const unrestStarted = (
  kind: UnrestKind,
  sides: { readonly spy: number; readonly occupier: number },
  raised: number
): Unrest => ({
  ...sides,
  daysLeft: TERMS[kind].days,
  kind,
  share: TERMS[kind].share * (1 + raised * Number(kind !== "contacts")),
});

/** The resistance work still running one day on. */
export const unrestOneDay = (unrest: readonly Unrest[]): readonly Unrest[] =>
  countedDown(unrest);

/** The resistance work `spy` has running against `occupier`. */
export const unrestAgainst = (
  unrest: readonly Unrest[],
  spy: number,
  occupier: number
): ReadonlySet<UnrestKind> =>
  new Set(
    unrest.flatMap((work) => {
      if (work.spy !== spy || work.occupier !== occupier) {
        return [];
      }
      return [work.kind];
    })
  );

/** What the resistance work does to each province, by province id. */
export interface Stirred {
  /** What it adds to the resistance, which slows the province's compliance. */
  readonly resistance: Float32Array;
  /** The share of the province's factories it keeps from working, from 0 to 1. */
  readonly sabotage: Float32Array;
}

/** The network of a nation the list does not reach, which counts nowhere. */
const NO_NETWORK = new Float32Array(0);

/**
 * What every piece of resistance work does to each province: it reaches the
 * ground its occupier holds away from home wherever the spy's network counts
 * there, adding its share to the resistance or, for sabotage, to the
 * factories kept idle, up to all of them.
 */
export const stirredBy = (
  unrest: readonly Unrest[],
  networks: Networks,
  owners: Int32Array,
  compliance: Compliance
): Stirred => {
  const resistance = new Float32Array(owners.length);
  const sabotage = new Float32Array(owners.length);
  const into = { contacts: resistance, sabotage, strengthened: resistance };
  for (const work of unrest) {
    const network = itemAt(networks, work.spy, NO_NETWORK);
    for (const [province, holder] of owners.entries()) {
      if (
        holder !== work.occupier ||
        valueAt(compliance.natives, province) === holder ||
        valueAt(network, province) < NETWORK_FLOOR
      ) {
        continue;
      }
      const field = into[work.kind];
      field[province] = Math.min(1, valueAt(field, province) + work.share);
    }
  }
  return { resistance, sabotage };
};
