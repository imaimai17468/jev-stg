import { Schema } from "effect";

/**
 * The most nations and the most options one consultation names. They bound
 * the body the server decodes, and sit above what a generated world holds.
 */
const MOST_NATIONS = 32;
const MOST_OPTIONS = 16;

const NationId = Schema.Int.check(
  Schema.isBetween({ maximum: MOST_NATIONS - 1, minimum: 0 })
);

const Amount = Schema.Finite.check(
  Schema.isBetween({ maximum: 1e12, minimum: 0 })
);

const Share = Schema.Finite.check(Schema.isBetween({ maximum: 1, minimum: 0 }));

/**
 * A day in the world's calendar, written the way the clock bar writes it. The
 * shape admits digits alone, so no text the browser chose reaches the model
 * through it.
 */
const GameDay = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/u));

/** A nation `nation` could declare on, with the men its side has in the field. */
const RivalSchema = Schema.Struct({ nation: NationId, strength: Amount });

/** A faction `nation` could join, with the men it has in the field. */
const FactionOptionSchema = Schema.Struct({
  faction: NationId,
  strength: Amount,
});

/**
 * What one nation's government sees at the start of a month, every field a
 * number or one of the ids the world defines, so the server writes the
 * questions from values it checked rather than from text the browser sent.
 */
const NationBriefSchema = Schema.Struct({
  atWar: Schema.Boolean,
  civilianFactories: Amount,
  /** The men everyone the nation is fighting has in the field. */
  enemyStrength: Amount,
  equipment: Amount,
  /** Factions it may join, empty unless it is independent and unaligned. */
  factions: Schema.Array(FactionOptionSchema).check(
    Schema.isMaxLength(MOST_OPTIONS)
  ),
  manpower: Amount,
  militaryFactories: Amount,
  nation: NationId,
  population: Amount,
  /** Nations it may declare on, empty unless it is independent and at peace. */
  rivals: Schema.Array(RivalSchema).check(Schema.isMaxLength(MOST_OPTIONS)),
  /** The men its own side has in the field. */
  strength: Amount,
});

export type NationBrief = typeof NationBriefSchema.Type;

/** Every government's brief on the first of a month. */
const CouncilSchema = Schema.TaggedStruct("council", {
  date: GameDay,
  nations: Schema.Array(NationBriefSchema).check(
    Schema.isMaxLength(MOST_NATIONS)
  ),
});

export type Council = typeof CouncilSchema.Type;

/** A nation that has surrendered, and the victor that dictates its peace. */
const PeaceTalksSchema = Schema.TaggedStruct("peace", {
  date: GameDay,
  loser: NationId,
  /** The share of the loser's homeland the loser still holds. */
  loserHeld: Share,
  victor: NationId,
  /** The share of the loser's homeland the victor's bloc holds. */
  victorHeld: Share,
});

export type PeaceTalks = typeof PeaceTalksSchema.Type;

/** What the browser asks Jev about. */
export const ConsultationSchema = Schema.Union([
  CouncilSchema,
  PeaceTalksSchema,
]);

export type Consultation = typeof ConsultationSchema.Type;

/** What Jev is asked about one nation. */
export type Question =
  | "conscription"
  | "plan"
  | "stance"
  | "war"
  | "faction"
  | "terms";

const QUESTIONS: readonly Question[] = [
  "conscription",
  "plan",
  "stance",
  "war",
  "faction",
  "terms",
];

/**
 * Jev's pick for one question about one nation, how sure it was of it, and
 * the weight it put on every option.
 */
const ChoiceId = Schema.String.check(Schema.isMaxLength(32));

/** One option of a question and the weight Jev put on it. */
const WeightSchema = Schema.Struct({ choice: ChoiceId, probability: Share });

export type Weight = typeof WeightSchema.Type;

const VerdictSchema = Schema.Struct({
  choice: ChoiceId,
  nation: NationId,
  probability: Share,
  question: Schema.Literals(QUESTIONS),
  /** Every option the question offered, in the order it offered them. */
  weights: Schema.Array(WeightSchema).check(
    Schema.isMaxLength(MOST_OPTIONS + 1)
  ),
});

export type Verdict = typeof VerdictSchema.Type;

/** What a consultation came back with. */
const JevReplySchema = Schema.Union([
  Schema.TaggedStruct("answered", {
    verdicts: Schema.Array(VerdictSchema),
  }),
  Schema.TaggedStruct("unavailable", {}),
  Schema.TaggedStruct("rate-limited", {}),
]);

export type JevReply = typeof JevReplySchema.Type;

/** The choice that picks none of a question's options. */
export const NO_CHOICE = "none";

/** The choice id that names declaring on `nation`. */
export const rivalChoice = (nation: number): string => `n${nation}`;

/** The choice id that names joining `faction`. */
export const factionChoice = (faction: number): string => `f${faction}`;
