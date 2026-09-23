import { Option } from "effect";
import type { Advancement } from "./advancement";
import { freeSlotsOf, START_ADVANCEMENT } from "./advancement";
import { dateLabel } from "./calendar";
import type { Decision, Negotiation, Ruling, Source } from "./chronicle";
import { BY_RULES } from "./chronicle";
import type { Clock } from "./clock";
import { dateOf } from "./clock";
import type {
  Council,
  JevReply,
  NationBrief,
  PeaceTalks,
  Question,
  Verdict,
  Weight,
} from "./consultation";
import { factionChoice, rivalChoice } from "./consultation";
import { allied, factionOf, NO_FACTION, sideOf } from "./diplomacy";
import { menFor } from "./divisions";
import { CONSCRIPTION_LAWS, INDUSTRY_PLANS, NO_ECONOMY } from "./economy";
import type { FocusId } from "./focus";
import { availableFocuses, focusOf } from "./focus";
import type { World } from "./index";
import { itemAt } from "./lookup";
import { neighbouringNations } from "./nations";
import { PEACE_TERMS } from "./peace";
import type { Random } from "./random";
import { randomFromSeed, shuffled, streamSeed } from "./random";
import type { TechBranch, TechId } from "./research";
import { availableTechs, techOf } from "./research";
import { ruled } from "./rulings";
import type { Simulation } from "./simulation";
import { realmOf, supplyOf } from "./simulation";
import type { Stance } from "./stance";
import { START_STANCE, STANCES } from "./stance";
import type { Standoff } from "./statecraft";
import {
  answersToItself,
  bordering,
  factionToJoin,
  homelandSplit,
  outmatches,
  sideStrength,
  strengthAmong,
  warTarget,
} from "./statecraft";
import type { SupplyNetwork } from "./supply";
import { undersuppliedShare } from "./supply";
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
  world,
});

/** What a government is briefed with beyond its standoff. */
interface Dossier {
  readonly advancement: Advancement;
  readonly supply: SupplyNetwork;
}

/** The men every nation fighting `nation` has in the field. */
const enemyStrength = (standoff: Standoff, nation: number): number =>
  strengthAmong(standoff, new Set(enemiesOf(standoff.diplomacy.wars, nation)));

/**
 * The neighbours `nation` may declare on: none while it is at war, and
 * otherwise every neighbour outside its side that its side outmatches. Offered
 * every neighbour, Jev declares on any whose army has not formed yet, so the
 * offer carries the rules' odds and Jev decides which of those to fight, if
 * any.
 */
const rivalsOf = (
  standoff: Standoff,
  nation: number
): NationBrief["rivals"] => {
  const { diplomacy } = standoff;
  if (enemiesOf(diplomacy.wars, nation).length > 0) {
    return [];
  }
  return bordering(standoff, nation).flatMap((other) => {
    if (
      allied(diplomacy, nation, other) ||
      !outmatches(standoff, nation, other)
    ) {
      return [];
    }
    return [{ nation: other, strength: sideStrength(standoff, other) }];
  });
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
 * The technologies its free slots may start on, which are none where no slot
 * is free, and the focuses it may pick next.
 */
const offersOf = (advancement: Advancement): Offers => {
  const freeSlots = freeSlotsOf(advancement);
  const focuses = availableFocuses(advancement.focuses);
  if (freeSlots === 0) {
    return { focuses, freeSlots, techs: [] };
  }
  return { focuses, freeSlots, techs: availableTechs(advancement.research) };
};

/** One government's brief for the month. */
const briefOf = (
  standoff: Standoff,
  dossier: Dossier,
  nation: number
): NationBrief => {
  const economy = itemAt(standoff.armies.economies, nation, NO_ECONOMY);
  return {
    ...offersOf(dossier.advancement),
    atWar: enemiesOf(standoff.diplomacy.wars, nation).length > 0,
    civilianFactories: economy.civilianFactories,
    enemyStrength: enemyStrength(standoff, nation),
    equipment: economy.equipment,
    factions: factionsOf(standoff, nation),
    manpower: economy.manpower,
    militaryFactories: economy.militaryFactories,
    nation,
    population: economy.population,
    rivals: rivalsOf(standoff, nation),
    strength: sideStrength(standoff, nation),
    undersupplied: undersuppliedShare(
      dossier.supply,
      standoff.armies.divisions,
      nation
    ),
  };
};

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
          supply,
        },
        nation
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
 * faction and the war come from the same rules the world ran on before any
 * government was consulted.
 */
