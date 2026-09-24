/**
 * The three lanes a point is spread along before they are mixed.
 *
 * They are close together and share no factor, so the three lanes drift apart
 * along a line rather than advancing in step.
 */
const LANE_X = 0.1031;
const LANE_Y = 0.103;
const LANE_SEED = 0.0973;
/** Lifts each lane clear of zero before they are multiplied together. */
const LANE_LIFT = 33.33;

/** The part of a number below the decimal point, for a negative one too. */
const fract = (value: number): number => value - Math.floor(value);

/**
 * A value in [0, 1) that depends on the three integers and nothing else.
 *
 * Multiplying the three lanes by each other is what makes this non-linear.
 * A hash built only from `(x * A + y * B + seed * C) mod P` stays a linear
 * function of x and y however many times it is multiplied afterwards, and the
 * lattice that leaves shows up in the terrain as vertical striping.
 */
const hashUnit = (x: number, y: number, seed: number): number => {
  const alongX = fract(x * LANE_X);
  const alongY = fract(y * LANE_Y);
  const alongSeed = fract(seed * LANE_SEED);
  const mixed =
    alongX * (alongY + LANE_LIFT) +
    alongY * (alongSeed + LANE_LIFT) +
    alongSeed * (alongX + LANE_LIFT);
  return fract((alongX + mixed + (alongY + mixed)) * (alongSeed + mixed));
};

/** Smoothstep, so the lattice cells meet with no visible seam. */
const fade = (t: number): number => t * t * (3 - 2 * t);

const mix = (from: number, to: number, at: number): number =>
  from + (to - from) * at;

/** Smoothed value noise at a point, in [0, 1). */
export const valueNoise = (x: number, y: number, seed: number): number => {
  const latticeX = Math.floor(x);
  const latticeY = Math.floor(y);
  const alongX = fade(x - latticeX);
  const alongY = fade(y - latticeY);
  const top = mix(
    hashUnit(latticeX, latticeY, seed),
    hashUnit(latticeX + 1, latticeY, seed),
    alongX
  );
  const bottom = mix(
    hashUnit(latticeX, latticeY + 1, seed),
    hashUnit(latticeX + 1, latticeY + 1, seed),
    alongX
  );
  return mix(top, bottom, alongY);
};

/**
 * Value noise summed over `octaves`, each at twice the frequency and half the
 * weight of the one before, and divided by the total weight so the result stays
 * in [0, 1).
 */
export const fractalNoise = (
  x: number,
  y: number,
  seed: number,
  octaves: number
): number => {
  let total = 0;
  let weight = 0;
  for (let step = 0; step < octaves; step += 1) {
    const scale = 2 ** step;
    total += valueNoise(x * scale, y * scale, seed + step) / scale;
    weight += 1 / scale;
  }
  return total / weight;
};
