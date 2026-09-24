import type { Reach } from "./compliance";
import { FUEL_CAPACITY } from "./fuel";
import type { World } from "./index";
import { industryByNation } from "./industry";
import { itemAt } from "./lookup";
import type { Modifiers } from "./modifiers";
import { UNASSIGNED } from "./spread";
import type { TradeLaw } from "./trade";
import { START_TRADE_LAW } from "./trade";

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

/**
 * The share of its factories' output and construction a nation gives up under
 * each law, because the workers the law calls up leave the factories. The
 * values follow Hearts of Iron IV's conscription laws.
 */
const LAW_OUTPUT_LOSS = {
  "all-adults": 0.3,
  extensive: 0,
  limited: 0,
  "service-by-requirement": 0.1,
  volunteer: 0,
} satisfies Readonly<Record<ConscriptionLaw, number>>;

/** The share of its output a nation under `law` keeps. */
const outputUnder = (law: ConscriptionLaw): number => 1 - LAW_OUTPUT_LOSS[law];

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

/**
 * What a nation works with beyond its economy: what it has researched and
 * pursued, how much of what it holds it can draw on, and what its trade and
 * its coast leave it.
 */
export interface Footing {
  readonly modifiers: Modifiers;
  readonly reach: Reach;
  /**
   * The share of their output its military factories building equipment and
   * its dockyards keep, from 0 to 1, which the resources they go without take
   * away.
   */
  readonly supplied: number;
  /** The same share for its military factories on planes, which build with other resources. */
  readonly airSupplied: number;
  /** Civilian factories its trade brought in, less the ones it paid out. */
  readonly traded: number;
  /** Civilian factories its intelligence agency has off construction. */
  readonly tiedUp: number;
  /** The share of its military factories on planes, from 0 to 1. */
  readonly aviation: number;
  /** The share of its people who live on the coast, from 0 to 1. */
  readonly coastal: number;
}

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
  /** Dockyards building ships and convoys. */
  readonly dockyards: number;
  readonly tradeLaw: TradeLaw;
  /** Construction put into the factory now being built. */
  readonly construction: number;
  /** Construction put into the next level of infrastructure. */
  readonly roadworks: number;
  /**
   * The province the nation is building its next level of infrastructure in,
   * or `UNASSIGNED` while its supply carries every division it has, which is
   * when all of its construction goes into factories.
   */
  readonly roadSite: number;
  /** Equipment turned out and not yet drawn on. */
  readonly equipment: number;
  readonly plan: IndustryPlan;
  /** The share of its divisions' daily upkeep the depots met, from 0 to 1. */
  readonly upkeepMet: number;
  /** The fuel in its stockpile. */
  readonly fuel: number;
  /** The fuel its planes and ships burned yesterday, which is what it buys oil for today. */
  readonly burned: number;
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
  burned: 0,
  civilianFactories: 0,
  conscription: "volunteer",
  construction: 0,
  dockyards: 0,
  equipment: 0,
  fuel: 0,
  manpower: 0,
  militaryFactories: 0,
  plan: "civilian",
  population: 0,
  recruited: 0,
  roadSite: UNASSIGNED,
  roadworks: 0,
  tradeLaw: START_TRADE_LAW,
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

/** The economy under `law`, which changes what it sells abroad from tomorrow. */
export const withTradeLaw = (
  economy: NationEconomy,
  law: TradeLaw
): NationEconomy => ({ ...economy, tradeLaw: law });

/** How far along the factory now being built is, from 0 to 1. */
export const constructionProgress = (economy: NationEconomy): number =>
  economy.construction / FACTORY_COST;

/**
 * What the nation's civilian factories put into construction in a day: the
 * ones its consumer goods leave, with the ones its trade handed over and the
 * ones its intelligence agency ties up taken off, and the ones it was handed
 * added.
 */
const constructionPerDay = (
  economy: NationEconomy,
  { modifiers, reach, tiedUp, traded }: Footing
): number =>
  Math.max(
    0,
    economy.civilianFactories * (1 - PLAN_SHARES[economy.plan].consumerGoods) +
      traded -
      tiedUp
  ) *
  CONSTRUCTION_PER_FACTORY *
  (1 + modifiers.construction) *
  outputUnder(economy.conscription) *
  reach.factories;

