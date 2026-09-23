import type { World } from "./index";
import { industryByNation } from "./industry";
import { itemAt } from "./lookup";

/** How much of its people a nation may call up, set by its conscription law. */
export type ConscriptionLaw =
  | "volunteer"
  | "limited"
  | "extensive"
  | "service-by-requirement"
  | "all-adults";

/** The share of the population each law puts within a recruiter's reach. */
const MANPOWER_SHARE = {
  "all-adults": 0.2,
  extensive: 0.05,
  limited: 0.025,
  "service-by-requirement": 0.1,
  volunteer: 0.015,
} satisfies Readonly<Record<ConscriptionLaw, number>>;

/** Every conscription law, from the lightest to the heaviest. */
export const CONSCRIPTION_LAWS: readonly ConscriptionLaw[] = [
  "volunteer",
  "limited",
  "extensive",
  "service-by-requirement",
  "all-adults",
];

/** What a nation does with the industry it holds. */
export type IndustryPlan = "civilian" | "balanced" | "military" | "total-war";

/** Every industry plan, from peace to total war. */
export const INDUSTRY_PLANS: readonly IndustryPlan[] = [
  "civilian",
  "balanced",
  "military",
  "total-war",
];

/** The two shares a plan sets. */
interface Shares {
  /** The share of all the nation's factories it wants turning out equipment. */
  readonly military: number;
  /** The share of its civilian factories tied up making consumer goods. */
  readonly consumerGoods: number;
}

/**
 * What each plan asks of the nation's industry.
 *
 * A plan further along the list points more factories at weapons and frees more
 * of the rest for building, so switching plans both arms the nation and speeds
 * up everything it puts on a construction site.
 */
const PLAN_SHARES = {
  balanced: { consumerGoods: 0.25, military: 0.35 },
  civilian: { consumerGoods: 0.35, military: 0.15 },
  military: { consumerGoods: 0.15, military: 0.6 },
  "total-war": { consumerGoods: 0.05, military: 0.8 },
} satisfies Readonly<Record<IndustryPlan, Shares>>;

/** What a nation's economy holds on one day. */
export interface NationEconomy {
  readonly population: number;
  readonly conscription: ConscriptionLaw;
  /** The people the nation can still call up. */
  readonly manpower: number;
  /** Factories on construction sites, which is what raises both counts. */
  readonly civilianFactories: number;
  /** Factories turning out equipment. */
  readonly militaryFactories: number;
  /** Construction put into the factory now being built. */
  readonly construction: number;
  /** Equipment turned out and not yet drawn on. */
  readonly equipment: number;
  readonly plan: IndustryPlan;
}

/** How much a nation's population grows in a year. */
const POPULATION_GROWTH_PER_YEAR = 0.012;
const DAYS_PER_YEAR = 365.25;
const POPULATION_GROWTH_PER_DAY = POPULATION_GROWTH_PER_YEAR / DAYS_PER_YEAR;

/** How long a nation that spent its whole pool takes to fill it again. */
const MANPOWER_RECOVERY_YEARS = 5;
const MANPOWER_RECOVERY_PER_DAY = 1 / (MANPOWER_RECOVERY_YEARS * DAYS_PER_YEAR);

/** Equipment one military factory turns out in a day. */
const EQUIPMENT_PER_FACTORY = 5;

/** Construction one civilian factory puts in in a day. */
const CONSTRUCTION_PER_FACTORY = 5;

/**
 * What one new factory costs, in construction.
 *
 * Forty civilian factories under the civilian plan, which puts 35% of them on
 * consumer goods, finish one in eighty-three days, which is seven seconds at
 * the fastest speed and three minutes at the slowest.
 */
const FACTORY_COST = 10_800;

/** The economy of a nation the world does not hold. */
export const NO_ECONOMY: NationEconomy = {
  civilianFactories: 0,
  conscription: "volunteer",
  construction: 0,
  equipment: 0,
  manpower: 0,
  militaryFactories: 0,
  plan: "civilian",
  population: 0,
};

/** The law and the plan every nation opens 1936 under. */
const START_CONSCRIPTION: ConscriptionLaw = "volunteer";
const START_PLAN: IndustryPlan = "civilian";

const manpowerCap = (population: number, law: ConscriptionLaw): number =>
  population * MANPOWER_SHARE[law];

/**
 * The economy under `law`. The pool already called up stays where it is: a
 * heavier law raises the cap it recovers toward, and a lighter one lowers the
 * cap, which the next day's recovery holds the pool to.
 */
export const withConscription = (
  economy: NationEconomy,
  law: ConscriptionLaw
): NationEconomy => ({ ...economy, conscription: law });

/**
 * The economy under `plan`. The factories already built keep their kind, and
 * the plan decides what the ones finished from now on come out as.
 */
export const withPlan = (
  economy: NationEconomy,
  plan: IndustryPlan
): NationEconomy => ({ ...economy, plan });

