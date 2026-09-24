import { Schema } from "effect";
import type { NationEconomy } from "./economy";
import { lastWhere } from "./lookup";
import type { Modifiers } from "./modifiers";
import type { Nation } from "./nations";
import { entrenchedShare } from "./preparation";
import type { Terrain } from "./terrain";

/** What a division is built from. Armour and artillery join this later. */
type DivisionKind = "infantry";

/** What one division of a kind costs to raise and what it can do. */
interface Template {
  /** The men it takes to raise, and the most it ever holds. */
  readonly manpower: number;
  /** The equipment it takes to raise. */
  readonly equipment: number;
  /** What a day of attacking with it is worth, at full strength. */
  readonly attack: number;
  /** What a day of holding ground with it is worth, at full strength. */
  readonly defence: number;
  /** The cohesion it starts a battle with and falls back without. */
  readonly organisation: number;
}

const TEMPLATES = {
  infantry: {
    attack: 6,
    defence: 10,
    equipment: 1000,
    manpower: 20_000,
    organisation: 60,
  },
} satisfies Readonly<Record<DivisionKind, Template>>;

/**
 * How a division came into the province it stands in: on foot, or off the
 * transports onto a beach, which it attacks from at a penalty until it moves.
 */
export type Arrival = "march" | "landing";

/**
 * What a division is doing: standing to the orders of its nation's line,
 * falling back to the fallback line after it broke, to regroup there, or
 * holding the province it guards, which the line never calls away. A
 * garrison that breaks regroups like any other division and then answers to
 * the line.
 */
export type Task = "line" | "regroup" | "garrison";

/** One division: where it stands, what is left of it, and where it is walking. */
export interface Division {
  readonly nation: number;
  readonly kind: DivisionKind;
  /** The province it stands in. */
  readonly province: number;
  /** The men still in it. */
  readonly strength: number;
  /** What is left of its cohesion. At zero it has to fall back. */
  readonly organisation: number;
  /** The province it is walking into, or its own where it stands still. */
  readonly movingTo: number;
  /** The days it has spent walking toward `movingTo`. */
  readonly marched: number;
  readonly arrival: Arrival;
  readonly task: Task;
  /** The levels it has dug in where it stands, from 0 to `MOST_ENTRENCHMENT`. */
  readonly entrenchment: number;
  /** The planning bonus its preparation has built, from 0 to `MOST_PLANNING`. */
  readonly planning: number;
}

/** The days it takes a division to walk into a province of each terrain. */
const MARCH_DAYS = {
  desert: 3,
  forest: 3,
  hills: 3,
  mountains: 5,
  plains: 2,
  tundra: 4,
} satisfies Readonly<Record<Terrain, number>>;

/** How much a terrain is worth to whoever is holding it. */
const TERRAIN_DEFENCE = {
  desert: 1,
  forest: 1.2,
  hills: 1.3,
  mountains: 1.6,
  plains: 1,
  tundra: 1.1,
} satisfies Readonly<Record<Terrain, number>>;

/**
 * The share of its template's cohesion a regrouping division recovers before
 * it goes back to the line. The share is this game's own.
 */
const REGROUPED_SHARE = 0.8;

/** Whether a regrouping division has recovered enough to go back to the line. */
export const regroupedEnough = (division: Division): boolean =>
  division.organisation >=
  TEMPLATES[division.kind].organisation * REGROUPED_SHARE;

/** Cohesion a division out of contact recovers in a day. */
const ORGANISATION_PER_DAY = 3;

export const marchDaysFor = (terrain: Terrain): number => MARCH_DAYS[terrain];

export const terrainDefenceOf = (terrain: Terrain): number =>
  TERRAIN_DEFENCE[terrain];

/** A division fresh from the depots, standing where it was raised. */
export const raisedAt = (nation: number, province: number): Division => ({
  arrival: "march",
  entrenchment: 0,
  kind: "infantry",
  marched: 0,
  movingTo: province,
  nation,
  organisation: TEMPLATES.infantry.organisation,
  planning: 0,
  province,
  strength: TEMPLATES.infantry.manpower,
  task: "line",
});