/**
 * The share of its construction a nation puts into infrastructure while it
 * has a road site. Hearts of Iron IV leaves that to the player, who assigns
 * civilian factories to each construction line, so this is this game's own.
 */
const ROADWORKS_SHARE = 0.25;

/** The share of today's construction that goes into `economy`'s road site. */
const roadworksShareOf = (economy: NationEconomy): number => {
  if (economy.roadSite === UNASSIGNED) {
    return 0;
  }
  return ROADWORKS_SHARE;
};

/**
 * The people a nation of `population` can still call up: what its law reaches,
 * as its modifiers widen it, less everyone it has called up already. The pool
 * grows only as the population does or a heavier law reaches further, so a
 * nation that loses its army has to reach deeper to raise another.
 */
const freeManpower = (
  economy: NationEconomy,
  population: number,
  { modifiers, reach }: Footing
): number =>
  Math.max(
    0,
    manpowerCap(population * reach.manpower, economy.conscription) *
      (1 + modifiers.manpower) -
      economy.recruited
  );

/** How the factories finished today divide between the kinds. */
interface Built {
  readonly civilian: number;
  readonly military: number;
  readonly dockyards: number;
}

/**
 * The share of the factories a war plan arms that a nation puts into
 * dockyards for each share of its people on the coast. Hearts of Iron IV
 * leaves the split to the player, so this is this game's own.
 */
const DOCKYARDS_PER_COASTAL_SHARE = 0.3;

/**
 * Which kind the factories finished today come out as.
 *
 * A nation builds toward the split its plan asks for, so a nation that has just
 * taken a war plan puts everything it finishes into weapons until the split is
 * met and then goes back to building. What it arms goes to the dockyards while
 * they are behind the share its coast asks for, and to military factories
 * after that.
 */
const splitBuilt = (
  economy: NationEconomy,
  built: number,
  coastal: number
): Built => {
  const armed = economy.militaryFactories + economy.dockyards;
  const factories = economy.civilianFactories + armed;
  // A nation holding no factories at all would divide by zero, and it builds
  // nothing in any case, so the share it reads is the one that arms it first.
  if (armed / Math.max(1, factories) >= PLAN_SHARES[economy.plan].military) {
    return { civilian: built, dockyards: 0, military: 0 };
  }
  if (
    economy.dockyards / Math.max(1, armed) <
    coastal * DOCKYARDS_PER_COASTAL_SHARE
  ) {
    return { civilian: 0, dockyards: built, military: 0 };
  }
  return { civilian: 0, dockyards: 0, military: built };
};

/**
 * The share of their full output the nation's military factories or
 * dockyards reach today: the `modifier` their technologies, focuses and trade
 * law add, the workers the conscription law leaves them, the factories
 * occupied ground lets it work, and the `supplied` share the resources they
 * go without leave them.
 */
const armsOutput = (
  economy: NationEconomy,
  footing: Footing,
  supplied: number,
  modifier: number
): number =>
  (1 + modifier) *
  outputUnder(economy.conscription) *
  footing.reach.factories *
  supplied;

/** What one dockyard puts into a ship in a day, in Hearts of Iron IV's units. */
const SHIPBUILDING_PER_DOCKYARD = 2;

/** What one military factory puts into a plane in a day, in Hearts of Iron IV's units. */
const AIRCRAFT_PER_FACTORY = 3.5;

/** A kind of line that puts its day into something built piece by piece. */
export type ProductionLine = "aircraft" | "ships";

/**
 * How many of a kind of line a nation has, what each puts in a day, the share
 * its resources leave it, and the modifier that speeds it up.
 */
interface Lines {
  readonly lines: number;
  readonly perLine: number;
  readonly supplied: number;
  readonly modifier: number;
}

/** The military factories on planes, and the dockyards. */
const LINES = {
  aircraft: (economy: NationEconomy, footing: Footing): Lines => ({
    lines: economy.militaryFactories * footing.aviation,
    modifier: footing.modifiers.production,
    perLine: AIRCRAFT_PER_FACTORY,
    supplied: footing.airSupplied,
  }),
  ships: (economy: NationEconomy, footing: Footing): Lines => ({
    lines: economy.dockyards,
    modifier: footing.modifiers.dockyards,
    perLine: SHIPBUILDING_PER_DOCKYARD,
    supplied: footing.supplied,
  }),
} satisfies Readonly<
  Record<ProductionLine, (economy: NationEconomy, footing: Footing) => Lines>
