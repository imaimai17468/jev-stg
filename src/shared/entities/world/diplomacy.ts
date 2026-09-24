import { valueAt } from "./grid";
import { itemAt, replacedAt } from "./lookup";
import type { TensionCause } from "./tension";
import { tensionEasedOneDay, tensionRaised } from "./tension";
import type { WarGoal } from "./war-goals";
import { justifyingDays, warGoalStanding, withoutGoalOf } from "./war-goals";
import type { Wars } from "./wars";
import { atWar, declared, noWars, peaceFor, warCount } from "./wars";

/** Whether a nation answers to itself, to another, or to nobody any more. */
export type Standing =
  | { readonly kind: "independent" }
  | { readonly kind: "puppet"; readonly overlord: number }
  | { readonly kind: "annexed"; readonly by: number };

export const INDEPENDENT: Standing = { kind: "independent" };

/** The faction a nation that has joined none belongs to. */
export const NO_FACTION = -1;

/** Who is fighting whom, who stands together, and who answers to whom. */
export interface Diplomacy {
  readonly wars: Wars;
  /**
   * The faction each nation has joined, by nation id, named by the id of the
   * nation that founded it, or `NO_FACTION`. A puppet fights under its
   * overlord's faction rather than its own entry here.
   */
  readonly factions: Int32Array;
  /** Each nation's standing, by nation id. */
  readonly standings: readonly Standing[];
  /**
   * The nation each province is homeland to, by province id: its holder when
   * the world opened, redrawn to its holder whenever the nation it was
   * homeland to signs a peace. It is what a nation surrenders over, so ground
   * it took in a war it is still fighting does not keep it in one it has lost
   * at home.
   */
  readonly cores: Int32Array;
  /**
   * How close the whole world stands to war, from 0 to 1, which gates who may
   * justify a war goal and shortens the justifying.
   */
  readonly tension: number;
  /** The war goal each nation justifies or has justified, at most one each. */
  readonly warGoals: readonly WarGoal[];
}

/**
 * The diplomacy of a world on its first day: nobody at war, nobody answering
 * to anybody, and a faction for each of `founders`, each founded by and named
 * after its founder.
 */
export const openingDiplomacy = (
  cores: Int32Array,
  nations: number,
  founders: readonly number[]
): Diplomacy => {
  const factions = new Int32Array(nations).fill(NO_FACTION);
  for (const founder of founders) {
    factions[founder] = founder;
  }
  return {
    cores,
    factions,
    standings: Array.from({ length: nations }, () => INDEPENDENT),
    tension: 0,
    warGoals: [],
    wars: noWars(nations),
  };
};

export const standingOf = (diplomacy: Diplomacy, nation: number): Standing =>
  itemAt(diplomacy.standings, nation, INDEPENDENT);

/** Whether the nation makes its own choices, which a puppet does not. */
export const answersToItself = (
  diplomacy: Diplomacy,
  nation: number
): boolean => standingOf(diplomacy, nation).kind === "independent";

/** The nation whose wars and faction `nation` follows: its overlord or itself. */
export const commanderOf = (diplomacy: Diplomacy, nation: number): number => {
  const standing = standingOf(diplomacy, nation);
  if (standing.kind === "puppet") {
    return standing.overlord;
  }
  return nation;
};

/** The faction `nation` fights under, or `NO_FACTION`. */
export const factionOf = (diplomacy: Diplomacy, nation: number): number =>
  valueAt(diplomacy.factions, commanderOf(diplomacy, nation));

/** Whether the nation still holds a seat in the world. */
export const standsAlone = (diplomacy: Diplomacy, nation: number): boolean =>
  standingOf(diplomacy, nation).kind !== "annexed";

/** How many nations still hold a seat in the world. */
export const nationsStanding = (diplomacy: Diplomacy): number =>
  diplomacy.standings.filter((_, nation) => standsAlone(diplomacy, nation))
    .length;

/**
 * Whether the two go to war together: the same nation, a nation and its
 * puppet, or two nations under one faction.
 */
export const allied = (
  diplomacy: Diplomacy,
  one: number,
  other: number
): boolean => {
  if (!standsAlone(diplomacy, one) || !standsAlone(diplomacy, other)) {
    return false;
  }
  if (commanderOf(diplomacy, one) === commanderOf(diplomacy, other)) {
    return true;
  }
  const faction = factionOf(diplomacy, one);
  return faction !== NO_FACTION && faction === factionOf(diplomacy, other);
};

/** Every nation that goes to war alongside `nation`, itself included. */
export const sideOf = (
  diplomacy: Diplomacy,
  nation: number
): readonly number[] =>
  diplomacy.standings.flatMap((_, other) => {
    if (!allied(diplomacy, nation, other)) {
      return [];
    }
    return [other];
  });

