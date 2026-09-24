import { Option } from "effect";
import type { Armies } from "./army/army";
import { strengthOf } from "./army/divisions";
import type { Entry, Negotiation, Source } from "./chronicle";
import { BY_RULES, chronicled } from "./chronicle";
import type { Clock } from "./clock";
import type { Diplomacy } from "./diplomacy";
import {
  allied,
  answersToItself,
  commanderOf,
  diplomacyOneDay,
  factionOf,
  NO_FACTION,
  sideOf,
} from "./diplomacy";
import type { NationEconomy } from "./economy/economy";
import { NO_ECONOMY } from "./economy/economy";
import { provincePeople } from "./economy/industry";
import type { NationPair } from "./geography/nations";
import type { World } from "./geography/world";
import { valueAt } from "./grid";
import { itemAt } from "./lookup";
import type { Settled, Settlement } from "./peace";
import { settled } from "./peace";
import { landProvinces } from "./provinces";
import type { Random } from "./random";
import type { Focuses } from "./research/focus";
import { mayJustifyAt } from "./tension";
import { justifiedTarget, warGoalOf } from "./war-goals";
import { enemiesOf } from "./wars";

/** How many factions the world opens with. */
const FOUNDING_FACTIONS = 3;

/** How much stronger a side has to be before it counts as a threat or a prey. */
const MENACE_ODDS = 1.5;

/**
 * The chance, each month, that a nation with a prey in reach starts justifying
 * a war goal on it.
 */
const JUSTIFICATION_CHANCE = 0.25;

/** The share of its homeland's people a nation surrenders below. */
const SURRENDER_SHARE = 0.25;

/** The share of the loser's homeland the victor must hold to annex it. */
const ANNEX_SHARE = 0.6;

/** The share it must hold to make a puppet of it rather than take a cession. */
const PUPPET_SHARE = 0.3;

/** The nations in order of `weightOf`, the heaviest first. */
const heaviestFirst = (
  nations: readonly number[],
  weightOf: (nation: number) => number
): readonly number[] =>
  nations
    .map((nation) => ({ nation, weight: weightOf(nation) }))
    .toSorted((left, right) => right.weight - left.weight)
    .map((entry) => entry.nation);

/**
 * The nations that found the opening factions: the most populous, the largest
 * first, the way the great powers of 1936 already lead their blocs.
 */
export const factionFounders = (
  economies: readonly NationEconomy[]
): readonly number[] =>
  heaviestFirst(
    economies.map((_, nation) => nation),
    (nation) => itemAt(economies, nation, NO_ECONOMY).population
  ).slice(0, FOUNDING_FACTIONS);

/** Everything a nation weighs when it decides where it stands. */
export interface Situation {
  readonly world: World;
  readonly armies: Armies;
  readonly diplomacy: Diplomacy;
}

/**
 * A month's decisions also see which nations border which, and which can
 * carry a war to which across the sea.
 */
export interface Standoff extends Situation {
  readonly borders: readonly NationPair[];
  /** Pairs whose first can carry a war across the sea to its second. */
  readonly overseas: readonly NationPair[];
}

/** The men `nations` have in the field between them. */
export const strengthAmong = (
  situation: Situation,
  nations: ReadonlySet<number>
): number =>
  strengthOf(
    situation.armies.divisions.filter((division) =>
      nations.has(division.nation)
    )
  );

/** The men everyone on `nation`'s side has in the field. */
export const sideStrength = (situation: Situation, nation: number): number =>
  strengthAmong(situation, new Set(sideOf(situation.diplomacy, nation)));

/** The nations whose land touches `nation`'s, by id. */
export const bordering = (
  standoff: Standoff,
  nation: number
): readonly number[] =>
  standoff.borders.flatMap((pair) => {
    if (pair.one === nation) {
      return [pair.other];
    }
    if (pair.other === nation) {
      return [pair.one];
    }
    return [];
  });

/**
 * The nations `nation` can go to war with: the ones its land touches, and the
 * ones its fleet can carry a war to across the sea.
 */
export const withinReach = (
  standoff: Standoff,
  nation: number
): readonly number[] => [
  ...bordering(standoff, nation),
  ...standoff.overseas.flatMap((pair) => {
    if (pair.one !== nation) {
      return [];
    }
    return [pair.other];
  }),
];

