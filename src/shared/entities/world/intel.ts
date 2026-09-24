import { Schema } from "effect";
import type { Agency, AgencyModifiers } from "./agency";
import { agencyModifiersOf, NO_AGENCY, NO_AGENCY_MODIFIERS } from "./agency";
import type { Ciphers } from "./cipher";
import { cipherStrengthOf } from "./cipher";
import type { Diplomacy } from "./diplomacy";
import { allied } from "./diplomacy";
import type { Division } from "./divisions";
import type { TradeLaw } from "./economy/trade";
import { valueAt } from "./grid";
import { itemAt } from "./lookup";
import type { Navy } from "./navy";
import type { Random } from "./random";
import type { Wars } from "./wars";
import { atWar } from "./wars";

/** The four things a nation gathers intelligence on about another. */
const IntelKindSchema = Schema.Literals(["civilian", "army", "navy", "air"]);

export type IntelKind = typeof IntelKindSchema.Type;

export const INTEL_KINDS = IntelKindSchema.literals;

const KINDS = INTEL_KINDS.length;

/** What one nation knows of another, each from 0 to 1. */
export interface IntelLevels {
  readonly civilian: number;
  readonly army: number;
  readonly navy: number;
  readonly air: number;
}

export const NO_INTEL: IntelLevels = { air: 0, army: 0, civilian: 0, navy: 0 };

/** The three kinds of intelligence fighting gathers. */
type FoughtKind = Exclude<IntelKind, "civilian">;

const FOUGHT_KINDS: readonly FoughtKind[] = ["army", "navy", "air"];

/**
 * The intelligence that builds up day by day and fades once what gathered it
 * stops: from fighting, and from the operatives a nation holds captive.
 */
export interface Gleaned {
  readonly nations: number;
  /** From fighting, by `(observer * nations + target) * 3` and then army, navy, air. */
  readonly fought: Float32Array;
  /** From captured operatives, by `(captor * nations + spy) * 4` and then each kind in order. */
  readonly extracted: Float32Array;
}

/** Nothing gathered yet. */
export const noGleaned = (nations: number): Gleaned => ({
  extracted: new Float32Array(nations * nations * KINDS),
  fought: new Float32Array(nations * nations * FOUGHT_KINDS.length),
  nations,
});

/** What each kind of fighting gathers, after Hearts of Iron IV's intel from combat. */
interface Yield {
  /** What the logarithm of one plus the day's base is multiplied by. */
  readonly logarithm: number;
  /** What the day's base is divided by and added. */
  readonly divisor: number;
  /** What the day's base is multiplied by before either. */
  readonly scale: number;
  /** The most this kind of fighting gathers, which is the wiki's effective cap. */
  readonly cap: number;
}

/**
 * Land battles, naval battles and air battles, after Hearts of Iron IV's
 * 0.25·ln(1+b) + b/10 capped at 30%, 0.02·ln(1+b) + b/200 capped at 40%,
 * and ln(1+b) + b/2 on a fifth of the base capped at 25%.
 */
const YIELDS = {
  air: { cap: 0.25, divisor: 2, logarithm: 1, scale: 0.2 },
  army: { cap: 0.3, divisor: 10, logarithm: 0.25, scale: 1 },
  navy: { cap: 0.4, divisor: 200, logarithm: 0.02, scale: 1 },
} satisfies Readonly<Record<FoughtKind, Yield>>;

/**
 * The share of what fighting gathered that a day keeps, after Hearts of Iron
 * IV's 0.985 a day for land and naval intel. The wiki gives the air's caps
 * and no decay, so the air fading as fast is this game's own.
 */
const FOUGHT_KEPT = 0.985;

/** What a day of fighting gathered, before its yield. */
const gainOf = (yieldOf: Yield, base: number): number => {
  const scaled = base * yieldOf.scale;
  return yieldOf.logarithm * Math.log1p(scaled) + scaled / yieldOf.divisor;
};

