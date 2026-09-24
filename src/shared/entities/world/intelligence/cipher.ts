import { valueAt } from "../grid";
import { itemAt } from "../lookup";
import type { Agency } from "./agency";
import { agencyModifiersOf, levelsOf } from "./agency";

/**
 * How far a nation has got into breaking each other nation's cipher, and how
 * long it has left to use what it revealed, by the other nation's id.
 */
export interface Ciphers {
  /** The decryption put into each nation's cipher so far. */
  readonly progress: Float64Array;
  /** The days left of the reveal against each nation, 0 where none is running. */
  readonly revealed: Uint8Array;
}

/** A nation that has put nothing into any cipher. */
export const noCiphers = (nations: number): Ciphers => ({
  progress: new Float64Array(nations),
  revealed: new Uint8Array(nations),
});

/**
 * The decryption a cipher takes to break, and what each level of the owner's
 * cryptology adds to it, after Hearts of Iron IV's 12,000 + 4,250 a level.
 */
const BASE_STRENGTH = 12_000;
const STRENGTH_PER_LEVEL = 4250;

/** The decryption it takes to break the cipher of a nation whose agency is `agency`. */
export const cipherStrengthOf = (agency: Agency): number =>
  BASE_STRENGTH + STRENGTH_PER_LEVEL * agencyModifiersOf(agency).cryptology;

/**
 * The share of its decryption a nation at peace keeps, after Hearts of Iron
 * IV's 50% penalty for a country not at war.
 */
const KEPT_AT_PEACE = 0.5;

/** The share of its decryption a nation keeps, at peace and then at war. */
const KEPT_BY_WAR: readonly number[] = [KEPT_AT_PEACE, 1];

/**
 * The days a revealed cipher gives, and the share of the cipher's strength
 * the breaker's progress falls back to once the owner changes its codes,
 * after Hearts of Iron IV's 30 days and 50%.
 */
const REVEAL_DAYS = 30;
const KEPT_AFTER_REVEAL = 0.5;

/** Whether `agency` can decrypt at all, which takes a cryptology department. */
export const decrypts = (agency: Agency): boolean =>
  levelsOf(agency, "cryptology-department") > 0;

/** What a day of decryption works on, and against whose ciphers. */
export interface Decrypting {
  readonly agency: Agency;
  /** The nations whose ciphers it works on today, which split its decryption evenly. */
  readonly targets: readonly number[];
  /** Whether the nation is at war, which keeps all of its decryption. */
  readonly atWar: boolean;
  /** The decryption it takes to break each nation's cipher, by nation id. */
  readonly strengths: readonly number[];
  /** The nations it is fighting, whose broken ciphers it reveals. */
  readonly enemies: readonly number[];
}

/** What one day of decryption left, and the ciphers it broke that day. */
export interface Decrypted {
  readonly ciphers: Ciphers;
  readonly cracked: readonly number[];
}

/**
 * One day of decryption: the nation's decryption, halved at peace, split
 * evenly over its targets whose ciphers are still unbroken; the broken cipher
 * of every enemy revealed for thirty days unless a reveal is already running,
 * and when those end, the owner's new codes putting the breaker's progress
 * back to half the strength. An agency with no cryptology department breaks
 * nothing new, but still reveals and waits out what it broke before.
 */
export const decryptedOneDay = (
  ciphers: Ciphers,
  decrypting: Decrypting
): Decrypted => {
  const progress = Float64Array.from(ciphers.progress);
  const revealed = Uint8Array.from(ciphers.revealed);
  const strengthOf = (target: number) =>
    itemAt(decrypting.strengths, target, Number.POSITIVE_INFINITY);
  for (const [target, days] of revealed.entries()) {
    if (days === 0) {
      continue;
    }
    revealed[target] = days - 1;
    if (days === 1) {
      progress[target] = KEPT_AFTER_REVEAL * strengthOf(target);
    }
  }
  const unbroken = decrypting.targets.filter(
    (target) => valueAt(progress, target) < strengthOf(target)
  );
  const power =
    (agencyModifiersOf(decrypting.agency).decryption *
      itemAt(KEPT_BY_WAR, Number(decrypting.atWar), 1)) /
    Math.max(1, unbroken.length);
  const cracked: number[] = [];
  for (const target of unbroken) {
    progress[target] = valueAt(progress, target) + power;
    if (valueAt(progress, target) >= strengthOf(target)) {
      cracked.push(target);
    }
  }
  for (const enemy of decrypting.enemies) {
    if (
      valueAt(revealed, enemy) === 0 &&
      valueAt(progress, enemy) >= strengthOf(enemy)
    ) {
      revealed[enemy] = REVEAL_DAYS;
    }
  }
  return { ciphers: { progress, revealed }, cracked };
};

/**
 * The ciphers with `share` of `target`'s strength put into breaking it, as
 * an operation to capture a cipher does.
 */
export const cipherCaptured = (
  ciphers: Ciphers,
  target: number,
  targetAgency: Agency,
  share: number
): Ciphers => {
  const progress = Float64Array.from(ciphers.progress);
  progress[target] =
    valueAt(progress, target) + share * cipherStrengthOf(targetAgency);
  return { ...ciphers, progress };
};
