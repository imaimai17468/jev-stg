/** How readily a nation's army crosses the line to attack. */
export type Stance = "offensive" | "balanced" | "defensive";

/** Every stance, from the boldest to the most cautious. */
export const STANCES: readonly Stance[] = [
  "offensive",
  "balanced",
  "defensive",
];

/** The stance every nation opens under. */
export const START_STANCE: Stance = "balanced";

/**
 * How much stronger than the defence an attack has to be before a stack on the
 * line sends it, the defence counted with the ground it holds.
 */
const ATTACK_ODDS = {
  balanced: 1.5,
  defensive: 3,
  offensive: 1.1,
} satisfies Readonly<Record<Stance, number>>;

export const attackOddsFor = (stance: Stance): number => ATTACK_ODDS[stance];