/**
 * A battle's base, after Hearts of Iron IV's 1% a battle and 0.5% an enemy
 * division fighting, times 0.01. Its reserves and retreats go uncounted here,
 * since a battle here has no reserve line to tell apart.
 */
const BASE_PER_BATTLE = 0.01;
const BASE_PER_ENEMY = 0.005;

/** The base of a day's fighting for every pair, by `(observer * nations + target) * 3` and kind. */
export type Clashes = Float64Array;

/** What a day's fighting reads. */
export interface Fighting {
  readonly nations: number;
  readonly wars: Wars;
  /** The divisions in the field as the day's battles began. */
  readonly divisions: readonly Division[];
  readonly navies: readonly Navy[];
  /** The air power each nation flew over each region today, by nation id and then region id. */
  readonly power: readonly Float32Array[];
}

/** `clashes` with one battle between the two added for each, each counting the other's forces there. */
const clashed = (
  clashes: Clashes,
  nations: number,
  kind: FoughtKind,
  pair: { readonly one: number; readonly other: number },
  forces: { readonly one: number; readonly other: number }
): void => {
  const slot = FOUGHT_KINDS.indexOf(kind);
  const one = (pair.one * nations + pair.other) * FOUGHT_KINDS.length + slot;
  const other = (pair.other * nations + pair.one) * FOUGHT_KINDS.length + slot;
  clashes[one] =
    valueAt(clashes, one) + BASE_PER_BATTLE + BASE_PER_ENEMY * forces.other;
  clashes[other] =
    valueAt(clashes, other) + BASE_PER_BATTLE + BASE_PER_ENEMY * forces.one;
};

/** How many of `nation`'s things stand in each place, by place and then nation. */
const countedByPlace = (
  entries: Iterable<{ readonly place: number; readonly nation: number }>,
  counts: Map<number, Map<number, number>>,
  weight: number
): void => {
  for (const entry of entries) {
    const here = counts.get(entry.place) ?? new Map<number, number>();
    here.set(entry.nation, (here.get(entry.nation) ?? 0) + weight);
    counts.set(entry.place, here);
  }
};

/** Every pair of nations at war in each place, with what each has there. */
const clashesIn = (
  counts: Map<number, Map<number, number>>,
  fighting: Fighting,
  kind: FoughtKind,
  clashes: Clashes
): void => {
  for (const here of counts.values()) {
    const present = [...here];
    for (const [index, [one, ones]] of present.entries()) {
      for (const [other, others] of present.slice(index + 1)) {
        if (!atWar(fighting.wars, one, other)) {
          continue;
        }
        clashed(
          clashes,
          fighting.nations,
          kind,
          { one, other },
          { one: ones, other: others }
        );
      }
    }
  }
};

/**
 * The base of the day's fighting for every pair of nations at war: a battle
 * in each province where both have divisions, counting the enemy divisions
 * there; one in each sea zone where both have ships, counting the enemy
 * ships there; and one over each region where both flew, counting no planes,
 * since the wiki gives the air's formula and not what goes into its base.
 */
export const clashesOf = (fighting: Fighting): Clashes => {
  const clashes = new Float64Array(
    fighting.nations * fighting.nations * FOUGHT_KINDS.length
  );
  const land = new Map<number, Map<number, number>>();
  countedByPlace(
    fighting.divisions.map((division) => ({
      nation: division.nation,
      place: division.province,
    })),
    land,
    1
  );
  clashesIn(land, fighting, "army", clashes);
  const sea = new Map<number, Map<number, number>>();
  for (const [nation, navy] of fighting.navies.entries()) {
    for (const force of navy.fleets) {
      countedByPlace(
        force.ships.map(() => ({ nation, place: force.zone })),
        sea,
        1
      );
    }
  }
  clashesIn(sea, fighting, "navy", clashes);
  const sky = new Map<number, Map<number, number>>();
  for (const [nation, regions] of fighting.power.entries()) {
    countedByPlace(
      [...regions.entries()].flatMap(([region, power]) => {
        if (power <= 0) {
          return [];
        }
        return [{ nation, place: region }];
      }),
      sky,
      0
    );
  }
  clashesIn(sky, fighting, "air", clashes);
  return clashes;
};

