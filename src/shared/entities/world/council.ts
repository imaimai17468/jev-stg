import { Option } from "effect";
import type { Advancement } from "./advancement";
import { freeSlotsOf, START_ADVANCEMENT } from "./advancement";
import type { AgencyProject } from "./agency";
import { AGENCY_UPGRADES, agencyOptions } from "./agency";
import type { AirForce } from "./air-force";
import { allPlanesOf, NO_AIR_FORCE, planesOf } from "./air-force";
import type { Aircraft, Aviation } from "./aircraft";
import { AIRCRAFT, AVIATIONS } from "./aircraft";
import { armouryOf } from "./armoury";
import { dateLabel } from "./calendar";
import type { Negotiation, Order, Ruling, Source } from "./chronicle";
import { BY_RULES } from "./chronicle";
import type { Clock } from "./clock";
import { dateOf } from "./clock";
import { ledgersOf, NO_LEDGER } from "./commerce";
import type {
  Council,
  JevReply,
  NationBrief,
  PeaceTalks,
  Question,
  Verdict,
  Weight,
} from "./consultation";
import {
  COUNTER_INTELLIGENCE_CHOICE,
  factionChoice,
  justifyChoice,
  rivalChoice,
  spyChoice,
} from "./consultation";
import {
  answersToItself,
  factionOf,
  NO_FACTION,
  sideOf,
  standsAlone,
} from "./diplomacy";
import { menFor } from "./divisions";
import { CONSCRIPTION_LAWS, INDUSTRY_PLANS, NO_ECONOMY } from "./economy";
import type { Service } from "./espionage";
import { HOME, NO_SERVICE } from "./espionage";
import type { FocusId, Focuses } from "./focus";
import { availableFocuses, focusOf } from "./focus";
import { FUEL_CAPACITY } from "./fuel";
import type { World } from "./index";
import { intelOf } from "./insight";
import type { IntelTable } from "./intel";
import { INTEL_KINDS, intelOn } from "./intel";
import { CONVOYS_PER_DIVISION } from "./invasion";
import { itemAt } from "./lookup";
import { overseasRivals } from "./maritime";
import { neighbouringNations } from "./nations";
import type { Navy } from "./navy";
import { fleetStrength, NO_NAVY, orderByRules } from "./navy";
import { PEACE_TERMS } from "./peace";
import { graphOf } from "./provinces";
import type { Random } from "./random";
import { randomFromSeed, shuffled, streamSeed } from "./random";
import { availableTechs, leadingTechs } from "./research";
import { ruled } from "./rulings";
import { SHIPYARD_ORDERS } from "./ships";
import type { Forces, Sighting } from "./sightings";
import { sightingOf } from "./sightings";
import type { Simulation } from "./simulation";
import {
  armouriesOf,
  espialOf,
  modifiersOfAll,
  realmOf,
  skiesOf,
  supplyOf,
} from "./simulation";
import type { Skies } from "./skies";
import { skyLostBy } from "./skies";
import type { Stance } from "./stance";
import { START_STANCE, STANCES } from "./stance";
import type { Standoff } from "./statecraft";
import {
  bordering,
  factionToJoin,
  homelandSplit,
  justificationTarget,
  mayStartJustifying,
  outmatches,
  preyOf,
  sideStrength,
  strengthAmong,
  warTarget,
} from "./statecraft";
import type { SupplyNetwork } from "./supply";
import { undersuppliedShare } from "./supply";
import type { TechCategory, TechId } from "./techs";
import { categoryOf, techOf } from "./techs";
import type { TradeLaw } from "./trade";
import { START_TRADE_LAW, TRADE_LAWS } from "./trade";
import { enemiesOf } from "./wars";

/**
 * The draws for the month the council met on `councilDay`. They belong to the
 * month rather than to the day its reply lands, so two months decided on one
 * day draw apart.
 */
const drawsFor = (world: World, councilDay: number): Random =>
  randomFromSeed(streamSeed(world.seed, councilDay));

/** A council and the first of the month it met on. */
export interface Convened {
  /** Days since the start date, on the first of the month. */
  readonly day: number;
  readonly council: Council;
}

/** How the world looks to a government on the first of a month. */
const standoffOf = (world: World, simulation: Simulation): Standoff => ({
  ...realmOf(simulation),
  borders: neighbouringNations(world, simulation.owners),
  overseas: overseasRivals(world, simulation),
  world,
});