/** The men it takes to raise `count` divisions. */
export const menFor = (count: number): number =>
  count * TEMPLATES.infantry.manpower;

/** Whether the nation has the men and the weapons for another division. */
export const canRaise = (economy: NationEconomy): boolean =>
  economy.manpower >= TEMPLATES.infantry.manpower &&
  economy.equipment >= TEMPLATES.infantry.equipment;

/** The economy with one division's men called up and its weapons taken out. */
export const paidForDivision = (economy: NationEconomy): NationEconomy => ({
  ...economy,
  equipment: economy.equipment - TEMPLATES.infantry.equipment,
  manpower: economy.manpower - TEMPLATES.infantry.manpower,
  recruited: economy.recruited + TEMPLATES.infantry.manpower,
});

/** The divisions a nation raises, and its economy after paying for them. */
export interface Levy {
  readonly divisions: readonly Division[];
  readonly economy: NationEconomy;
}

/** What a nation raises out of `economy` when it musters at `home`. */
export type Levied = (
  economy: NationEconomy,
  nation: Nation,
  home: number
) => Levy;

/**
 * A day of the depots: one division standing at `home` where the nation can
 * afford it, none where it cannot.
 */
export const dailyLevy: Levied = (economy, nation, home) => {
  if (!canRaise(economy)) {
    return { divisions: [], economy };
  }
  return {
    divisions: [raisedAt(nation.id, home)],
    economy: paidForDivision(economy),
  };
};

/**
 * The share of its manpower a nation of each leaning already has under arms
 * when the world opens. The shares are this game's own.
 */
const OPENING_ARMY_SHARE = {
  army: 0.25,
  industry: 0.15,
  navy: 0.15,
} satisfies Readonly<Record<Nation["leaning"], number>>;

/** How many divisions a nation of `leaning` with `manpower` opens the world with. */
export const openingDivisionCount = (
  manpower: number,
  leaning: Nation["leaning"]
): number =>
  Math.floor(
    (manpower * OPENING_ARMY_SHARE[leaning]) / TEMPLATES.infantry.manpower
  );

/**
 * The economy with the men of `count` divisions raised before the world
 * opened called up. Their weapons were built before the world opened, so
 * they cost none of its equipment.
 */
export const calledUpFor = (
  economy: NationEconomy,
  count: number
): NationEconomy => ({
  ...economy,
  manpower: economy.manpower - menFor(count),
  recruited: economy.recruited + menFor(count),
});

/** The men in a set of divisions, all of them together. */
export const strengthOf = (divisions: readonly Division[]): number =>
  divisions.reduce((total, division) => total + division.strength, 0);

/** How much of its full self a division still is, from 0 to 1. */
const fitnessOf = (division: Division): number =>
  division.strength / TEMPLATES[division.kind].manpower;

/** What a division does in a battle: attack, or hold the ground it stands on. */
type Role = "attack" | "defence";

/** Every generation of infantry equipment, named by the technology that unlocks it, the oldest first. */
const InfantryEquipmentSchema = Schema.Literals([
  "basic-infantry-equipment",
  "infantry-equipment-1",
  "infantry-equipment-2",
  "infantry-equipment-3",
]);

export type InfantryEquipment = typeof InfantryEquipmentSchema.Type;

export const INFANTRY_EQUIPMENT = InfantryEquipmentSchema.literals;

/** What one generation of infantry equipment puts into a battle. */
interface Weapons {
  readonly softAttack: number;
  readonly defence: number;
}

/** Hearts of Iron IV's infantry equipment, from the 1918 kit to the 1942 one. */
const WEAPONS = {
  "basic-infantry-equipment": { defence: 20, softAttack: 3 },
  "infantry-equipment-1": { defence: 22, softAttack: 6 },
  "infantry-equipment-2": { defence: 28, softAttack: 9 },
  "infantry-equipment-3": { defence: 34, softAttack: 12 },
} satisfies Readonly<Record<InfantryEquipment, Weapons>>;

/** The equipment the template's attack and defence are set against. */
const TEMPLATE_WEAPONS = WEAPONS["infantry-equipment-1"];

