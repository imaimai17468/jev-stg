import { Option, Schema } from "effect";
import type { IntelKind } from "./intel";
import type { TechCategory } from "./techs";
import type { UnrestKind } from "./unrest";

/** Every operation an agency runs, in the order the rules weigh them. */
const OperationSchema = Schema.Literals([
  "rescue-operative",
  "infiltrate-civilian",
  "infiltrate-army",
  "infiltrate-navy",
  "infiltrate-air",
  "resistance-contacts",
  "sabotage-industry",
  "strengthen-resistance",
  "capture-cipher",
  "steal-military-blueprints",
  "steal-industrial-blueprints",
]);

export type Operation = typeof OperationSchema.Type;

const OPERATIONS = OperationSchema.literals;

/** What one operation takes. */
interface OperationTerms {
  /** The operatives it ties up until it is done. */
  readonly operatives: number;
  /** The network strength it needs where it runs. */
  readonly network: number;
  /** The chance each of its operatives is caught when it ends, before the target's counter-intelligence. */
  readonly risk: number;
  readonly days: number;
}

/** Hearts of Iron IV's operations: their operatives, network strength, risk, and days. */
const TERMS = {
  "capture-cipher": { days: 75, network: 40, operatives: 2, risk: 0.2 },
  "infiltrate-air": { days: 75, network: 50, operatives: 2, risk: 0.1 },
  "infiltrate-army": { days: 75, network: 50, operatives: 2, risk: 0.1 },
  "infiltrate-civilian": { days: 90, network: 35, operatives: 2, risk: 0.1 },
  "infiltrate-navy": { days: 75, network: 50, operatives: 2, risk: 0.1 },
  "rescue-operative": { days: 35, network: 30, operatives: 1, risk: 0.1 },
  "resistance-contacts": { days: 60, network: 40, operatives: 2, risk: 0.1 },
  "sabotage-industry": { days: 90, network: 35, operatives: 3, risk: 0.2 },
  "steal-industrial-blueprints": {
    days: 120,
    network: 35,
    operatives: 3,
    risk: 0.2,
  },
  "steal-military-blueprints": {
    days: 120,
    network: 50,
    operatives: 3,
    risk: 0.2,
  },
  "strengthen-resistance": { days: 50, network: 35, operatives: 2, risk: 0.2 },
} satisfies Readonly<Record<Operation, OperationTerms>>;

export const operationTermsOf = (operation: Operation): OperationTerms =>
  TERMS[operation];

/** The operations that steal a blueprint. */
const BlueprintTheftSchema = Schema.Literals([
  "steal-military-blueprints",
  "steal-industrial-blueprints",
]);

export type BlueprintTheft = typeof BlueprintTheftSchema.Type;

export const BLUEPRINT_THEFTS = BlueprintTheftSchema.literals;

/**
 * The research categories each stolen blueprint speeds up, after Hearts of
 * Iron IV: the military one infantry, support, artillery and armour, of which
 * this world researches infantry alone, and the industrial one electronics
 * and industry.
 */
export const BLUEPRINT_CATEGORIES = {
  "steal-industrial-blueprints": ["industry", "electronics"],
  "steal-military-blueprints": ["infantry"],
} satisfies Readonly<Record<BlueprintTheft, readonly TechCategory[]>>;