/** What a government is briefed with beyond its standoff. */
interface Dossier {
  readonly advancement: Advancement;
  readonly supply: SupplyNetwork;
  /** Every nation's navy, by nation id. */
  readonly navies: readonly Navy[];
  /** Every nation's air force, by nation id. */
  readonly airForces: readonly AirForce[];
  readonly skies: Skies;
  /** The share of its arms output it loses to the resources it goes without. */
  readonly shortage: number;
  /** Its intelligence service. */
  readonly service: Service;
  /** What every nation knows of every other. */
  readonly intel: IntelTable;
  /** The draws that set how far off each figure it cannot see exactly is. */
  readonly random: Random;
}

/** Each of `nations` with `amount` of it, as what `observer` knows of each. */
const forcesOf = (
  intel: IntelTable,
  observer: number,
  nations: readonly number[],
  amount: (nation: number) => number
): readonly Forces[] =>
  nations.map((nation) => ({
    amount: amount(nation),
    known: intelOn(intel, observer, nation),
  }));

/** The nations `nation` may send its operatives to: every other nation still standing, with what it knows of each. */
const spyTargetsOf = (
  standoff: Standoff,
  intel: IntelTable,
  nation: number
): NationBrief["spyTargets"] =>
  standoff.world.nations.flatMap((other) => {
    if (other.id === nation || !standsAlone(standoff.diplomacy, other.id)) {
      return [];
    }
    const known = intelOn(intel, nation, other.id);
    return [
      {
        known:
          INTEL_KINDS.reduce((total, kind) => total + known[kind], 0) /
          INTEL_KINDS.length,
        nation: other.id,
      },
    ];
  });

/** Each of `nations`, with what `nation` believes the men its side has in the field come to. */
const rivalsAmong = (
  standoff: Standoff,
  dossier: Pick<Dossier, "intel" | "random">,
  nation: number,
  nations: readonly number[]
): NationBrief["rivals"] =>
  nations.map((other) => ({
    nation: other,
    strength: sightingOf(
      "army",
      forcesOf(
        dossier.intel,
        nation,
        sideOf(standoff.diplomacy, other),
        (member) => strengthAmong(standoff, new Set([member]))
      ),
      dossier.random
    ),
  }));

/**
 * The nations `nation` may declare on at `day`: the target of its justified
 * war goal, while its side outmatches the target's. Offered a rival its side
 * does not outmatch, Jev declares on one whose army has not formed yet, so the
 * offer carries the rules' odds and Jev decides whether to fight.
 */
const rivalsOf = (
  standoff: Standoff,
  dossier: Pick<Dossier, "intel" | "random">,
  nation: number,
  day: number
): NationBrief["rivals"] =>
  rivalsAmong(
    standoff,
    dossier,
    nation,
    Option.toArray(warTarget(standoff, nation, day))
  );

/**
 * The nations `nation` may start justifying a war goal on: none unless it may
 * start justifying, and otherwise its prey, under the same odds as a war.
 */
const justifiableOf = (
  standoff: Standoff,
  dossier: Pick<Dossier, "advancement" | "intel" | "random">,
  nation: number
): NationBrief["justifiable"] => {
  if (
    !mayStartJustifying(standoff.diplomacy, dossier.advancement.focuses, nation)
  ) {
    return [];
  }
  return rivalsAmong(standoff, dossier, nation, preyOf(standoff, nation));
};

/**
 * The factions `nation` may join: none once it has joined one, and otherwise
 * every faction across its borders with no member it is at war with.
 */
const factionsOf = (
  standoff: Standoff,
  nation: number
): NationBrief["factions"] => {
  const { diplomacy } = standoff;
  if (factionOf(diplomacy, nation) !== NO_FACTION) {
    return [];
  }
  const enemies = new Set(enemiesOf(diplomacy.wars, nation));
  const reachable = new Map<number, number>();
  for (const other of bordering(standoff, nation)) {
    const faction = factionOf(diplomacy, other);
    if (
      faction === NO_FACTION ||
      sideOf(diplomacy, other).some((member) => enemies.has(member))
    ) {
      continue;
    }
    reachable.set(faction, sideStrength(standoff, other));
  }
  return [...reachable].map(([faction, strength]) => ({ faction, strength }));
};

/** What a government's research slots and focus tree offer it this month. */
type Offers = Pick<NationBrief, "focuses" | "freeSlots" | "techs">;

/**
 * The technologies its free slots may start on, the one each line of the
 * tree leads with, which are none where no slot is free, and the focuses it
 * may pick next.
 */
const offersOf = (advancement: Advancement): Offers => {
  const freeSlots = freeSlotsOf(advancement);
  const focuses = availableFocuses(advancement.focuses);
  if (freeSlots === 0) {
    return { focuses, freeSlots, techs: [] };
  }
  return { focuses, freeSlots, techs: leadingTechs(advancement.research) };
};

