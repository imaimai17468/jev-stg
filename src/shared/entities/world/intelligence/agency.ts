import { Option, Schema } from "effect";
import { itemAt } from "../lookup";
import type { TechId } from "../techs";

/** Every upgrade an intelligence agency can buy, in the order its screen lists them. */
const AgencyUpgradeSchema = Schema.Literals([
  "civilian-department",
  "army-department",
  "navy-department",
  "air-department",
  "passive-defense",
  "blueprint-stealing",
  "invisible-ink",
  "plastic-explosives",
  "interrogation-techniques",
  "cryptology-department",
  "radio-interception",
  "machine-decryption",
  "cypher-school",
  "machine-encryption",
]);

export type AgencyUpgrade = typeof AgencyUpgradeSchema.Type;

export const AGENCY_UPGRADES = AgencyUpgradeSchema.literals;

/** What a nation puts its agency's next month into: founding it, or one of its upgrades. */
export const AgencyProjectSchema = Schema.Literals([
  "found",
  ...AGENCY_UPGRADES,
]);

export type AgencyProject = typeof AgencyProjectSchema.Type;

/**
 * How much better a nation's agency makes it at each part of the work, as a
 * share on top of what it would do without, except where a field says it
 * counts points or levels.
 */
export interface AgencyModifiers {
  /** The intelligence it gathers on the economies of other nations. */
  readonly civilianIntel: number;
  readonly armyIntel: number;
  readonly navyIntel: number;
  readonly airIntel: number;
  /** Points of counter-intelligence, which make an enemy operative likelier to be caught. */
  readonly counterIntelligence: number;
  /** What a stolen blueprint adds to research. */
  readonly blueprints: number;
  /** The intelligence its operatives and infiltrated assets gather. */
  readonly assets: number;
  /** The risk of an operation to steal blueprints, which is negative where it falls. */
  readonly blueprintRisk: number;
  /** What an operation to strengthen or arm a resistance does. */
  readonly resistance: number;
  /** The chance of catching an enemy operative. */
  readonly capture: number;
  /** The intelligence a captured enemy operative gives up. */
  readonly extraction: number;
  /** Points of decryption a day. */
  readonly decryption: number;
  /** Levels of cryptology, which make its cipher harder to break. */
  readonly cryptology: number;
}

/** What one level of an upgrade adds, naming only what it changes. */
type AgencyGain = Partial<AgencyModifiers>;

const NO_GAIN: AgencyGain = {};

export const NO_AGENCY_MODIFIERS: AgencyModifiers = {
  airIntel: 0,
  armyIntel: 0,
  assets: 0,
  blueprintRisk: 0,
  blueprints: 0,
  capture: 0,
  civilianIntel: 0,
  counterIntelligence: 0,
  cryptology: 0,
  decryption: 0,
  extraction: 0,
  navyIntel: 0,
  resistance: 0,
};

/** One upgrade: what each of its levels adds, what it costs, and what it waits on. */
interface UpgradeTerms {
  readonly name: string;
  /** The civilian factories it ties up for the days it takes. */
  readonly factories: number;
  /** What each level adds, the first level first. */
  readonly levels: readonly AgencyGain[];
  /** Upgrades that have to be bought before this one. */
  readonly requires: readonly AgencyUpgrade[];
  /** Technologies that have to be researched before this one. */
  readonly techs: readonly TechId[];
}

/**
 * Hearts of Iron IV's agency upgrades. The cryptology upgrades waiting on the
 * cryptology department is this game's own reading, since the wiki's table
 * lists the branch without naming what unlocks it.
 */