const decisionsByRules = (
  standoff: Standoff,
  nation: number,
  random: Random
): readonly Decision[] => {
  const economy = itemAt(standoff.armies.economies, nation, NO_ECONOMY);
  const decisions: Decision[] = [
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
  for (const target of Option.toArray(warTarget(standoff, nation, random))) {
    decisions.push({ kind: "declare", nation, target });
  }
  return decisions;
};

/** The branches that make a nation's army fight better. */
const ARMY_BRANCHES: ReadonlySet<TechBranch> = new Set([
  "infantry",
  "artillery",
  "doctrine",
  "logistics",
]);

/**
 * The technologies the rules would start, the first choice first: the ones
 * meant for the earliest year first, since a later one takes longer, and within
 * a year the army's branches first at war and the economy's first at peace.
 * Carrying them out in order fills the free slots, and passes over one that an
 * earlier pick ruled out.
 */
const techsByRules = (
  advancement: Advancement,
  atWar: boolean
): readonly TechId[] => {
  const rank = (tech: TechId) =>
    Number(ARMY_BRANCHES.has(techOf(tech).branch) !== atWar);
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
): readonly Decision[] => [
  ...techsByRules(advancement, atWar).map((tech): Decision => ({
    kind: "research",
    nation,
    tech,
  })),
  ...Option.toArray(focusByRules(advancement, atWar)).map(
    (focus): Decision => ({ focus, kind: "focus", nation })
  ),
];

/** The simulation once every one of `decisions` is carried out under `source`. */
const allRuled = (
  world: World,
  simulation: Simulation,
  decisions: readonly Decision[],
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
      decisionsByRules(standoffOf(world, current), nation, random),
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
): Option.Option<Decision> => {
  const { nation } = brief;
  if (question === "conscription") {
    return Option.map(pickOf(CONSCRIPTION_LAWS, choice), (law): Decision => ({
      kind: "conscription",
      law,
      nation,
    }));
  }
  if (question === "plan") {
    return Option.map(pickOf(INDUSTRY_PLANS, choice), (plan): Decision => ({
      kind: "plan",
      nation,
      plan,
    }));
  }
  if (question === "stance") {
    return Option.map(pickOf(STANCES, choice), (stance): Decision => ({
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
      (rival): Decision => ({ kind: "declare", nation, target: rival.nation })
    );
  }
  if (question === "research") {
    return Option.map(pickOf(brief.techs, choice), (tech): Decision => ({
      kind: "research",
      nation,
      tech,
    }));
  }
  if (question === "focus") {
    return Option.map(pickOf(brief.focuses, choice), (focus): Decision => ({
      focus,
      kind: "focus",
      nation,
    }));
  }
  if (question === "faction") {
    return Option.map(
      Option.fromUndefinedOr(
        brief.factions.find(
          (option) => factionChoice(option.faction) === choice
        )
      ),
      (option): Decision => ({ faction: option.faction, kind: "join", nation })
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
 * The options a verdict settles on. A war is drawn with Jev's weights, so a
 * declaration Jev gives one chance in ten happens in about one month in ten
 * rather than never; a law, a plan or a stance changes only where Jev is sure
 * of it, which keeps them from flipping on a near tie month after month; a
 * faction and a focus are the one Jev picked; and the research comes back as
 * every technology Jev weighed, the heaviest first, which fills the free slots
 * when carried out in order and passes over one an earlier pick ruled out.
 */
const settledOn = (verdict: Verdict, random: Random): readonly Weight[] => {
  const picked: Weight = {
    choice: verdict.choice,
    probability: verdict.probability,
  };
  if (verdict.question === "war") {
    return Option.toArray(drawn(verdict.weights, random));
  }
  if (verdict.question === "faction" || verdict.question === "focus") {
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
): readonly Ruling[] =>
  verdicts.flatMap((verdict) => {
    const brief = council.nations.find(
      (entry) => entry.nation === verdict.nation
    );
    return Option.toArray(Option.fromUndefinedOr(brief)).flatMap((found) =>
      settledOn(verdict, random).flatMap((weight) =>
        Option.toArray(
          Option.map(
            decisionOf(found, verdict.question, weight.choice),
            (decision): Ruling => ({
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
): Option.Option<Ruling> => {
  const verdict = verdicts.find(
    (entry) => entry.question === "terms" && entry.nation === negotiation.loser
  );
  return Option.flatMap(Option.fromUndefinedOr(verdict), (found) =>
    Option.map(pickOf(PEACE_TERMS, found.choice), (terms): Ruling => ({
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
    (): Ruling => ({
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