/** One government's brief for the month. */
const briefOf = (
  standoff: Standoff,
  dossier: Dossier,
  nation: number,
  day: number
): NationBrief => {
  const economy = itemAt(standoff.armies.economies, nation, NO_ECONOMY);
  const enemies = enemiesOf(standoff.diplomacy.wars, nation);
  const airForce = itemAt(dossier.airForces, nation, NO_AIR_FORCE);
  const armoury = armouryOf(dossier.advancement.research);
  const sighted = (
    kind: "army" | "navy" | "air",
    amount: (enemy: number) => number
  ): Sighting =>
    sightingOf(
      kind,
      forcesOf(dossier.intel, nation, enemies, amount),
      dossier.random
    );
  return {
    ...offersOf(dossier.advancement),
    agencyProjects: agencyOptions(
      dossier.service.agency,
      dossier.advancement.research.researched
    ),
    atWar: enemies.length > 0,
    civilianFactories: economy.civilianFactories,
    convoys: itemAt(dossier.navies, nation, NO_NAVY).convoys,
    dockyards: economy.dockyards,
    enemyFleet: sighted("navy", (enemy) =>
      fleetStrength(itemAt(dossier.navies, enemy, NO_NAVY))
    ),
    enemyPlanes: sighted("air", (enemy) =>
      allPlanesOf(itemAt(dossier.airForces, enemy, NO_AIR_FORCE))
    ),
    enemyStrength: sighted("army", (enemy) =>
      strengthAmong(standoff, new Set([enemy]))
    ),
    equipment: economy.equipment,
    factions: factionsOf(standoff, nation),
    fleet: fleetStrength(itemAt(dossier.navies, nation, NO_NAVY)),
    fuel: Math.min(1, economy.fuel / FUEL_CAPACITY),
    justifiable: justifiableOf(standoff, dossier, nation),
    manpower: economy.manpower,
    militaryFactories: economy.militaryFactories,
    nation,
    operatives: dossier.service.operatives,
    planeModels: armoury.planes,
    planes: allPlanesOf(airForce),
    population: economy.population,
    posted: dossier.service.target !== HOME,
    rivals: rivalsOf(standoff, dossier, nation, day),
    shipDesigns: armoury.ships,
    shortage: dossier.shortage,
    skyLost: skyLostBy(dossier.skies, nation),
    spyTargets: spyTargetsOf(standoff, dossier.intel, nation),
    strength: sideStrength(standoff, nation),
    tension: standoff.diplomacy.tension,
    undersupplied: undersuppliedShare(
      dossier.supply,
      standoff.armies.divisions,
      nation
    ),
  };
};

/**
 * The stream the council's figures are misread from, apart from the month's
 * decisions and from the day's intelligence work.
 */
const SIGHTING_STREAM = 23;

/** The nations that decide for themselves, in id order. */
const governments = (world: World, simulation: Simulation): readonly number[] =>
  world.nations.flatMap((nation) => {
    if (!answersToItself(simulation.diplomacy, nation.id)) {
      return [];
    }
    return [nation.id];
  });

/**
 * What every government that decides for itself weighs on the first of a
 * month, which is what the browser sends Jev. A puppet follows its overlord and
 * is left out.
 */
export const councilOf = (world: World, simulation: Simulation): Council => {
  const standoff = standoffOf(world, simulation);
  const supply = supplyOf(world, simulation);
  const ledgers = ledgersOf({
    ...simulation,
    armouries: armouriesOf(simulation),
    modifiers: modifiersOfAll(simulation),
    world,
  });
  const intel = intelOf(espialOf(simulation, graphOf(world.provinces)));
  const random = randomFromSeed(
    streamSeed(streamSeed(world.seed, SIGHTING_STREAM), simulation.clock.days)
  );
  return {
    _tag: "council",
    date: dateLabel(dateOf(simulation.clock)),
    nations: governments(world, simulation).map((nation) =>
      briefOf(
        standoff,
        {
          advancement: itemAt(
            simulation.advancements,
            nation,
            START_ADVANCEMENT
          ),
          airForces: simulation.airForces,
          intel,
          navies: simulation.navies,
          random,
          service: itemAt(simulation.services, nation, NO_SERVICE),
          shortage: itemAt(ledgers, nation, NO_LEDGER).shortage,
          skies: skiesOf(simulation),
          supply,
        },
        nation,
        simulation.clock.days
      )
    ),
  };
};

/** What the victor weighs in talks over `negotiation`'s loser. */
export const peaceTalksOf = (
  world: World,
  simulation: Simulation,
  negotiation: Negotiation
): PeaceTalks => {
  const split = homelandSplit(
    { ...realmOf(simulation), world },
    negotiation.loser
  );
  return {
    _tag: "peace",
    date: dateLabel(dateOf(simulation.clock)),
    loser: negotiation.loser,
    loserHeld: split.loserHeld,
    victor: negotiation.fallback.victor,
    victorHeld: split.victorHeld,
  };
};