/** How far along the factory now being built is, from 0 to 1. */
export const constructionProgress = (economy: NationEconomy): number =>
  economy.construction / FACTORY_COST;

/** What the nation's civilian factories put into construction in a day. */
const constructionPerDay = (economy: NationEconomy): number =>
  economy.civilianFactories *
  (1 - PLAN_SHARES[economy.plan].consumerGoods) *
  CONSTRUCTION_PER_FACTORY;

/**
 * The pool one day of population growth and recovery leaves.
 *
 * The pool is capped by what the conscription law reaches, so a nation that has
 * not spent any of it still gains what the year's births add to the cap.
 */
const recoveredManpower = (economy: NationEconomy, population: number) => {
  const cap = manpowerCap(population, economy.conscription);
  return Math.min(cap, economy.manpower + cap * MANPOWER_RECOVERY_PER_DAY);
};

/** How the factories finished today divide between the two kinds. */
interface Built {
  readonly civilian: number;
  readonly military: number;
}

/**
 * Which kind the factories finished today come out as.
 *
 * A nation builds toward the split its plan asks for, so a nation that has just
 * taken a war plan puts everything it finishes into weapons until the split is
 * met and then goes back to building.
 */
const splitBuilt = (economy: NationEconomy, built: number): Built => {
  const factories = economy.civilianFactories + economy.militaryFactories;
  // A nation holding no factories at all would divide by zero, and it builds
  // nothing in any case, so the share it reads is the one that arms it first.
  const armed = economy.militaryFactories / Math.max(1, factories);
  if (armed < PLAN_SHARES[economy.plan].military) {
    return { civilian: 0, military: built };
  }
  return { civilian: built, military: 0 };
};

/** The economy after one day of work, which is the step the calendar takes. */
export const producedOneDay = (economy: NationEconomy): NationEconomy => {
  const population = economy.population * (1 + POPULATION_GROWTH_PER_DAY);
  const progressed = economy.construction + constructionPerDay(economy);
  const built = splitBuilt(economy, Math.floor(progressed / FACTORY_COST));
  return {
    ...economy,
    civilianFactories: economy.civilianFactories + built.civilian,
    construction: progressed % FACTORY_COST,
    equipment:
      economy.equipment + economy.militaryFactories * EQUIPMENT_PER_FACTORY,
    manpower: recoveredManpower(economy, population),
    militaryFactories: economy.militaryFactories + built.military,
    population,
  };
};

/** One nation's economy with a share of it taken out. */
const lightened = (economy: NationEconomy, share: number): NationEconomy => ({
  ...economy,
  civilianFactories:
    economy.civilianFactories - Math.round(economy.civilianFactories * share),
  militaryFactories:
    economy.militaryFactories - Math.round(economy.militaryFactories * share),
  population: economy.population - economy.population * share,
});

/** One nation's economy with what another lost added to it. */
const enlarged = (
  economy: NationEconomy,
  lost: NationEconomy,
  keeping: NationEconomy
): NationEconomy => ({
  ...economy,
  civilianFactories:
    economy.civilianFactories +
    (lost.civilianFactories - keeping.civilianFactories),
  militaryFactories:
    economy.militaryFactories +
    (lost.militaryFactories - keeping.militaryFactories),
  population: economy.population + (lost.population - keeping.population),
});

/**
 * The economies after `share` of one nation's people and industry changed
 * hands.
 *
 * What the loser gives up is worked out first and the winner is handed exactly
 * that, so a province taken and retaken leaves the two of them holding between
 * them what they held before. The men already under arms and the equipment in
 * the depots do not move, because both marched away with the army.
 */
export const shareTransferred = (
  economies: readonly NationEconomy[],
  from: number,
  to: number,
  share: number
): readonly NationEconomy[] => {
  const loser = itemAt(economies, from, NO_ECONOMY);
  const kept = lightened(loser, Math.min(1, Math.max(0, share)));
  return economies.map((economy, nation) => {
    if (nation === from) {
      return kept;
    }
    if (nation === to) {
      return enlarged(economy, loser, kept);
    }
    return economy;
  });
};

/**
 * Each nation's economy on the world's first day, by nation id.
 *
 * Every nation starts under the same law and the same plan, so what separates
 * two of them here is the ground they were grown over and nothing else.
 */
export const startEconomies = (
  world: World,
  owners: Int32Array
): readonly NationEconomy[] =>
  industryByNation(world.provinces, owners, world.nations.length).map(
    (industry): NationEconomy => {
      const militaryFactories = Math.round(
        industry.factories * PLAN_SHARES[START_PLAN].military
      );
      return {
        civilianFactories: industry.factories - militaryFactories,
        conscription: START_CONSCRIPTION,
        construction: 0,
        equipment: 0,
        manpower: manpowerCap(industry.population, START_CONSCRIPTION),
        militaryFactories,
        plan: START_PLAN,
        population: industry.population,
      };
    }
  );
