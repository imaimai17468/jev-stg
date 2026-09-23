import { Option } from "effect";
import type { Armies } from "./army";
import type { Clock } from "./clock";
import { dateOf } from "./clock";
import type { Diplomacy } from "./diplomacy";
import {
  allied,
  commanderOf,
  factionOf,
  joined,
  NO_FACTION,
  sideOf,
  standingOf,
  warDeclared,
} from "./diplomacy";
import { strengthOf } from "./divisions";
import type { NationEconomy } from "./economy";
import { valueAt } from "./grid";
import type { World } from "./index";
import { provincePeople } from "./industry";
import { itemAt } from "./lookup";
import type { NationPair } from "./nations";
import { neighbouringNations } from "./nations";
import type { Settled, Settlement } from "./peace";
import { settled } from "./peace";
import { landProvinces } from "./provinces";
import type { Random } from "./random";
import { randomFromSeed, shuffled, streamSeed } from "./random";
import { enemiesOf } from "./wars";

/** How many factions the world opens with. */
const FOUNDING_FACTIONS = 3;

/** How much stronger a side has to be before it counts as a threat or a prey. */
const MENACE_ODDS = 1.5;

/** The chance, each month, that a nation with a prey in reach declares on it. */
const DECLARATION_CHANCE = 0.25;

/** The share of its homeland's people a nation surrenders below. */
const SURRENDER_SHARE = 0.25;

/** The share of the loser's homeland the victor must hold to annex it. */
const ANNEX_SHARE = 0.6;

/** The share it must hold to make a puppet of it rather than take a cession. */
const PUPPET_SHARE = 0.3;

/**
 * The nations that found the opening factions: the most populous, the largest
 * first, the way the great powers of 1936 already lead their blocs.
 */
export const factionFounders = (
  economies: readonly NationEconomy[]
): readonly number[] =>
  economies
    .map((economy, nation) => ({ nation, population: economy.population }))
    .toSorted((left, right) => right.population - left.population)
    .slice(0, FOUNDING_FACTIONS)
    .map((entry) => entry.nation);

/** Everything a nation weighs when it decides where it stands. */
interface Situation {
  readonly world: World;
  readonly armies: Armies;
  readonly diplomacy: Diplomacy;
}

/** A month's decisions also see which nations border which. */
interface Standoff extends Situation {
  readonly borders: readonly NationPair[];
}

/** The men everyone on `nation`'s side has in the field. */
const sideStrength = (situation: Situation, nation: number): number => {
  const side = new Set(sideOf(situation.diplomacy, nation));
  return strengthOf(
    situation.armies.divisions.filter((division) => side.has(division.nation))
  );
};

/** The nations whose land touches `nation`'s, by id. */
const bordering = (standoff: Standoff, nation: number): readonly number[] =>
  standoff.borders.flatMap((pair) => {
    if (pair.one === nation) {
      return [pair.other];
    }
    if (pair.other === nation) {
      return [pair.one];
    }
    return [];
  });

/** The nations, strongest side first. */
const strongestFirst = (
  situation: Situation,
  nations: readonly number[]
): readonly number[] =>
  nations
    .map((nation) => ({ nation, strength: sideStrength(situation, nation) }))
    .toSorted((left, right) => right.strength - left.strength)
    .map((entry) => entry.nation);

/** Whether `rival`'s side is strong enough against `nation`'s to fear. */
const outmatches = (
  situation: Situation,
  rival: number,
  nation: number
): boolean => {
  const theirs = sideStrength(situation, rival);
  return theirs > 0 && theirs >= MENACE_ODDS * sideStrength(situation, nation);
};

/** Whether the nation makes its own choices, which a puppet does not. */
const answersToItself = (diplomacy: Diplomacy, nation: number): boolean =>
  standingOf(diplomacy, nation).kind === "independent";

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
 * The nation `nation` declares on this month, if it declares on one.
 *
 * Only an independent nation at peace goes looking, it looks at its weakest
 * neighbour outside its own side, and it declares when its side outmatches
 * that neighbour's and the month's draw falls its way.
 */
export const warTarget = (
  situation: Standoff,
  nation: number,
  random: Random
): Option.Option<number> => {
  const { diplomacy } = situation;
  if (
    !answersToItself(diplomacy, nation) ||
    enemiesOf(diplomacy.wars, nation).length > 0
  ) {
    return Option.none();
  }
  const prey = strongestFirst(
    situation,
    bordering(situation, nation).filter(
      (other) => !allied(diplomacy, nation, other)
    )
  ).toReversed();
  return Option.filter(
    Option.fromIterable(prey),
    (target) =>
      outmatches(situation, nation, target) &&
      random.unit() < DECLARATION_CHANCE
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

/**
 * The peace `loser` is made to sign.
 *
 * An overlord and its puppets count as one enemy, so the peace is dictated by
 * the overlord of the bloc holding the most of the loser's homeland and never
 * by a puppet. The more of the homeland that bloc holds, the harsher the
 * terms: a war won by one power ends in annexation, one won by several ends
 * with each keeping what it took. A loser left holding no ground at all is
 * annexed whatever the split, because a cession would leave it a nation with
 * nowhere to stand.
 */
export const settlementFor = (
  situation: Situation,
  loser: number
): Settlement => {
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
  const share = valueAt(blocs, victor) / Math.max(1, homelandTotal(held));
  if (share > ANNEX_SHARE || !situation.armies.owners.includes(loser)) {
    return { terms: "annex", victor };
  }
  if (share >= PUPPET_SHARE) {
    return { terms: "puppet", victor };
  }
  return { terms: "cede", victor };
};

/** Every nation that has lost its homeland signs the peace it is given. */
const surrendered = (world: World, before: Settled): Settled => {
  let current = before;
  for (const nation of world.nations) {
    const situation = { ...current, world };
    if (!surrenders(situation, nation.id)) {
      continue;
    }
    current = settled(
      world,
      current,
      nation.id,
      settlementFor(situation, nation.id)
    );
  }
  return current;
};

/**
 * A month's diplomacy: the unaligned look for a faction, then the strong look
 * for a war, in an order the day's draw shuffles so no nation always moves
 * first. Each decision sees the ones taken before it.
 */
const monthsDiplomacy = (
  world: World,
  before: Settled,
  random: Random
): Settled => {
  const borders = neighbouringNations(world, before.armies.owners);
  const order = shuffled(
    world.nations.map((nation) => nation.id),
    random
  );
  const { armies } = before;
  let { diplomacy } = before;
  for (const nation of order) {
    const faction = factionToJoin(
      { armies, borders, diplomacy, world },
      nation
    );
    if (Option.isSome(faction)) {
      diplomacy = joined(diplomacy, nation, faction.value);
    }
  }
  for (const nation of order) {
    const target = warTarget(
      { armies, borders, diplomacy, world },
      nation,
      random
    );
    if (Option.isSome(target)) {
      diplomacy = warDeclared(diplomacy, nation, target.value);
    }
  }
  return { armies, diplomacy };
};

/**
 * One day of statecraft, on the day `clock` reads.
 *
 * Surrenders are signed the day they are earned, and the rest of diplomacy
 * waits for the first of the month, which is how often a government meets.
 */
export const conductedOneDay = (
  world: World,
  clock: Clock,
  before: Settled
): Settled => {
  const after = surrendered(world, before);
  if (dateOf(clock).day !== 1) {
    return after;
  }
  return monthsDiplomacy(
    world,
    after,
    randomFromSeed(streamSeed(world.seed, clock.days))
  );
};