/** The nations, strongest side first. */
const strongestFirst = (
  situation: Situation,
  nations: readonly number[]
): readonly number[] =>
  heaviestFirst(nations, (nation) => sideStrength(situation, nation));

/** Whether `rival`'s side is strong enough against `nation`'s to fear. */
export const outmatches = (
  situation: Situation,
  rival: number,
  nation: number
): boolean => {
  const theirs = sideStrength(situation, rival);
  return theirs > 0 && theirs >= MENACE_ODDS * sideStrength(situation, nation);
};

/**
 * The faction an unaligned nation joins this month, if it joins one.
 *
 * A nation joins only once a neighbour outside its side outmatches it, and
 * then joins the strongest faction whose ground it touches, other than the
 * one its threat already fights under and any holding a nation it is at war
 * with.
 */
export const factionToJoin = (
  situation: Standoff,
  nation: number
): Option.Option<number> => {
  const { diplomacy } = situation;
  if (
    factionOf(diplomacy, nation) !== NO_FACTION ||
    !answersToItself(diplomacy, nation)
  ) {
    return Option.none();
  }
  const neighbours = bordering(situation, nation);
  const threats = neighbours.filter((rival) =>
    outmatches(situation, rival, nation)
  );
  if (threats.length === 0) {
    return Option.none();
  }
  const threatening = new Set(
    threats.map((rival) => factionOf(diplomacy, rival))
  );
  const enemies = new Set(enemiesOf(diplomacy.wars, nation));
  const candidates = neighbours.filter((other) => {
    const faction = factionOf(diplomacy, other);
    return (
      faction !== NO_FACTION &&
      !threatening.has(faction) &&
      !sideOf(diplomacy, other).some((member) => enemies.has(member))
    );
  });
  return Option.map(
    Option.fromIterable(strongestFirst(situation, candidates)),
    (other) => factionOf(diplomacy, other)
  );
};

/**
 * Whether `nation` may start justifying a war goal: it answers to itself, is
 * at peace, holds no war goal already, and world tension has reached what the
 * focuses it finished require.
 */
export const mayStartJustifying = (
  diplomacy: Diplomacy,
  focuses: Focuses,
  nation: number
): boolean =>
  answersToItself(diplomacy, nation) &&
  enemiesOf(diplomacy.wars, nation).length === 0 &&
  Option.isNone(warGoalOf(diplomacy.warGoals, nation)) &&
  mayJustifyAt(focuses, diplomacy.tension);

/**
 * The nations `nation` could justify a war goal on: every one within its
 * reach outside its side that its side outmatches, the weakest first.
 */
export const preyOf = (
  situation: Standoff,
  nation: number
): readonly number[] =>
  strongestFirst(
    situation,
    withinReach(situation, nation).filter(
      (other) =>
        !allied(situation.diplomacy, nation, other) &&
        outmatches(situation, nation, other)
    )
  ).toReversed();

/**
 * The nation `nation` starts justifying a war goal on this month, if it
 * starts on one: the weakest of its prey, once it may start justifying and
 * the month's draw falls its way.
 */
export const justificationTarget = (
  situation: Standoff,
  focuses: Focuses,
  nation: number,
  random: Random
): Option.Option<number> => {
  if (!mayStartJustifying(situation.diplomacy, focuses, nation)) {
    return Option.none();
  }
  return Option.filter(
    Option.fromIterable(preyOf(situation, nation)),
    () => random.unit() < JUSTIFICATION_CHANCE
  );
};

/**
 * The nation `nation` declares on at `day`, if it declares on one: the target
 * of its justified war goal, while it is at peace, the target is still within
 * its reach, and its side outmatches the target's. A goal whose target has
 * grown too strong waits, and expires where it stays so.
 */
export const warTarget = (
  situation: Standoff,
  nation: number,
  day: number
): Option.Option<number> => {
  if (enemiesOf(situation.diplomacy.wars, nation).length > 0) {
    return Option.none();
  }
  return Option.filter(
    justifiedTarget(situation.diplomacy.warGoals, nation, day),
    (target) =>
      withinReach(situation, nation).includes(target) &&
      outmatches(situation, nation, target)
  );
};