/**
 * What fighting has gathered one day on: every pair keeps its share of what
 * it had and adds what today's fighting gathered, up to each kind's cap.
 */
export const foughtOneDay = (gleaned: Gleaned, clashes: Clashes): Gleaned => ({
  ...gleaned,
  fought: Float32Array.from(gleaned.fought, (held, slot) => {
    const kind = itemAt(FOUGHT_KINDS, slot % FOUGHT_KINDS.length, "army");
    const yieldOf = YIELDS[kind];
    return Math.min(
      yieldOf.cap,
      held * FOUGHT_KEPT + gainOf(yieldOf, valueAt(clashes, slot))
    );
  }),
});

/**
 * What a captured operative gives up a day before the draw multiplies it, the
 * least and most the draw multiplies it by, and the share a day keeps once no
 * captive is left, after Hearts of Iron IV's 0.3% times 10 to 35 and 0.95.
 */
const EXTRACTED_PER_DAY = 0.003;
const LEAST_DRAW = 10;
const MOST_DRAW = 35;
const EXTRACTED_KEPT = 0.95;

/** The most captives give up of each kind, after Hearts of Iron IV. */
const EXTRACTED_CAPS = {
  air: 0.3,
  army: 0.4,
  civilian: 0.5,
  navy: 0.4,
} satisfies Readonly<Record<IntelKind, number>>;

/** What the captives held read. */
export interface Holding {
  /** How many of each nation's operatives each nation holds, by `captor * nations + spy`. */
  readonly held: Uint8Array;
  /** Each nation's agency, by nation id, whose interrogation adds to what it extracts. */
  readonly agencies: readonly Agency[];
}

/**
 * What captives have given up one day on: every captor holding a spy's
 * operatives gains, for each kind, ln(1 + b) + b/2 of a base the day's draw
 * sets, as its interrogation raises it, up to the kind's cap; and once it
 * holds none of that spy's, what it had fades.
 */
export const extractedOneDay = (
  gleaned: Gleaned,
  holding: Holding,
  random: Random
): Gleaned => {
  const extracted = Float32Array.from(gleaned.extracted);
  for (const [pair, count] of holding.held.entries()) {
    const start = pair * KINDS;
    if (count === 0) {
      for (let slot = start; slot < start + KINDS; slot += 1) {
        extracted[slot] = valueAt(extracted, slot) * EXTRACTED_KEPT;
      }
      continue;
    }
    const captor = Math.floor(pair / gleaned.nations);
    const base =
      EXTRACTED_PER_DAY *
      (LEAST_DRAW + (MOST_DRAW - LEAST_DRAW) * random.unit());
    const gain =
      (Math.log1p(base) + base / 2) *
      (1 +
        agencyModifiersOf(itemAt(holding.agencies, captor, NO_AGENCY))
          .extraction);
    for (const [index, kind] of INTEL_KINDS.entries()) {
      extracted[start + index] = Math.min(
        EXTRACTED_CAPS[kind],
        valueAt(extracted, start + index) + gain
      );
    }
  }
  return { ...gleaned, extracted };
};

/**
 * What a nation's trade law lets others see of its economy and its navy,
 * after Hearts of Iron IV.
 */
const TRADE_INTEL = {
  "closed-economy": NO_INTEL,
  "export-focus": { ...NO_INTEL, civilian: 0.2, navy: 0.1 },
  "free-trade": { ...NO_INTEL, civilian: 0.4, navy: 0.2 },
  "limited-exports": { ...NO_INTEL, civilian: 0.1, navy: 0.05 },
} satisfies Readonly<Record<TradeLaw, IntelLevels>>;

