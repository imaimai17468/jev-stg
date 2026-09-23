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

/**
 * The items in a new order the seed decides.
 *
 * Each draw takes one item out of the pool rather than swapping two positions,
 * so the shuffle reads no index back and needs no stand-in for an element the
 * list might not hold.
 */
export const shuffled = <T>(
  items: readonly T[],
  random: Random
): readonly T[] => {
  const pool = [...items];
  const order: T[] = [];
  while (pool.length > 0) {
    order.push(...pool.splice(random.below(pool.length), 1));
  }
  return order;
};

/**
 * How far apart two consecutive streams' seeds sit. Stepping the generator's
 * state by this much moves its first draw by 0.618 of the unit interval, the
 * golden ratio's turn, which keeps a run of consecutive streams spread over
 * the interval instead of opening on draws a hair apart as consecutive seeds
 * do.
 */
const STREAM_STRIDE = 1_727_276_829;

/** A seed for one stream of draws out of `seed`, such as one day's. */
export const streamSeed = (seed: number, stream: number): number =>
  (Math.floor(Math.abs(seed)) + stream * STREAM_STRIDE) % (MODULUS - 1);