/** The share of the template's worth in `role` that `equipment` gives a division. */
const equipmentShare = (equipment: InfantryEquipment, role: Role): number => {
  const weapons = WEAPONS[equipment];
  if (role === "attack") {
    return weapons.softAttack / TEMPLATE_WEAPONS.softAttack;
  }
  return weapons.defence / TEMPLATE_WEAPONS.defence;
};

/**
 * The newest infantry equipment among `researched`, which every division of
 * the nation fights with, and the 1918 kit where none is.
 */
export const infantryEquipmentOf = (
  researched: ReadonlySet<string>
): InfantryEquipment =>
  lastWhere(
    INFANTRY_EQUIPMENT,
    (equipment) => researched.has(equipment),
    "basic-infantry-equipment"
  );

/**
 * What a division fights with beyond its own men: its nation's modifiers and
 * equipment, and its supply.
 */
export interface Backing {
  readonly modifiers: Modifiers;
  readonly equipment: InfantryEquipment;
  /** The share of what it needs the division gets, from 0 to 1. */
  readonly fill: number;
  /** The share of its worth the enemy's air superiority overhead leaves it, from 0 to 1. */
  readonly air: number;
  /** The share it adds to its attack and defence from what its nation knows of the enemy. */
  readonly insight: number;
}

/** What a division fighting with no supply at all is still worth. */
const UNSUPPLIED_WORTH = 0.3;

/** The share of a full day's worth that `fill` leaves a division. */
const suppliedWorth = (fill: number): number =>
  UNSUPPLIED_WORTH + (1 - UNSUPPLIED_WORTH) * fill;

/** How much of its planning bonus a division brings to each role: all of it to an attack. */
const PLANNING_BY_ROLE = {
  attack: 1,
  defence: 0,
} satisfies Readonly<Record<Role, number>>;

/** What a division is worth in a day of battle in `role`. */
const worthIn = (division: Division, backing: Backing, role: Role): number =>
  fitnessOf(division) *
  (1 + entrenchedShare(division)) *
  (1 + division.planning * PLANNING_BY_ROLE[role]) *
  TEMPLATES[division.kind][role] *
  equipmentShare(backing.equipment, role) *
  (1 + backing.modifiers[role]) *
  suppliedWorth(backing.fill) *
  backing.air *
  (1 + backing.insight);

/**
 * The share of its attack a division keeps while it fights off a beach, after
 * Hearts of Iron IV's 50% penalty to a landing's attack.
 */
const ATTACK_KEPT_BY = {
  landing: 0.5,
  march: 1,
} satisfies Readonly<Record<Arrival, number>>;

/** What a division is worth in a day of attacking. */
export const attackOf = (division: Division, backing: Backing): number =>
  worthIn(division, backing, "attack") * ATTACK_KEPT_BY[division.arrival];

/** What it is worth in a day of holding the ground it stands on. */
export const defenceOf = (division: Division, backing: Backing): number =>
  worthIn(division, backing, "defence");

/**
 * The division with a day of rest behind it, up to its template's cohesion as
 * its nation's doctrine raises it, recovering as fast as the doctrine lets it
 * and only as far as its supply does: a division with none recovers nothing.
 */
export const rested = (division: Division, backing: Backing): Division => ({
  ...division,
  organisation: Math.min(
    TEMPLATES[division.kind].organisation *
      (1 + backing.modifiers.organisation),
    division.organisation +
      ORGANISATION_PER_DAY * (1 + backing.modifiers.recovery) * backing.fill
  ),
});

/** The share of a full division's men lost in a day with no supply at all. */
const ATTRITION_PER_DAY = 0.005;

/** The division with a day of whatever its supply falls short by worn off its men. */
export const worn = (division: Division, fill: number): Division => ({
  ...division,
  strength: Math.max(
    0,
    division.strength -
      TEMPLATES[division.kind].manpower * ATTRITION_PER_DAY * (1 - fill)
  ),
});

/** How many divisions each nation has in the field, by nation id. */
export const fieldedBy = (
  divisions: readonly Division[],
  nations: number
): readonly number[] =>
  Array.from(
    { length: nations },
    (_, nation) =>
      divisions.filter((division) => division.nation === nation).length
  );
