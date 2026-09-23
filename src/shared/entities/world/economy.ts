import type { World } from "./index";
import { industryByNation } from "./industry";
import { itemAt } from "./lookup";
import type { Modifiers } from "./modifiers";

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
  /**
   * The people the nation can still call up: what its conscription law reaches
   * of its population, less everyone it has already called up. Worked out
   * again at the start of each day, before divisions are raised and ground
   * changes hands, so a capture or a new law shows in it the next day.
   */
  readonly manpower: number;
  /**
   * Everyone the nation has called up so far, the men in the field and the
   * men it has lost alike, since neither is back at home to be called again.
   */
  readonly recruited: number;
  /** Factories on construction sites, which is what raises both counts. */
  readonly civilianFactories: number;
  /** Factories turning out equipment. */
  readonly militaryFactories: number;
  /** Construction put into the factory now being built. */
  readonly construction: number;
  /** Equipment turned out and not yet drawn on. */
  readonly equipment: number;
  readonly plan: IndustryPlan;
  /** The share of its divisions' daily upkeep the depots met, from 0 to 1. */
  readonly upkeepMet: number;
}

/** How much a nation's population grows in a year. */
const POPULATION_GROWTH_PER_YEAR = 0.012;
const DAYS_PER_YEAR = 365.25;
const POPULATION_GROWTH_PER_DAY = POPULATION_GROWTH_PER_YEAR / DAYS_PER_YEAR;

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
  recruited: 0,
  upkeepMet: 1,
};

/** The law and the plan every nation opens 1936 under. */
const START_CONSCRIPTION: ConscriptionLaw = "volunteer";
const START_PLAN: IndustryPlan = "civilian";

const manpowerCap = (population: number, law: ConscriptionLaw): number =>
  population * MANPOWER_SHARE[law];

/**
 * The economy under `law`. Everyone already called up stays called up: a
 * heavier law reaches further into the population, which the next day's pool
 * adds, and a lighter one reaches less far, which can leave nobody to call.
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
const constructionPerDay = (
  economy: NationEconomy,
  modifiers: Modifiers
): number =>
  economy.civilianFactories *
  (1 - PLAN_SHARES[economy.plan].consumerGoods) *
  CONSTRUCTION_PER_FACTORY *
  (1 + modifiers.construction);

/**
 * The people a nation of `population` can still call up: what its law reaches,
 * as its modifiers widen it, less everyone it has called up already. The pool
 * grows only as the population does or a heavier law reaches further, so a
 * nation that loses its army has to reach deeper to raise another.
 */
const freeManpower = (
  economy: NationEconomy,
  population: number,
  modifiers: Modifiers
): number =>
  Math.max(
    0,
    manpowerCap(population, economy.conscription) * (1 + modifiers.manpower) -
      economy.recruited
  );

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

/**
 * The economy after one day of work, which is the step the calendar takes,
 * with the nation's technologies and focuses speeding up its construction,
 * its equipment and the reach of its conscription law.
 */
export const producedOneDay = (
  economy: NationEconomy,
  modifiers: Modifiers
): NationEconomy => {
  const population = economy.population * (1 + POPULATION_GROWTH_PER_DAY);
  const progressed =
    economy.construction + constructionPerDay(economy, modifiers);
  const built = splitBuilt(economy, Math.floor(progressed / FACTORY_COST));
  return {
    ...economy,
    civilianFactories: economy.civilianFactories + built.civilian,
    construction: progressed % FACTORY_COST,
    equipment:
      economy.equipment +
      economy.militaryFactories *
        EQUIPMENT_PER_FACTORY *
        (1 + modifiers.production),
    manpower: freeManpower(economy, population, modifiers),
    militaryFactories: economy.militaryFactories + built.military,
    population,
  };
};

/** The equipment one division in the field wears out in a day. */
const UPKEEP_PER_DIVISION = 2;

/** The equipment `divisions` divisions in the field wear out in a day. */
export const upkeepOf = (divisions: number): number =>
  divisions * UPKEEP_PER_DIVISION;

/**
 * The economy once `divisions` divisions have drawn a day's upkeep from the
 * depots: all of it where the depots hold enough, and what is left where they
 * do not, which is the share of the need `upkeepMet` records.
 */
export const upkept = (
  economy: NationEconomy,
  divisions: number
): NationEconomy => {
  const need = upkeepOf(divisions);
  const paid = Math.min(economy.equipment, need);
  if (need === 0) {
    return { ...economy, upkeepMet: 1 };
  }
  return {
    ...economy,
    equipment: economy.equipment - paid,
    upkeepMet: paid / need,
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
  recruited: economy.recruited - economy.recruited * share,
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
  recruited: economy.recruited + (lost.recruited - keeping.recruited),
});

/**
 * The economies after `share` of one nation's people and industry changed
 * hands.
 *
 * What the loser gives up is worked out first and the winner is handed exactly
 * that, so a province taken and retaken leaves the two of them holding between
 * them what they held before. The same share of everyone the loser has called
 * up moves with the people, so the winner cannot call them up a second time;
 * the equipment in the depots stays, because it marched away with the army.
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
        recruited: 0,
        upkeepMet: 1,
      };
    }
  );