/** The option one step further along `options` than `current`, or the last. */
const stepUp = <T>(options: readonly T[], current: T): T =>
  itemAt(
    options,
    Math.min(options.length - 1, options.indexOf(current) + 1),
    current
  );

/**
 * The stance the rules take: bold where the nation outmatches everyone it is
 * fighting, cautious where one of them outmatches it, and neither otherwise.
 */
const stanceByRules = (standoff: Standoff, nation: number): Stance => {
  const enemies = enemiesOf(standoff.diplomacy.wars, nation);
  if (enemies.length === 0) {
    return START_STANCE;
  }
  if (enemies.every((enemy) => outmatches(standoff, nation, enemy))) {
    return "offensive";
  }
  if (enemies.some((enemy) => outmatches(standoff, enemy, nation))) {
    return "defensive";
  }
  return START_STANCE;
};

/**
 * The divisions' worth of men a nation at war keeps in hand before the rules
 * reach for a heavier law, which costs it factory output.
 */
const DRAFT_BELOW_DIVISIONS = 10;

/**
 * What the rules decide for one nation this month. A nation at war turns its
 * plan one step further toward war each month, and calls up one law more only
 * when it is running out of men to call. A nation at peace keeps both. The
 * faction comes from the same rules the world ran on before any government
 * was consulted. A nation declares the war its justified goal allows on `day`,
 * and one with no war to declare may start justifying one under the focuses
 * it finished.
 */
const decisionsByRules = (
  standoff: Standoff,
  focuses: Focuses,
  nation: number,
  { day, random }: { readonly day: number; readonly random: Random }
): readonly Order[] => {
  const economy = itemAt(standoff.armies.economies, nation, NO_ECONOMY);
  const decisions: Order[] = [
    { kind: "stance", nation, stance: stanceByRules(standoff, nation) },
  ];
  if (enemiesOf(standoff.diplomacy.wars, nation).length > 0) {
    decisions.push({
      kind: "plan",
      nation,
      plan: stepUp(INDUSTRY_PLANS, economy.plan),
    });
    if (economy.manpower < menFor(DRAFT_BELOW_DIVISIONS)) {
      decisions.push({
        kind: "conscription",
        law: stepUp(CONSCRIPTION_LAWS, economy.conscription),
        nation,
      });
    }
  }
  for (const faction of Option.toArray(factionToJoin(standoff, nation))) {
    decisions.push({ faction, kind: "join", nation });
  }
  const war = warTarget(standoff, nation, day);
  for (const target of Option.toArray(war)) {
    decisions.push({ kind: "declare", nation, target });
  }
  if (Option.isSome(war)) {
    return decisions;
  }
  for (const target of Option.toArray(
    justificationTarget(standoff, focuses, nation, random)
  )) {
    decisions.push({ kind: "justify", nation, target });
  }
  return decisions;
};

/**
 * The trade law the rules take: limited exports at war, which keeps most of
 * the ore at home for the war effort, and Hearts of Iron IV's default export
 * focus at peace.
 */
const tradeLawByRules = (atWar: boolean): TradeLaw => {
  if (atWar) {
    return "limited-exports";
  }
  return START_TRADE_LAW;
};

/**
 * The convoys the rules keep afloat beyond what the lanes ran yesterday: a
 * quarter more for the lanes to grow into, and enough for one landing.
 */
const LANE_MARGIN = 1.25;
const LANDING_CONVOYS = 4 * CONVOYS_PER_DIVISION;

/** The convoys the rules want `navy` to have afloat. */
const convoysWanted = (navy: Navy): number =>
  navy.lanes.reduce((total, lane) => total + lane.convoys, 0) * LANE_MARGIN +
  LANDING_CONVOYS;

/**
 * What the rules decide for one nation's trade and dockyards this month: the
 * trade law its war or its peace asks for, and, where it has dockyards, the
 * order `orderByRules` gives them.
 */
const tradeAndShipsByRules = (
  simulation: Simulation,
  nation: number
): readonly Order[] => {
  const atWar = enemiesOf(simulation.diplomacy.wars, nation).length > 0;
  const navy = itemAt(simulation.navies, nation, NO_NAVY);
  const trade: Order = { kind: "trade", law: tradeLawByRules(atWar), nation };
  if (itemAt(simulation.economies, nation, NO_ECONOMY).dockyards === 0) {
    return [trade];
  }
  return [
    trade,
    {
      kind: "shipbuilding",
      nation,
      order: orderByRules(navy, atWar, convoysWanted(navy)),
    },
  ];
};

/** The weight of aviation the rules take with the sky held, and with it lost. */
const AVIATION_BY_SKY: readonly Aviation[] = ["light", "heavy"];