const UPGRADES = {
  "air-department": {
    factories: 5,
    levels: [{ airIntel: 0.25 }],
    name: "空軍部",
    requires: [],
    techs: [],
  },
  "army-department": {
    factories: 5,
    levels: [{ armyIntel: 0.25 }],
    name: "陸軍部",
    requires: [],
    techs: [],
  },
  "blueprint-stealing": {
    factories: 5,
    levels: [{ blueprints: 0.25 }],
    name: "設計図の窃取",
    requires: [],
    techs: [],
  },
  "civilian-department": {
    factories: 5,
    levels: [{ civilianIntel: 0.25 }],
    name: "経済部",
    requires: [],
    techs: [],
  },
  "cryptology-department": {
    factories: 8,
    levels: [{ cryptology: 1, decryption: 25 }],
    name: "暗号部",
    requires: [],
    techs: [],
  },
  "cypher-school": {
    factories: 5,
    levels: [{ cryptology: 1 }, { cryptology: 1 }, { cryptology: 1 }],
    name: "政府暗号学校",
    requires: ["cryptology-department"],
    techs: [],
  },
  "interrogation-techniques": {
    factories: 5,
    levels: [{ capture: 1, extraction: 0.25 }],
    name: "尋問技術",
    requires: [],
    techs: [],
  },
  "invisible-ink": {
    factories: 5,
    levels: [{ assets: 0.2, blueprintRisk: -0.25 }],
    name: "あぶり出しインク",
    requires: [],
    techs: [],
  },
  "machine-decryption": {
    factories: 10,
    levels: [{ decryption: 25 }, { decryption: 15 }, { decryption: 10 }],
    name: "機械による解読",
    requires: ["cryptology-department"],
    techs: ["mechanical-computing"],
  },
  "machine-encryption": {
    factories: 15,
    levels: [{ cryptology: 2 }, { cryptology: 2 }, { cryptology: 2 }],
    name: "機械による暗号化",
    requires: ["cryptology-department"],
    techs: [],
  },
  "navy-department": {
    factories: 5,
    levels: [{ navyIntel: 0.25 }],
    name: "海軍部",
    requires: [],
    techs: [],
  },
  "passive-defense": {
    factories: 5,
    levels: [
      { counterIntelligence: 1.5 },
      { counterIntelligence: 1.25 },
      { counterIntelligence: 1 },
      { counterIntelligence: 1 },
    ],
    name: "受動防御",
    requires: [],
    techs: [],
  },
  "plastic-explosives": {
    factories: 8,
    levels: [{ resistance: 0.25 }],
    name: "プラスチック爆薬",
    requires: [],
    techs: [],
  },
  "radio-interception": {
    factories: 5,
    levels: [{ decryption: 25 }, { decryption: 10 }],
    name: "無線傍受班",
    requires: ["cryptology-department"],
    techs: [],
  },
} satisfies Readonly<Record<AgencyUpgrade, UpgradeTerms>>;

export const upgradeTermsOf = (upgrade: AgencyUpgrade): UpgradeTerms =>
  UPGRADES[upgrade];

/**
 * The civilian factories founding an agency ties up, and the days founding it
 * or buying any upgrade takes, after Hearts of Iron IV.
 */
const FOUNDING_FACTORIES = 5;
export const AGENCY_DAYS = 30;

/** Whether a nation has an agency yet. */
export type AgencyStanding = "none" | "founded";

/** What an agency is working on. */
export type AgencyWork =
  | { readonly kind: "idle" }
  | {
      readonly kind: "working";
      readonly project: AgencyProject;
      readonly daysLeft: number;
    };

const IDLE: AgencyWork = { kind: "idle" };

/** A nation's intelligence agency. */
export interface Agency {
  readonly standing: AgencyStanding;
  readonly work: AgencyWork;
  /** Every level bought, an upgrade named once for each of its levels, in the order they were bought. */
  readonly upgrades: readonly AgencyUpgrade[];
}

/** The agency of a nation that has founded none. */
export const NO_AGENCY: Agency = { standing: "none", upgrades: [], work: IDLE };

/** The levels of `upgrade` the agency has bought. */
export const levelsOf = (agency: Agency, upgrade: AgencyUpgrade): number =>
  agency.upgrades.filter((bought) => bought === upgrade).length;

/** Whether `upgrade` is one the agency can buy now, with `researched` behind it. */
const mayBuy = (
  agency: Agency,
  upgrade: AgencyUpgrade,
  researched: ReadonlySet<TechId>
): boolean => {
  const terms = upgradeTermsOf(upgrade);
  return (
    levelsOf(agency, upgrade) < terms.levels.length &&
    terms.requires.every((needed) => levelsOf(agency, needed) > 0) &&
    terms.techs.every((tech) => researched.has(tech))
  );
};

