import { Schema } from "effect";
import { AgencyProjectSchema } from "./agency";
import { AirframeModelsSchema } from "./aircraft";
import { DivisionKindSchema } from "./divisions";
import { FocusIdSchema } from "./focus";
import { MOST_INFRASTRUCTURE } from "./geography/infrastructure";
import { ShipDesignsSchema } from "./ships";
import { TECH_IDS, TechIdSchema } from "./techs";

/**
 * The most nations and the most options one consultation names. They bound
 * the body the server decodes, and sit above what a generated world holds.
 */
const MOST_NATIONS = 32;
const MOST_OPTIONS = 16;

/**
 * The most technologies a research question offers. A slot is offered the
 * leader of every line and each technology it rules out, which ran to 17 on
 * the first day of a generated world, and never more than the tree holds.
 */
const MOST_TECHS = TECH_IDS.length;

/** The most options any one question offers, with the choice of none. */
const MOST_WEIGHTS = Math.max(MOST_OPTIONS, MOST_TECHS) + 1;

/** The most research slots a nation can have, which the focus tree stays under. */
const MOST_SLOTS = 8;

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

/**
 * What a government believes other nations' forces come to: the sum of what
 * its intelligence lets it see, the widest error in that sum, and how many
 * nations it has no figure for at all.
 */
const SightingSchema = Schema.Struct({
  estimate: Amount,
  margin: Share,
  unseen: Schema.Int.check(
    Schema.isBetween({ maximum: MOST_NATIONS, minimum: 0 })
  ),
});

/** A nation `nation` could declare on, with what it believes the men its side has in the field come to. */
const RivalSchema = Schema.Struct({
  nation: NationId,
  strength: SightingSchema,
});

/** A nation `nation` could send its operatives to, with how much it already knows of it on average. */
const SpyTargetSchema = Schema.Struct({ known: Share, nation: NationId });

/** A ceiling on the province ids the server accepts, above what the province lattices can produce. */
const MOST_PROVINCES = 4096;

const ProvinceId = Schema.Int.check(
  Schema.isBetween({ maximum: MOST_PROVINCES - 1, minimum: 0 })
);

/** A province `nation` could build its factories in, and what it offers there. */
const BuildSiteSchema = Schema.Struct({
  coastal: Schema.Boolean,
  /** The building slots it still has free, under a ceiling above what research and focuses can reach. */
  free: Schema.Int.check(Schema.isBetween({ maximum: 64, minimum: 1 })),
  infrastructure: Schema.Int.check(
    Schema.isBetween({ maximum: MOST_INFRASTRUCTURE, minimum: 0 })
  ),
  province: ProvinceId,
});