/** What the rules weigh in choosing the plane to build. */
interface AirPicture {
  readonly atWar: boolean;
  readonly skyLost: boolean;
  readonly outnumbered: boolean;
  readonly outgunnedAtSea: boolean;
  /** The share of its planes that are fighters, from 0 to 1. */
  readonly fighterShare: number;
}

/**
 * The share of its planes a nation at peace keeps as fighters before the
 * rules build it close air support, and the two planes it builds on either
 * side of that share. This game's own.
 */
const PEACETIME_FIGHTERS = 2 / 3;
const PEACETIME_AIRCRAFT: readonly Aircraft[] = ["fighter", "close-support"];

const aircraftByRules = (picture: AirPicture): Aircraft => {
  if (!picture.atWar) {
    return itemAt(
      PEACETIME_AIRCRAFT,
      Number(picture.fighterShare >= PEACETIME_FIGHTERS),
      "fighter"
    );
  }
  if (picture.skyLost || picture.outnumbered) {
    return "fighter";
  }
  if (picture.outgunnedAtSea) {
    return "naval-bomber";
  }
  return "close-support";
};

/**
 * What the rules put a nation's air factories on this month: some of its
 * military factories on planes always, and more of them while its enemies
 * hold the sky anywhere it fights; at peace, fighters until they make up two
 * thirds of its planes and close air support after that; at war, fighters
 * while its enemies hold any of the sky or have more fighters than it does,
 * otherwise naval bombers while its enemies outgun it at sea, and close air
 * support after that.
 */
const airByRules = (
  simulation: Simulation,
  nation: number
): readonly Order[] => {
  const enemies = enemiesOf(simulation.diplomacy.wars, nation);
  const skyLost = skyLostBy(skiesOf(simulation), nation) > 0;
  const enemyOf = (read: (navy: Navy, airForce: AirForce) => number) =>
    enemies.reduce(
      (total, enemy) =>
        total +
        read(
          itemAt(simulation.navies, enemy, NO_NAVY),
          itemAt(simulation.airForces, enemy, NO_AIR_FORCE)
        ),
      0
    );
  const airForce = itemAt(simulation.airForces, nation, NO_AIR_FORCE);
  const aviation = itemAt(AVIATION_BY_SKY, Number(skyLost), "light");
  const aircraft = aircraftByRules({
    atWar: enemies.length > 0,
    fighterShare:
      planesOf(airForce, "fighter") / Math.max(1, allPlanesOf(airForce)),
    outgunnedAtSea:
      enemyOf((navy) => fleetStrength(navy)) >
      fleetStrength(itemAt(simulation.navies, nation, NO_NAVY)),
    outnumbered:
      planesOf(airForce, "fighter") <
      enemyOf((_, enemy) => planesOf(enemy, "fighter")),
    skyLost,
  });
  return [
    { aviation, kind: "aviation", nation },
    { aircraft, kind: "aircraft", nation },
  ];
};

/**
 * The order the rules buy an agency's upgrades in, at peace and at war,
 * before every other upgrade in the order the agency lists them: at peace the
 * economy's department, the defence against enemy operatives, and the
 * codebreakers; at war the army's department and the codebreakers first.
 * This game's own.
 */
const AGENCY_ORDER = {
  peace: [
    "found",
    "civilian-department",
    "passive-defense",
    "cryptology-department",
    "cypher-school",
  ],
  war: [
    "found",
    "army-department",
    "cryptology-department",
    "radio-interception",
    "passive-defense",
  ],
} satisfies Readonly<Record<"peace" | "war", readonly AgencyProject[]>>;

/** The project the rules put a nation's agency on next, or none where it is busy or has bought everything. */
const agencyByRules = (
  service: Service,
  advancement: Advancement,
  atWar: boolean
): Option.Option<AgencyProject> => {
  const offered = new Set(
    agencyOptions(service.agency, advancement.research.researched)
  );
  const order = itemAt(
    [AGENCY_ORDER.peace, AGENCY_ORDER.war],
    Number(atWar),
    AGENCY_ORDER.peace
  );
  return Option.fromUndefinedOr(
    [...order, ...AGENCY_UPGRADES].find((project) => offered.has(project))
  );
};

/**
 * Where the rules send a nation's operatives: to the enemy with the most men
 * in the field at war, to the neighbour with the most men at peace, and home
 * on counter-intelligence where it has neither. Operatives already in one of
 * those stay there, so the network they built keeps growing rather than
 * starting over each month. This game's own.
 */