/** The people of `loser`'s homeland each nation holds, by nation id. */
const homelandHeld = (situation: Situation, loser: number): Float64Array => {
  const held = new Float64Array(situation.world.nations.length);
  for (const province of landProvinces(situation.world.provinces)) {
    if (valueAt(situation.diplomacy.cores, province.id) !== loser) {
      continue;
    }
    const owner = valueAt(situation.armies.owners, province.id);
    held[owner] = valueAt(held, owner) + provincePeople(province);
  }
  return held;
};

const homelandTotal = (held: Float64Array): number =>
  held.reduce((total, people) => total + people, 0);

/** Whether `nation` is at war and has lost enough of its homeland to give up. */
export const surrenders = (situation: Situation, nation: number): boolean => {
  if (enemiesOf(situation.diplomacy.wars, nation).length === 0) {
    return false;
  }
  const held = homelandHeld(situation, nation);
  return (
    valueAt(held, nation) < SURRENDER_SHARE * Math.max(1, homelandTotal(held))
  );
};

/** Who holds how much of a surrendered nation's homeland. */
interface HomelandSplit {
  /** The overlord of the enemy bloc holding the most of it. */
  readonly victor: number;
  /** The share that bloc holds, from 0 to 1. */
  readonly victorHeld: number;
  /** The share the loser still holds, from 0 to 1. */
  readonly loserHeld: number;
}

/**
 * How `loser`'s homeland is divided. An overlord and its puppets count as one
 * enemy, so the victor is always an overlord or a nation answering to itself.
 */
export const homelandSplit = (
  situation: Situation,
  loser: number
): HomelandSplit => {
  const { diplomacy } = situation;
  const held = homelandHeld(situation, loser);
  const enemies = enemiesOf(diplomacy.wars, loser);
  const blocs = new Float64Array(held.length);
  for (const enemy of enemies) {
    const commander = commanderOf(diplomacy, enemy);
    blocs[commander] = valueAt(blocs, commander) + valueAt(held, enemy);
  }
  const commanders = [
    ...new Set(enemies.map((enemy) => commanderOf(diplomacy, enemy))),
  ];
  let victor = itemAt(commanders, 0, loser);
  for (const commander of commanders) {
    if (valueAt(blocs, commander) > valueAt(blocs, victor)) {
      victor = commander;
    }
  }
  const total = Math.max(1, homelandTotal(held));
  return {
    loserHeld: valueAt(held, loser) / total,
    victor,
    victorHeld: valueAt(blocs, victor) / total,
  };
};

/**
 * `settlement`, or annexation where the loser holds no ground at all, because
 * a cession or a puppet would leave it a nation with nowhere to stand. Every
 * peace signed goes through here, whoever named the terms.
 */
const enforceableTerms = (
  situation: Situation,
  loser: number,
  settlement: Settlement
): Settlement => {
  if (situation.armies.owners.includes(loser)) {
    return settlement;
  }
  return { ...settlement, terms: "annex" };
};

/**
 * The peace `loser` is made to sign.
 *
 * An overlord and its puppets count as one enemy, so the peace is dictated by
 * the overlord of the bloc holding the most of the loser's homeland and never
 * by a puppet. The more of the homeland that bloc holds, the harsher the
 * terms: a war won by one power ends in annexation, one won by several ends
 * with each keeping what it took.
 */
export const settlementFor = (
  situation: Situation,
  loser: number
): Settlement => {
  const split = homelandSplit(situation, loser);
  const { victor } = split;
  if (split.victorHeld > ANNEX_SHARE) {
    return { terms: "annex", victor };
  }
  if (split.victorHeld >= PUPPET_SHARE) {
    return enforceableTerms(situation, loser, { terms: "puppet", victor });
  }
  return enforceableTerms(situation, loser, { terms: "cede", victor });
};

/**
 * How long a surrendered nation waits for its terms before it signs the rules'.
 * A reply that says Jev cannot answer signs them at once, so this only ends
 * talks whose reply never came, and a month outlasts the gateway's deadline at
 * every speed.
 */
const NEGOTIATION_DAYS = 30;