/**
 * The most a network gives of each kind, reached at half the target's land
 * covered, after Hearts of Iron IV's caps scaled by twice the coverage.
 */
const NETWORK_INTEL = {
  air: 0.3,
  army: 0.3,
  civilian: 0.3,
  navy: 0.4,
} satisfies Readonly<Record<IntelKind, number>>;
const COVERAGE_SCALE = 2;

/**
 * What an infiltration gives of its kind, what resistance contacts give of
 * the army, and what a broken cipher gives of every kind, passively and while
 * revealed, after Hearts of Iron IV.
 */
const INFILTRATION_INTEL = 0.1;
const CONTACTS_INTEL = { ...NO_INTEL, army: 0.05 } satisfies IntelLevels;
const CIPHER_INTEL = 0.1;
const REVEALED_INTEL = 0.6;

/** The share of an ally's lead a nation gains, after Hearts of Iron IV's 30%. */
const SHARED_WITH_ALLIES = 0.3;

/** What the department of each kind adds to it. */
const DEPARTMENT_OF = {
  air: "airIntel",
  army: "armyIntel",
  civilian: "civilianIntel",
  navy: "navyIntel",
} satisfies Readonly<Record<IntelKind, keyof AgencyModifiers>>;

/** Everything a nation's intelligence on the others is read from. */
export interface Sources {
  readonly nations: number;
  readonly diplomacy: Diplomacy;
  /** Each nation's agency, by nation id. */
  readonly agencies: readonly Agency[];
  /** Each nation's trade law, by nation id. */
  readonly tradeLaws: readonly TradeLaw[];
  /** The share of each target's land each nation's network counts in, by `observer * nations + target`. */
  readonly coverage: Float32Array;
  /** 1 where the observer has infiltrated that kind in the target, by `(observer * nations + target) * 4` and kind. */
  readonly infiltrated: Uint8Array;
  /** 1 where the observer holds resistance contacts against the target, by `observer * nations + target`. */
  readonly contacts: Uint8Array;
  /** Each nation's work on the others' ciphers, by nation id. */
  readonly ciphers: readonly Ciphers[];
  readonly gleaned: Gleaned;
}

/** What every nation knows of every other, by `(observer * nations + target) * 4` and kind. */
export interface IntelTable {
  readonly nations: number;
  readonly levels: Float32Array;
}

/** The ciphers of a nation the list does not reach, which has broken nothing. */
const NO_CIPHERS: Ciphers = {
  progress: new Float64Array(0),
  revealed: new Uint8Array(0),
};

/** What fighting has gathered of each kind for a pair, which is nothing of the civilian. */
const FOUGHT_INTEL = {
  air: (gleaned: Gleaned, pair: number) =>
    valueAt(gleaned.fought, pair * FOUGHT_KINDS.length + 2),
  army: (gleaned: Gleaned, pair: number) =>
    valueAt(gleaned.fought, pair * FOUGHT_KINDS.length),
  civilian: () => 0,
  navy: (gleaned: Gleaned, pair: number) =>
    valueAt(gleaned.fought, pair * FOUGHT_KINDS.length + 1),
} satisfies Readonly<
  Record<IntelKind, (gleaned: Gleaned, pair: number) => number>
>;

/** Each nation's agency read once for a whole table: what it adds, and how strong its cipher is. */
interface Readout {
  readonly modifiers: readonly AgencyModifiers[];
  readonly strengths: readonly number[];
}

/** What the observer's broken cipher of the target gives of every kind. */
const cipherIntel = (
  sources: Sources,
  readout: Readout,
  observer: number,
  target: number
): number => {
  const ciphers = itemAt(sources.ciphers, observer, NO_CIPHERS);
  if (
    valueAt(ciphers.progress, target) <
    itemAt(readout.strengths, target, Number.POSITIVE_INFINITY)
  ) {
    return 0;
  }
  if (valueAt(ciphers.revealed, target) > 0) {
    return REVEALED_INTEL;
  }
  return CIPHER_INTEL;
};