const espionageByRules = (
  standoff: Standoff,
  nation: number,
  current: number
): number => {
  const enemies = enemiesOf(standoff.diplomacy.wars, nation);
  const watched = itemAt(
    [bordering(standoff, nation), enemies],
    Number(enemies.length > 0),
    enemies
  );
  if (watched.includes(current)) {
    return current;
  }
  let target = HOME;
  let most = -1;
  for (const other of watched) {
    const men = strengthAmong(standoff, new Set([other]));
    if (men > most) {
      target = other;
      most = men;
    }
  }
  return target;
};

/** What the rules decide for one nation's agency and operatives this month. */
const intelligenceByRules = (
  simulation: Simulation,
  standoff: Standoff,
  nation: number
): readonly Order[] => {
  const service = itemAt(simulation.services, nation, NO_SERVICE);
  const atWar = enemiesOf(simulation.diplomacy.wars, nation).length > 0;
  return [
    ...Option.toArray(
      agencyByRules(
        service,
        itemAt(simulation.advancements, nation, START_ADVANCEMENT),
        atWar
      )
    ).map((project): Order => ({ kind: "agency", nation, project })),
    {
      kind: "espionage",
      nation,
      target: espionageByRules(standoff, nation, service.target),
    },
  ];
};

/** The research categories that arm a nation's forces. */
const MILITARY_CATEGORIES: ReadonlySet<TechCategory> = new Set([
  "infantry",
  "naval",
  "air",
]);

/**
 * The technologies the rules would start, the first choice first: the ones
 * meant for the earliest year first, since a later one takes longer, and within
 * a year the forces' categories first at war and the economy's first at peace.
 * Carrying them out in order fills the free slots, and passes over one that an
 * earlier pick ruled out.
 */
const techsByRules = (
  advancement: Advancement,
  atWar: boolean
): readonly TechId[] => {
  const rank = (tech: TechId) =>
    Number(MILITARY_CATEGORIES.has(categoryOf(techOf(tech).line)) !== atWar);
  return availableTechs(advancement.research).toSorted((one, other) => {
    const byYear = techOf(one).year - techOf(other).year;
    if (byYear !== 0) {
      return byYear;
    }
    return rank(one) - rank(other);
  });
};

/**
 * The focus the rules pick next: the first on offer in the army's branch at
 * war and outside it at peace, or the first on offer where none is.
 */
const focusByRules = (
  advancement: Advancement,
  atWar: boolean
): Option.Option<FocusId> => {
  const offered = availableFocuses(advancement.focuses);
  const preferred = offered.filter(
    (focus) => (focusOf(focus).branch === "army") === atWar
  );
  return Option.fromUndefinedOr([...preferred, ...offered].at(0));
};

/** What the rules put on a nation's research slots and focus tree this month. */
const advancesByRules = (
  advancement: Advancement,
  nation: number,
  atWar: boolean
): readonly Order[] => [
  ...techsByRules(advancement, atWar).map((tech): Order => ({
    kind: "research",
    nation,
    tech,
  })),
  ...Option.toArray(focusByRules(advancement, atWar)).map((focus): Order => ({
    focus,
    kind: "focus",
    nation,
  })),
];

/** The simulation once every one of `decisions` is carried out under `source`. */
const allRuled = (
  world: World,
  simulation: Simulation,
  decisions: readonly Order[],
  source: Source
): Simulation => {
  let current = simulation;
  for (const decision of decisions) {
    current = ruled(world, current, { decision, source });
  }
  return current;
};

/**
 * The month the council met on `councilDay`, decided by the rules for when Jev
 * cannot be asked. The governments decide in an order the month's draw
 * shuffles, so no nation always moves first, and each sees what the ones
 * before it decided.
 */
export const ruledByRules = (
  world: World,
  simulation: Simulation,
  councilDay: number
): Simulation => {
  const random = drawsFor(world, councilDay);
  let current = simulation;
  for (const nation of shuffled(governments(world, simulation), random)) {
    const decided = allRuled(
      world,
      current,
      [
        ...decisionsByRules(
          standoffOf(world, current),
          itemAt(current.advancements, nation, START_ADVANCEMENT).focuses,
          nation,
          { day: current.clock.days, random }
        ),
        ...tradeAndShipsByRules(current, nation),
        ...airByRules(current, nation),
        ...intelligenceByRules(current, standoffOf(world, current), nation),
      ],
      BY_RULES
    );
    current = allRuled(
      world,
      decided,
      advancesByRules(
        itemAt(decided.advancements, nation, START_ADVANCEMENT),
        nation,
        enemiesOf(decided.diplomacy.wars, nation).length > 0
      ),
      BY_RULES
    );
  }
  return current;
};

/** `choice` read as one of `options`, where it names one. */
const pickOf = <T extends string>(
  options: readonly T[],
  choice: string
): Option.Option<T> =>
  Option.fromUndefinedOr(options.find((option) => option === choice));

