import { describe, expect, it } from "vite-plus/test";
import type { Agency } from "./agency";
import { NO_AGENCY } from "./agency";
import type { Ciphers, Decrypting } from "./cipher";
import {
  cipherCaptured,
  cipherStrengthOf,
  decryptedOneDay,
  decrypts,
  noCiphers,
} from "./cipher";

/** A founded agency with a cryptology department, decrypting 25 a day. */
const CODEBREAKERS: Agency = {
  ...NO_AGENCY,
  standing: "founded",
  upgrades: ["cryptology-department"],
};

/** Three nations' ciphers, each taking 12,000 to break. */
const STRENGTHS = [12_000, 12_000, 12_000];

/** The ciphers of three nations at `progress`, with `revealed` days of reveal left. */
const ciphersAt = (
  progress: readonly number[],
  revealed: readonly number[]
): Ciphers => ({
  progress: Float64Array.from(progress),
  revealed: Uint8Array.from(revealed),
});

/** A day of the codebreakers' work at peace against nations 1 and 2, with whatever a test needs changed. */
const decrypting = (patch: Partial<Decrypting>): Decrypting => ({
  agency: CODEBREAKERS,
  atWar: false,
  enemies: [],
  strengths: STRENGTHS,
  targets: [1, 2],
  ...patch,
});

describe(noCiphers, () => {
  it("should hold no progress and no reveal when a nation has put nothing in", () => {
    expect(noCiphers(2)).toStrictEqual(ciphersAt([0, 0], [0, 0]));
  });
});

describe(cipherStrengthOf, () => {
  it("should take the base strength when the owner has no cryptology", () => {
    expect(cipherStrengthOf(NO_AGENCY)).toBe(12_000);
  });

  it("should add to the strength for each level when the owner has cryptology", () => {
    expect(cipherStrengthOf(CODEBREAKERS)).toBe(16_250);
  });
});

describe(decrypts, () => {
  it("should decrypt when the agency has a cryptology department", () => {
    expect(decrypts(CODEBREAKERS)).toBeTruthy();
  });

  it("should not decrypt when the agency has no cryptology department", () => {
    expect(decrypts(NO_AGENCY)).toBeFalsy();
  });
});

describe(decryptedOneDay, () => {
  it("should split half its decryption over its targets when the nation is at peace", () => {
    expect(
      decryptedOneDay(ciphersAt([0, 0, 0], [0, 0, 0]), decrypting({}))
    ).toStrictEqual({
      ciphers: ciphersAt([0, 6.25, 6.25], [0, 0, 0]),
      cracked: [],
    });
  });

  it("should put all its decryption into the one unbroken cipher when the other target is already broken", () => {
    expect(
      decryptedOneDay(
        ciphersAt([0, 0, 12_000], [0, 0, 0]),
        decrypting({ atWar: true })
      )
    ).toStrictEqual({
      ciphers: ciphersAt([0, 25, 12_000], [0, 0, 0]),
      cracked: [],
    });
  });

  it("should crack a cipher and reveal it when the day's decryption breaks an enemy's cipher", () => {
    expect(
      decryptedOneDay(
        ciphersAt([0, 11_990, 0], [0, 0, 0]),
        decrypting({ atWar: true, enemies: [1], targets: [1] })
      )
    ).toStrictEqual({
      ciphers: ciphersAt([0, 12_015, 0], [0, 30, 0]),
      cracked: [1],
    });
  });

  it("should take a day off a running reveal without starting another when the enemy's cipher stays broken", () => {
    expect(
      decryptedOneDay(
        ciphersAt([0, 12_000, 0], [0, 5, 0]),
        decrypting({ enemies: [1] })
      )
    ).toStrictEqual({
      ciphers: ciphersAt([0, 12_000, 12.5], [0, 4, 0]),
      cracked: [],
    });
  });

  it("should put the progress back to half the strength when a reveal has its last day", () => {
    expect(
      decryptedOneDay(
        ciphersAt([0, 12_000, 0], [0, 1, 0]),
        decrypting({ agency: NO_AGENCY, enemies: [1], targets: [] })
      )
    ).toStrictEqual({
      ciphers: ciphersAt([0, 6000, 0], [0, 0, 0]),
      cracked: [],
    });
  });

  it("should still reveal an enemy's broken cipher when the agency has no cryptology department", () => {
    expect(
      decryptedOneDay(
        ciphersAt([0, 12_000, 0], [0, 0, 0]),
        decrypting({ agency: NO_AGENCY, enemies: [1], targets: [] })
      )
    ).toStrictEqual({
      ciphers: ciphersAt([0, 12_000, 0], [0, 30, 0]),
      cracked: [],
    });
  });
});

describe(cipherCaptured, () => {
  it("should put the share of the target's strength into its cipher when a cipher is captured", () => {
    expect(
      cipherCaptured(ciphersAt([0, 100], [0, 3]), 1, CODEBREAKERS, 0.5)
    ).toStrictEqual(ciphersAt([0, 8225], [0, 3]));
  });
});