/**
 * The armies and the diplomacy, with the talks under way and what the world
 * has carried out, which is everything a day of statecraft reads and writes.
 */
export interface Realm extends Settled {
  readonly negotiations: readonly Negotiation[];
  readonly chronicle: readonly Entry[];
}

/**
 * The realm after `loser` signs the `named` terms, made enforceable, which
 * closes its talks and goes into the chronicle under `source` on `day`.
 */
export const peaceSigned = (
  world: World,
  realm: Realm,
  named: Settlement,
  loser: number,
  ruling: { readonly day: number; readonly source: Source }
): Realm => {
  const settlement = enforceableTerms({ ...realm, world }, loser, named);
  return {
    ...realm,
    ...settled(world, realm, loser, settlement),
    chronicle: chronicled(realm.chronicle, {
      day: ruling.day,
      ruling: {
        decision: { kind: "peace", loser, settlement },
        source: ruling.source,
      },
    }),
    negotiations: realm.negotiations.filter(
      (negotiation) => negotiation.loser !== loser
    ),
  };
};

/**
 * The realm with talks opened for every nation that has lost its homeland
 * today and has none open yet. Each keeps the terms the rules would dictate,
 * so a surrender whose talks go unanswered still ends. The list keeps its
 * identity on a day nothing opens.
 */
const talksOpened = (world: World, realm: Realm, day: number): Realm => {
  const talking = new Set(
    realm.negotiations.map((negotiation) => negotiation.loser)
  );
  const opened = world.nations.flatMap((nation): readonly Negotiation[] => {
    const situation = { ...realm, world };
    if (talking.has(nation.id) || !surrenders(situation, nation.id)) {
      return [];
    }
    return [
      {
        fallback: settlementFor(situation, nation.id),
        loser: nation.id,
        openedOn: day,
      },
    ];
  });
  if (opened.length === 0) {
    return realm;
  }
  return { ...realm, negotiations: [...realm.negotiations, ...opened] };
};

/** The realm without `negotiation`'s talks. */
const withoutTalks = (realm: Realm, negotiation: Negotiation): Realm => ({
  ...realm,
  negotiations: realm.negotiations.filter((open) => open !== negotiation),
});

/**
 * The realm keeping only the talks whose loser is still at war. The list keeps
 * its identity when every talk survives, so a reader keyed on it sees no change.
 */
const talksAtWar = (realm: Realm): Realm => {
  const live = realm.negotiations.filter(
    (negotiation) =>
      enemiesOf(realm.diplomacy.wars, negotiation.loser).length > 0
  );
  if (live.length === realm.negotiations.length) {
    return realm;
  }
  return { ...realm, negotiations: live };
};

/**
 * The realm once talks whose loser is no longer at war have been dropped and
 * every talk past its deadline has been signed on the rules' terms. A talk
 * whose victor has left the war since, annexed by a peace signed earlier the
 * same day, is dropped instead, and the loser opens fresh talks with whoever
 * it still fights.
 */
const talksClosed = (world: World, realm: Realm, day: number): Realm => {
  let current = talksAtWar(realm);
  for (const negotiation of current.negotiations) {
    if (day - negotiation.openedOn < NEGOTIATION_DAYS) {
      continue;
    }
    if (
      !enemiesOf(current.diplomacy.wars, negotiation.loser).includes(
        negotiation.fallback.victor
      )
    ) {
      current = withoutTalks(current, negotiation);
      continue;
    }
    current = peaceSigned(
      world,
      current,
      negotiation.fallback,
      negotiation.loser,
      {
        day,
        source: BY_RULES,
      }
    );
  }
  return current;
};

/**
 * One day of statecraft, on the day `clock` reads.
 *
 * War goals that no longer hold are dropped and world tension eases first. A
 * nation that has lost its homeland surrenders the same day and waits for
 * its terms, and one whose terms have not come in time signs the rules'.
 * Everything a government decides month by month goes through the council.
 */
export const conductedOneDay = (
  world: World,
  clock: Clock,
  before: Realm
): Realm =>
  talksOpened(
    world,
    talksClosed(
      world,
      { ...before, diplomacy: diplomacyOneDay(before.diplomacy, clock.days) },
      clock.days
    ),
    clock.days
  );