/**
 * What the agency can put its next month into: founding itself where it has
 * not been founded, and otherwise every upgrade with a level left whose
 * prerequisites are in. An agency already at work takes nothing new.
 */
export const agencyOptions = (
  agency: Agency,
  researched: readonly TechId[]
): readonly AgencyProject[] => {
  if (agency.work.kind === "working") {
    return [];
  }
  if (agency.standing === "none") {
    return ["found"];
  }
  const finished = new Set(researched);
  return AGENCY_UPGRADES.filter((upgrade) => mayBuy(agency, upgrade, finished));
};

/** The agency set to work on `project`, or none where it is not on offer. */
export const agencyStarted = (
  agency: Agency,
  project: AgencyProject,
  researched: readonly TechId[]
): Option.Option<Agency> => {
  if (!agencyOptions(agency, researched).includes(project)) {
    return Option.none();
  }
  return Option.some({
    ...agency,
    work: { daysLeft: AGENCY_DAYS, kind: "working", project },
  });
};

/** The agency once the project it was working on is done. */
const finished = (agency: Agency, project: AgencyProject): Agency => {
  if (project === "found") {
    return { ...agency, standing: "founded", work: IDLE };
  }
  return { ...agency, upgrades: [...agency.upgrades, project], work: IDLE };
};

/** The agency one day on: a day off its project, and the project done where that was its last. */
export const agencyWorkedOneDay = (agency: Agency): Agency => {
  const { work } = agency;
  if (work.kind === "idle") {
    return agency;
  }
  if (work.daysLeft <= 1) {
    return finished(agency, work.project);
  }
  return { ...agency, work: { ...work, daysLeft: work.daysLeft - 1 } };
};

/** The civilian factories `project` ties up while the agency works on it. */
export const factoriesFor = (project: AgencyProject): number => {
  if (project === "found") {
    return FOUNDING_FACTORIES;
  }
  return upgradeTermsOf(project).factories;
};

/** The civilian factories the agency ties up today. */
export const factoriesTiedUp = (agency: Agency): number => {
  if (agency.work.kind === "idle") {
    return 0;
  }
  return factoriesFor(agency.work.project);
};

/** What `gain` adds to `modifier`, which is nothing where it names nothing. */
const pointOf = (gain: AgencyGain, modifier: keyof AgencyModifiers): number =>
  gain[modifier] ?? 0;

/** What every one of `gains` adds to `modifier` together. */
const totalOf = (
  gains: readonly AgencyGain[],
  modifier: keyof AgencyModifiers
): number => gains.reduce((sum, gain) => sum + pointOf(gain, modifier), 0);

/** What the level bought as the `level`th of `upgrade` adds. */
const gainOf = (upgrade: AgencyUpgrade, level: number): AgencyGain =>
  itemAt(upgradeTermsOf(upgrade).levels, level, NO_GAIN);

/**
 * Everything the agency's upgrades add together, each level of an upgrade
 * adding what that level adds.
 */
export const agencyModifiersOf = (agency: Agency): AgencyModifiers => {
  const counted = new Map<AgencyUpgrade, number>();
  const gains = agency.upgrades.map((upgrade) => {
    const level = counted.get(upgrade) ?? 0;
    counted.set(upgrade, level + 1);
    return gainOf(upgrade, level);
  });
  return {
    airIntel: totalOf(gains, "airIntel"),
    armyIntel: totalOf(gains, "armyIntel"),
    assets: totalOf(gains, "assets"),
    blueprintRisk: totalOf(gains, "blueprintRisk"),
    blueprints: totalOf(gains, "blueprints"),
    capture: totalOf(gains, "capture"),
    civilianIntel: totalOf(gains, "civilianIntel"),
    counterIntelligence: totalOf(gains, "counterIntelligence"),
    cryptology: totalOf(gains, "cryptology"),
    decryption: totalOf(gains, "decryption"),
    extraction: totalOf(gains, "extraction"),
    navyIntel: totalOf(gains, "navyIntel"),
    resistance: totalOf(gains, "resistance"),
  };
};