export type BuildSite = typeof BuildSiteSchema.Type;

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
  /** What its agency may put its next month into, empty while it is busy. */
  agencyProjects: Schema.Array(AgencyProjectSchema).check(
    Schema.isMaxLength(MOST_OPTIONS)
  ),
  atWar: Schema.Boolean,
  /** Provinces it may build its factories in, the fastest first, empty where it has no free slot. */
  buildSites: Schema.Array(BuildSiteSchema).check(
    Schema.isMaxLength(MOST_OPTIONS)
  ),
  civilianFactories: Amount,
  /** Convoys it has afloat. */
  convoys: Amount,
  /** The kinds of division its research lets it raise. */
  divisionKinds: Schema.Array(DivisionKindSchema).check(
    Schema.isMaxLength(MOST_OPTIONS)
  ),
  /** Dockyards it builds ships and convoys in, none for a nation without a port. */
  dockyards: Amount,
  /** What it believes every nation it is fighting has at sea. */
  enemyFleet: SightingSchema,
  /** What it believes the planes every nation it is fighting has come to. */
  enemyPlanes: SightingSchema,
  /** What it believes the men everyone the nation is fighting has in the field come to. */
  enemyStrength: SightingSchema,
  equipment: Amount,
  /** Factions it may join, empty unless it is independent and unaligned. */
  factions: Schema.Array(FactionOptionSchema).check(
    Schema.isMaxLength(MOST_OPTIONS)
  ),
  /** What its warships count for at sea. */
  fleet: Amount,
  /** National focuses it may pick, empty while it pursues one. */
  focuses: Schema.Array(FocusIdSchema).check(Schema.isMaxLength(MOST_OPTIONS)),
  /** Research slots with nothing on them. */
  freeSlots: Schema.Int.check(
    Schema.isBetween({ maximum: MOST_SLOTS, minimum: 0 })
  ),
  /** The share of what it can store that its fuel stockpile holds. */
  fuel: Share,
  /** Nations it may start justifying a war goal on, empty unless it may justify one. */
  justifiable: Schema.Array(RivalSchema).check(
    Schema.isMaxLength(MOST_OPTIONS)
  ),
  manpower: Amount,
  militaryFactories: Amount,
  nation: NationId,
  /** The operatives its agency has. */
  operatives: Amount,
  /** The design its factories build for each kind of plane. */
  planeModels: AirframeModelsSchema,
  /** The planes it has. */
  planes: Amount,
  population: Amount,
  /** Whether its operatives are posted in another nation rather than kept at home. */
  posted: Schema.Boolean,
  /** Nations it may declare on, empty unless it holds a justified war goal. */
  rivals: Schema.Array(RivalSchema).check(Schema.isMaxLength(MOST_OPTIONS)),
  /** The design its dockyards lay down for each class of warship. */
  shipDesigns: ShipDesignsSchema,
  /** The share of its arms output lost to the resources it goes without. */
  shortage: Share,
  /** The share of the skies its side and its enemies both fly over where the enemies hold air superiority. */
  skyLost: Share,
  /** Nations it may send its operatives to. */
  spyTargets: Schema.Array(SpyTargetSchema).check(
    Schema.isMaxLength(MOST_OPTIONS)
  ),
  /** The men its own side has in the field. */
  strength: Amount,
  /** Technologies a free slot may start on, empty when no slot is free. */
  techs: Schema.Array(TechIdSchema).check(Schema.isMaxLength(MOST_TECHS)),
  /** How close the whole world stands to war. */
  tension: Share,
  /** The share of its divisions that get less supply than they need. */
  undersupplied: Share,
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
  | "justify"
  | "faction"
  | "research"
  | "focus"
  | "trade"
  | "shipbuilding"
  | "aircraft"
  | "aviation"
  | "division-kind"
  | "build-site"
  | "agency"
  | "espionage"
  | "terms";

const QUESTIONS: readonly Question[] = [
  "conscription",
  "plan",
  "stance",
  "war",
  "justify",
  "faction",
  "research",
  "focus",
  "trade",
  "shipbuilding",
  "aircraft",
  "aviation",
  "division-kind",
  "build-site",
  "agency",
  "espionage",
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
  weights: Schema.Array(WeightSchema).check(Schema.isMaxLength(MOST_WEIGHTS)),
});

export type Verdict = typeof VerdictSchema.Type;

/**
 * What a consultation came back with. An answered reply names the governments
 * it carries no answer for, which the rules decide.
 */
const JevReplySchema = Schema.Union([
  Schema.TaggedStruct("answered", {
    unanswered: Schema.Array(NationId).check(Schema.isMaxLength(MOST_NATIONS)),
    verdicts: Schema.Array(VerdictSchema),
  }),
  Schema.TaggedStruct("unavailable", {}),
  Schema.TaggedStruct("rate-limited", {}),
  /** Not sent, because the council before it is still waiting on Jev. */
  Schema.TaggedStruct("busy", {}),
]);

export type JevReply = typeof JevReplySchema.Type;

/** The choice that picks none of a question's options. */
export const NO_CHOICE = "none";

/** The choice id that names declaring on `nation`. */
export const rivalChoice = (nation: number): string => `n${nation}`;

/** The choice id that names justifying a war goal on `nation`. */
export const justifyChoice = (nation: number): string => `j${nation}`;

/** The choice id that names sending the operatives to `nation`. */
export const spyChoice = (nation: number): string => `s${nation}`;

/** The choice that keeps the operatives at home on counter-intelligence. */
export const COUNTER_INTELLIGENCE_CHOICE = "home";

/** The choice id that names building factories in `province`. */
export const siteChoice = (province: number): string => `p${province}`;

/** The choice id that names joining `faction`. */
export const factionChoice = (faction: number): string => `f${faction}`;
