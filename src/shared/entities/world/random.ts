/**
 * A deterministic source of numbers.
 *
 * The seed is the only thing deciding what a world looks like, so every draw
 * goes through one of these rather than through `Math.random`, and the same
 * seed redraws the same world on any machine.
 */
export interface Random {
  /** The next value in (0, 1). */
  readonly unit: () => number;
  /** The next integer in [0, bound). */
  readonly below: (bound: number) => number;
}

/**
 * The Lehmer generator's modulus and multiplier (MINSTD).
 *
 * Every product below stays under 2^53, so the sequence is exact in doubles and
 * needs none of the bitwise mixing a 32-bit generator would.
 */
const MODULUS = 2_147_483_647;
const MULTIPLIER = 48_271;

export const randomFromSeed = (seed: number): Random => {
  // The generator has a fixed point at 0, so the state starts in [1, MODULUS).
  let state = (Math.floor(Math.abs(seed)) % (MODULUS - 1)) + 1;
  const unit = (): number => {
    state = (state * MULTIPLIER) % MODULUS;
    return state / MODULUS;
  };
  return {
    below: (bound: number): number => Math.floor(unit() * bound),
    unit,
  };
};
