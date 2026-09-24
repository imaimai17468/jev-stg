import { Schema } from "effect";
import { itemAt } from "../lookup";
import type { Random } from "../random";

/**
 * What a nation put its interwar years into, which decides the forces and
 * the technologies it opens the world with. Hearts of Iron IV gives each
 * nation its own historical start, so these leanings are this game's own.
 */
const LeaningSchema = Schema.Literals(["army", "navy", "industry"]);

export type Leaning = typeof LeaningSchema.Type;

const LEANINGS = LeaningSchema.literals;

/** One leaning drawn from `random`, each as likely as the others. */
export const drawnLeaning = (random: Random): Leaning =>
  itemAt(LEANINGS, random.below(LEANINGS.length), "army");
