const MODULUS = 2_147_483_647;
const MULTIPLIER = 48_271;
const X_STRIDE = 374_761_393;
const Y_STRIDE = 668_265_263;
/**
 * The seed folded into one Lehmer step.
 *
 * Multiplying the seed by a stride the way the coordinates are multiplied would
 * overflow 2^53 for a seed of any size, so the seed is reduced to the modulus
 * and spread by one step instead. Every seed the URL can carry then reaches a
 * different terrain, where taking the seed modulo a smaller span would have let
 * two addresses draw the same continents.
 */
const seedTerm = (seed: number): number =>
  ((seed % MODULUS) * MULTIPLIER) % MODULUS;

/**
 * A value in (0, 1) that depends on the three integers and nothing else.
 *
 * The strides spread the coordinates across the modulus and the two Lehmer
 * steps that follow break the straight line they would otherwise lie on, which
 * is what keeps the noise from showing the lattice it is sampled from. Every
 * product stays under 2^53, so this needs no bitwise mixing.
 */
const hashUnit = (x: number, y: number, seed: number): number => {
  const base = (x * X_STRIDE + y * Y_STRIDE + seedTerm(seed)) % MODULUS;
  const once = ((base + MODULUS) * MULTIPLIER) % MODULUS;
  return ((once * MULTIPLIER) % MODULUS) / MODULUS;
};

/** Smoothstep, so the lattice cells meet with no visible seam. */
const fade = (t: number): number => t * t * (3 - 2 * t);

const mix = (from: number, to: number, at: number): number =>
  from + (to - from) * at;

/** Smoothed value noise at a point, in (0, 1). */
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
 * in (0, 1).
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