>;

/** What the nation's lines of `line` put into the planes or the ships they are building today. */
export const outputOf = (
  economy: NationEconomy,
  footing: Footing,
  line: ProductionLine
): number => {
  const { lines, modifier, perLine, supplied } = LINES[line](economy, footing);
  return lines * perLine * armsOutput(economy, footing, supplied, modifier);
};

/**
 * The economy once its planes and ships have burned what they could of
 * `demand`, which is what it counts toward the oil it buys tomorrow.
 */
export const burnt = (
  economy: NationEconomy,
  demand: number
): NationEconomy => {
  const used = Math.min(economy.fuel, demand);
  return {
    ...economy,
    burned: economy.burned + used,
    fuel: economy.fuel - used,
  };
};

/**
 * The economy after one day of work, which is the step the calendar takes,
 * a share of its construction going to its road site while it has one, with
 * the nation's technologies and focuses speeding up its construction,
 * the equipment of the military factories it does not have on planes, and
 * the reach of its conscription law, a heavy law taking
 * some of the construction and the equipment back, and occupied ground giving
 * only the people and the factories its compliance lets the nation draw on.
 */
export const producedOneDay = (
  economy: NationEconomy,
  footing: Footing
): NationEconomy => {
  const population = economy.population * (1 + POPULATION_GROWTH_PER_DAY);
  const constructed = constructionPerDay(economy, footing);
  const onRoads = constructed * roadworksShareOf(economy);
  const progressed = economy.construction + constructed - onRoads;
  const built = splitBuilt(
    economy,
    Math.floor(progressed / FACTORY_COST),
    footing.coastal
  );
  return {
    ...economy,
    civilianFactories: economy.civilianFactories + built.civilian,
    construction: progressed % FACTORY_COST,
    dockyards: economy.dockyards + built.dockyards,
    equipment:
      economy.equipment +
      economy.militaryFactories *
        (1 - footing.aviation) *
        EQUIPMENT_PER_FACTORY *
        armsOutput(
          economy,
          footing,
          footing.supplied,
          footing.modifiers.production
        ),
    manpower: freeManpower(economy, population, footing),
    militaryFactories: economy.militaryFactories + built.military,
    population,
    roadworks: economy.roadworks + onRoads,
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

/** One nation's economy with a share of its people taken out. */
const lightened = (economy: NationEconomy, share: number): NationEconomy => ({
  ...economy,
  population: economy.population - economy.population * share,
});

/** One nation's economy with the people another lost added to it. */
const enlarged = (
  economy: NationEconomy,
  lost: NationEconomy,
  keeping: NationEconomy
): NationEconomy => ({
  ...economy,
  population: economy.population + (lost.population - keeping.population),
});

/**
 * The economies after `share` of one nation's people changed hands.
 *
 * What the loser gives up is worked out first and the winner is handed exactly
 * that, so a province taken and retaken leaves the two of them holding between
 * them what they held before. Everyone the loser has called up stays counted
 * against the loser, and the winner reaches the people it takes only as far as
 * their compliance lets it; the equipment in the depots stays too, because it
 * marched away with the army. The factories and the dockyards stand in the
 * provinces, so they change hands with the ground rather than here.
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
 * The dockyards a nation opens with for each factory it holds and each share
 * of its people on the coast, on top of its factories. Hearts of Iron IV's
 * nations open with their historical yards, so this is this game's own.
 */
const START_DOCKYARD_SHARE = 0.1;

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
        burned: 0,
        civilianFactories: industry.factories - militaryFactories,
        conscription: START_CONSCRIPTION,
        construction: 0,
        dockyards: Math.round(
          industry.factories * industry.coastal * START_DOCKYARD_SHARE
        ),
        equipment: 0,
        fuel: FUEL_CAPACITY,
        manpower: manpowerCap(industry.population, START_CONSCRIPTION),
        militaryFactories,
        plan: START_PLAN,
        population: industry.population,
        recruited: 0,
        roadSite: UNASSIGNED,
        roadworks: 0,
        tradeLaw: START_TRADE_LAW,
        upkeepMet: 1,
      };
    }
  );