/**
 * The decision one verdict names, where it names one of the options the brief
 * offered. A choice of none, or of an option the brief never offered, decides
 * nothing.
 */
const decisionOf = (
  brief: NationBrief,
  question: Question,
  choice: string
): Option.Option<Order> => {
  const { nation } = brief;
  if (question === "conscription") {
    return Option.map(pickOf(CONSCRIPTION_LAWS, choice), (law): Order => ({
      kind: "conscription",
      law,
      nation,
    }));
  }
  if (question === "plan") {
    return Option.map(pickOf(INDUSTRY_PLANS, choice), (plan): Order => ({
      kind: "plan",
      nation,
      plan,
    }));
  }
  if (question === "stance") {
    return Option.map(pickOf(STANCES, choice), (stance): Order => ({
      kind: "stance",
      nation,
      stance,
    }));
  }
  if (question === "war") {
    return Option.map(
      Option.fromUndefinedOr(
        brief.rivals.find((rival) => rivalChoice(rival.nation) === choice)
      ),
      (rival): Order => ({ kind: "declare", nation, target: rival.nation })
    );
  }
  if (question === "justify") {
    return Option.map(
      Option.fromUndefinedOr(
        brief.justifiable.find(
          (rival) => justifyChoice(rival.nation) === choice
        )
      ),
      (rival): Order => ({ kind: "justify", nation, target: rival.nation })
    );
  }
  if (question === "research") {
    return Option.map(pickOf(brief.techs, choice), (tech): Order => ({
      kind: "research",
      nation,
      tech,
    }));
  }
  if (question === "focus") {
    return Option.map(pickOf(brief.focuses, choice), (focus): Order => ({
      focus,
      kind: "focus",
      nation,
    }));
  }
  if (question === "trade") {
    return Option.map(pickOf(TRADE_LAWS, choice), (law): Order => ({
      kind: "trade",
      law,
      nation,
    }));
  }
  if (question === "shipbuilding" && brief.dockyards > 0) {
    return Option.map(pickOf(SHIPYARD_ORDERS, choice), (order): Order => ({
      kind: "shipbuilding",
      nation,
      order,
    }));
  }
  if (question === "aircraft") {
    return Option.map(pickOf(AIRCRAFT, choice), (aircraft): Order => ({
      aircraft,
      kind: "aircraft",
      nation,
    }));
  }
  if (question === "aviation") {
    return Option.map(pickOf(AVIATIONS, choice), (aviation): Order => ({
      aviation,
      kind: "aviation",
      nation,
    }));
  }
  if (question === "agency") {
    return Option.map(
      pickOf(brief.agencyProjects, choice),
      (project): Order => ({
        kind: "agency",
        nation,
        project,
      })
    );
  }
  if (question === "espionage") {
    if (choice === COUNTER_INTELLIGENCE_CHOICE) {
      return Option.some({ kind: "espionage", nation, target: HOME });
    }
    return Option.map(
      Option.fromUndefinedOr(
        brief.spyTargets.find((option) => spyChoice(option.nation) === choice)
      ),
      (option): Order => ({ kind: "espionage", nation, target: option.nation })
    );
  }
  if (question === "faction") {
    return Option.map(
      Option.fromUndefinedOr(
        brief.factions.find(
          (option) => factionChoice(option.faction) === choice
        )
      ),
      (option): Order => ({ faction: option.faction, kind: "join", nation })
    );
  }
  return Option.none();
};

/** The least Jev must be sure of a new law, plan or stance before it is taken. */
const POLICY_CONFIDENCE = 0.5;

/** The option `random` lands on when each is drawn with the weight Jev gave it. */
const drawn = (
  weights: readonly Weight[],
  random: Random
): Option.Option<Weight> => {
  let left = random.unit();
  for (const weight of weights) {
    left -= weight.probability;
    if (left < 0) {
      return Option.some(weight);
    }
  }
  return Option.none();
};

/**
 * The options a verdict settles on. A war and a justification are drawn with
 * Jev's weights, so a declaration Jev gives one chance in ten happens in
 * about one month in ten rather than never; a law, a plan or a stance
 * changes only where Jev is sure of it, which keeps them from flipping on a
 * near tie month after month; a
 * faction, a focus and an agency's next project are the one Jev picked, since
 * each is taken once and the agency's many options leave no single one
 * likely enough to pass the bar a law has to; operatives still at home go
 * where Jev picked, and operatives already posted move only where Jev is
 * sure, so a network under way is not abandoned on a near tie; and the
 * research comes back as
 * every technology Jev weighed, the heaviest first, which fills the free slots
 * when carried out in order and passes over one an earlier pick ruled out.
 */