/** The diplomacy with world tension raised by `cause`. */
export const tensionFrom = (
  diplomacy: Diplomacy,
  cause: TensionCause
): Diplomacy => ({
  ...diplomacy,
  tension: tensionRaised(diplomacy.tension, cause),
});

/**
 * The diplomacy after `nation` starts justifying a war goal on `target` on
 * `day`, which replaces any goal it held and raises world tension.
 */
export const justificationStarted = (
  diplomacy: Diplomacy,
  goal: Omit<WarGoal, "readyOn">,
  day: number
): Diplomacy =>
  tensionFrom(
    {
      ...diplomacy,
      warGoals: [
        ...withoutGoalOf(diplomacy.warGoals, goal.nation),
        {
          nation: goal.nation,
          readyOn: day + justifyingDays(diplomacy.tension),
          target: goal.target,
        },
      ],
    },
    "justify"
  );

/**
 * The diplomacy after `attacker` declares on `target`: everyone on the
 * attacker's side goes to war with everyone on the target's, which is the call
 * to arms a faction answers, the attacker's war goal is spent, and world
 * tension rises. Two allies never go to war with each other, so a declaration
 * between them changes nothing.
 */
export const warDeclared = (
  diplomacy: Diplomacy,
  attacker: number,
  target: number
): Diplomacy => {
  if (allied(diplomacy, attacker, target)) {
    return diplomacy;
  }
  const defenders = sideOf(diplomacy, target);
  let { wars } = diplomacy;
  for (const one of sideOf(diplomacy, attacker)) {
    for (const other of defenders) {
      wars = declared(wars, { one, other });
    }
  }
  return tensionFrom(
    {
      ...diplomacy,
      warGoals: withoutGoalOf(diplomacy.warGoals, attacker),
      wars,
    },
    "declare"
  );
};

/** The diplomacy with `nation` in `faction`, which raises world tension. */
export const joined = (
  diplomacy: Diplomacy,
  nation: number,
  faction: number
): Diplomacy => {
  const factions = Int32Array.from(diplomacy.factions);
  factions[nation] = faction;
  return tensionFrom({ ...diplomacy, factions }, "join");
};

/**
 * Whether `goal` still holds on `day`: it has not expired, its nation and its
 * target both still stand, and they neither fight on one side nor are already
 * at war, which a call to arms from an ally spends the goal on.
 */
const goalHolds = (diplomacy: Diplomacy, goal: WarGoal, day: number): boolean =>
  warGoalStanding(goal, day) !== "expired" &&
  answersToItself(diplomacy, goal.nation) &&
  standsAlone(diplomacy, goal.target) &&
  !allied(diplomacy, goal.nation, goal.target) &&
  !atWar(diplomacy.wars, goal.nation, goal.target);

/**
 * The diplomacy after one day on `day`: war goals that no longer hold are
 * dropped, and world tension eases unless a war runs somewhere.
 */
export const diplomacyOneDay = (
  diplomacy: Diplomacy,
  day: number
): Diplomacy => {
  const tension = tensionEasedOneDay(
    diplomacy.tension,
    warCount(diplomacy.wars) > 0
  );
  const held = diplomacy.warGoals.filter((goal) =>
    goalHolds(diplomacy, goal, day)
  );
  if (held.length === diplomacy.warGoals.length) {
    return { ...diplomacy, tension };
  }
  return { ...diplomacy, tension, warGoals: held };
};

/** The diplomacy with `nation` at peace with everyone and nothing else changed. */
export const peaceMade = (diplomacy: Diplomacy, nation: number): Diplomacy => ({
  ...diplomacy,
  wars: peaceFor(diplomacy.wars, nation),
});

/**
 * The factions once `nation` has left its own. A faction its founder leaves
 * passes to the remaining member with the lowest id, which renames it, so a
 * faction is always named after a nation fighting under it.
 */
const factionsWithout = (factions: Int32Array, nation: number): Int32Array => {
  const left = Int32Array.from(factions);
  left[nation] = NO_FACTION;
  if (valueAt(factions, nation) !== nation) {
    return left;
  }
  const heir = left.indexOf(nation);
  return left.map((faction) => {
    if (faction === nation) {
      return heir;
    }
    return faction;
  });
};

/**
 * The diplomacy after `nation` leaves every war and its faction and takes up
 * `standing`, which is how every peace ends for the side that sued for it.
 */
export const leftTheWar = (
  diplomacy: Diplomacy,
  nation: number,
  standing: Standing
): Diplomacy => ({
  ...peaceMade(diplomacy, nation),
  factions: factionsWithout(diplomacy.factions, nation),
  standings: replacedAt(diplomacy.standings, nation, standing),
});

/** The puppets that answer to `overlord`, by nation id. */
export const puppetsOf = (
  diplomacy: Diplomacy,
  overlord: number
): readonly number[] =>
  diplomacy.standings.flatMap((standing, nation) => {
    if (standing.kind !== "puppet" || standing.overlord !== overlord) {
      return [];
    }
    return [nation];
  });