/** What a nation's operatives in a target find there, which decides the operations open to them. */
export interface Prospect {
  /** How many of the nation's operatives the target holds captive. */
  readonly captives: number;
  /** Whether the nation's agency has a slot free for an operative brought back. */
  readonly room: boolean;
  /** The kinds the nation has already infiltrated in the target. */
  readonly infiltrated: ReadonlySet<IntelKind>;
  /** Whether the target holds a coast, which a navy to infiltrate needs. */
  readonly coastal: boolean;
  /** Whether the nation's agency has a cryptology department and it has researched computing. */
  readonly codebreakers: boolean;
  /** Whether it has already broken the target's cipher. */
  readonly cipherBroken: boolean;
  /** Whether the target holds ground it occupies, where a resistance can rise. */
  readonly occupies: boolean;
  /** The resistance work the nation already has running against the target. */
  readonly unrest: ReadonlySet<UnrestKind>;
  /** Whether the nation is at war, which puts the army's blueprints before industry's. */
  readonly atWar: boolean;
  /** The blueprints whose bonuses the nation's research would use now: none waiting unused for their categories, and a technology left in them for each. */
  readonly usableBlueprints: ReadonlySet<BlueprintTheft>;
  /** The operations the nation already has under way in the target, which it does not start again. */
  readonly underway: ReadonlySet<Operation>;
}

/** Whether `operation` can be run against the target `prospect` describes. */
const OPEN = {
  "capture-cipher": (prospect: Prospect) =>
    prospect.codebreakers && !prospect.cipherBroken,
  "infiltrate-air": (prospect: Prospect) => !prospect.infiltrated.has("air"),
  "infiltrate-army": (prospect: Prospect) => !prospect.infiltrated.has("army"),
  "infiltrate-civilian": (prospect: Prospect) =>
    !prospect.infiltrated.has("civilian"),
  "infiltrate-navy": (prospect: Prospect) =>
    prospect.coastal && !prospect.infiltrated.has("navy"),
  "rescue-operative": (prospect: Prospect) =>
    prospect.captives > 0 && prospect.room,
  "resistance-contacts": (prospect: Prospect) =>
    prospect.occupies && !prospect.unrest.has("contacts"),
  "sabotage-industry": (prospect: Prospect) =>
    prospect.unrest.has("contacts") && !prospect.unrest.has("sabotage"),
  "steal-industrial-blueprints": (prospect: Prospect) =>
    prospect.infiltrated.has("civilian") &&
    !prospect.atWar &&
    prospect.usableBlueprints.has("steal-industrial-blueprints"),
  "steal-military-blueprints": (prospect: Prospect) =>
    prospect.infiltrated.has("army") &&
    prospect.atWar &&
    prospect.usableBlueprints.has("steal-military-blueprints"),
  "strengthen-resistance": (prospect: Prospect) =>
    prospect.unrest.has("contacts") && !prospect.unrest.has("strengthened"),
} satisfies Readonly<Record<Operation, (prospect: Prospect) => boolean>>;

/** The operatives a nation has for its operations in a target. */
export interface Crew {
  /** The ones free of missions today. */
  readonly free: number;
  /** All of them, the ones on a mission included, which is the most an operation can ever take. */
  readonly fielded: number;
}

/**
 * The operation the rules start against the target today. They weigh the
 * operations in order and settle on the first that is not already under way
 * there, that the target leaves open, that the network where they work is
 * strong enough for, and that all the nation's operatives together are
 * enough for; they start it where the free ones already are, and otherwise
 * start nothing and wait for the others to come back from their missions,
 * so an operation that needs more hands is not kept waiting by smaller ones
 * forever. Rescuing an operative comes first and infiltrating before anything
 * that needs an infiltration in; sabotage, which takes three operatives,
 * comes before the resistance and cipher work that take two, and ends once
 * it is running, so it holds the third operative back only until it starts;
 * the blueprints, which a nation can steal again and again, come last, so
 * they take the operatives only when nothing else is open; the army's
 * blueprints are stolen at war and industry's at peace. The order and the
 * waiting are this game's own.
 */
export const operationWanted = (
  prospect: Prospect,
  crew: Crew,
  strength: number
): Option.Option<Operation> =>
  Option.fromUndefinedOr(
    OPERATIONS.find(
      (operation) =>
        !prospect.underway.has(operation) &&
        OPEN[operation](prospect) &&
        TERMS[operation].operatives <= crew.fielded &&
        TERMS[operation].network <= strength
    )
  ).pipe(
    Option.filter((operation) => TERMS[operation].operatives <= crew.free)
  );