/** What the observer gathers of `kind` on the target on its own, before its allies share theirs. */
const ownIntel = (
  sources: Sources,
  readout: Readout,
  pair: { readonly observer: number; readonly target: number },
  kind: IntelKind
): number => {
  const { observer, target } = pair;
  const { nations } = sources;
  const index = observer * nations + target;
  const slot = INTEL_KINDS.indexOf(kind);
  const modifiers = itemAt(readout.modifiers, observer, NO_AGENCY_MODIFIERS);
  const law = itemAt(sources.tradeLaws, target, "closed-economy");
  const traded = TRADE_INTEL[law][kind];
  const fought = FOUGHT_INTEL[kind](sources.gleaned, index);
  const assets =
    (NETWORK_INTEL[kind] *
      Math.min(1, COVERAGE_SCALE * valueAt(sources.coverage, index)) +
      INFILTRATION_INTEL * valueAt(sources.infiltrated, index * KINDS + slot)) *
    (1 + modifiers.assets);
  const contacts = CONTACTS_INTEL[kind] * valueAt(sources.contacts, index);
  const gathered =
    (traded +
      fought +
      assets +
      contacts +
      cipherIntel(sources, readout, observer, target) +
      valueAt(sources.gleaned.extracted, index * KINDS + slot)) *
    (1 + modifiers[DEPARTMENT_OF[kind]]);
  return Math.min(1, gathered);
};

/**
 * What every nation knows of every other once its allies have shared: its own
 * intelligence on each target, raised by 30% of how far the best-informed
 * ally is ahead of it there.
 */
const sharedWithAllies = (
  own: Float32Array,
  diplomacy: Diplomacy,
  nations: number
): Float32Array => {
  const levels = Float32Array.from(own);
  for (let observer = 0; observer < nations; observer += 1) {
    for (let ally = 0; ally < nations; ally += 1) {
      if (ally === observer || !allied(diplomacy, observer, ally)) {
        continue;
      }
      for (let slot = 0; slot < nations * KINDS; slot += 1) {
        const mine = observer * nations * KINDS + slot;
        const lead =
          valueAt(own, ally * nations * KINDS + slot) - valueAt(own, mine);
        levels[mine] = Math.max(
          valueAt(levels, mine),
          valueAt(own, mine) +
            SHARED_WITH_ALLIES *
              Math.max(0, lead) *
              Number(Math.floor(slot / KINDS) !== observer)
        );
      }
    }
  }
  return levels;
};

/**
 * What every nation knows of every other: what it gathers itself, and 30% of
 * how far the best-informed ally is ahead of it. A nation knows nothing of
 * itself here, since it never looks.
 */
export const intelTableOf = (sources: Sources): IntelTable => {
  const { nations } = sources;
  const own = new Float32Array(nations * nations * KINDS);
  const readout: Readout = {
    modifiers: sources.agencies.map(agencyModifiersOf),
    strengths: sources.agencies.map(cipherStrengthOf),
  };
  for (let observer = 0; observer < nations; observer += 1) {
    for (let target = 0; target < nations; target += 1) {
      if (observer === target) {
        continue;
      }
      for (const [slot, kind] of INTEL_KINDS.entries()) {
        own[(observer * nations + target) * KINDS + slot] = ownIntel(
          sources,
          readout,
          { observer, target },
          kind
        );
      }
    }
  }
  return { levels: sharedWithAllies(own, sources.diplomacy, nations), nations };
};

/** What `observer` knows of `target`. */
export const intelOn = (
  table: IntelTable,
  observer: number,
  target: number
): IntelLevels => {
  const start = (observer * table.nations + target) * KINDS;
  return {
    air: valueAt(table.levels, start + 3),
    army: valueAt(table.levels, start + 1),
    civilian: valueAt(table.levels, start),
    navy: valueAt(table.levels, start + 2),
  };
};