const settledOn = (
  verdict: Verdict,
  brief: NationBrief,
  random: Random
): readonly Weight[] => {
  const picked: Weight = {
    choice: verdict.choice,
    probability: verdict.probability,
  };
  if (verdict.question === "war" || verdict.question === "justify") {
    return Option.toArray(drawn(verdict.weights, random));
  }
  if (
    verdict.question === "faction" ||
    verdict.question === "focus" ||
    verdict.question === "agency" ||
    (verdict.question === "espionage" && !brief.posted)
  ) {
    return [picked];
  }
  if (verdict.question === "research") {
    return verdict.weights.toSorted(
      (one, other) => other.probability - one.probability
    );
  }
  if (picked.probability < POLICY_CONFIDENCE) {
    return [];
  }
  return [picked];
};

/**
 * The rulings Jev's verdicts on `council` name, each carrying the weight Jev
 * put on the option it settled on.
 */
export const rulingsFrom = (
  council: Council,
  verdicts: readonly Verdict[],
  random: Random
): readonly Ruling<Order>[] =>
  verdicts.flatMap((verdict) => {
    const brief = council.nations.find(
      (entry) => entry.nation === verdict.nation
    );
    return Option.toArray(Option.fromUndefinedOr(brief)).flatMap((found) =>
      settledOn(verdict, found, random).flatMap((weight) =>
        Option.toArray(
          Option.map(
            decisionOf(found, verdict.question, weight.choice),
            (decision): Ruling<Order> => ({
              decision,
              source: { kind: "jev", probability: weight.probability },
            })
          )
        )
      )
    );
  });

/** The simulation once Jev's verdicts on a council are carried out. */
export const ruledByJev = (
  world: World,
  simulation: Simulation,
  convened: Convened,
  verdicts: readonly Verdict[]
): Simulation => {
  let current = simulation;
  for (const ruling of rulingsFrom(
    convened.council,
    verdicts,
    drawsFor(world, convened.day)
  )) {
    current = ruled(world, current, ruling);
  }
  return current;
};

/**
 * The peace Jev's verdicts name for `negotiation`, dictated by the victor the
 * talks opened with.
 */
export const termsFrom = (
  negotiation: Negotiation,
  verdicts: readonly Verdict[]
): Option.Option<Ruling<Order>> => {
  const verdict = verdicts.find(
    (entry) => entry.question === "terms" && entry.nation === negotiation.loser
  );
  return Option.flatMap(Option.fromUndefinedOr(verdict), (found) =>
    Option.map(pickOf(PEACE_TERMS, found.choice), (terms): Ruling<Order> => ({
      decision: {
        kind: "peace",
        loser: negotiation.loser,
        settlement: { terms, victor: negotiation.fallback.victor },
      },
      source: { kind: "jev", probability: found.probability },
    }))
  );
};

/**
 * The day the month `clock` reads began on, in days since the start date. The
 * council meets once for each value this takes.
 */
export const councilDayOf = (clock: Clock): number =>
  clock.days - (dateOf(clock).day - 1);

/** The verdicts a reply carries, or none where Jev could not answer. */
const verdictsOf = (reply: JevReply): Option.Option<readonly Verdict[]> => {
  if (reply._tag === "answered") {
    return Option.some(reply.verdicts);
  }
  return Option.none();
};

/**
 * The month decided once the reply to a council is in: by Jev where it
 * answered, and by the rules where it could not.
 */
export const afterCouncil = (
  world: World,
  simulation: Simulation,
  convened: Convened,
  reply: JevReply
): Simulation =>
  Option.match(verdictsOf(reply), {
    onNone: () => ruledByRules(world, simulation, convened.day),
    onSome: (verdicts) => ruledByJev(world, simulation, convened, verdicts),
  });

/**
 * The talks over `negotiation` once the reply is in: signed on the terms Jev
 * names, or on the rules' terms where Jev named none. A reply for talks that
 * have since closed changes nothing, even where the same nation has
 * surrendered again and opened talks of its own since.
 */
export const afterTalks = (
  world: World,
  simulation: Simulation,
  negotiation: Negotiation,
  reply: JevReply
): Simulation => {
  const open = simulation.negotiations.some(
    (talks) =>
      talks.loser === negotiation.loser &&
      talks.openedOn === negotiation.openedOn
  );
  if (!open) {
    return simulation;
  }
  const ruling = Option.getOrElse(
    Option.flatMap(verdictsOf(reply), (verdicts) =>
      termsFrom(negotiation, verdicts)
    ),
    (): Ruling<Order> => ({
      decision: {
        kind: "peace",
        loser: negotiation.loser,
        settlement: negotiation.fallback,
      },
      source: BY_RULES,
    })
  );
  return ruled(world, simulation, ruling);
};
