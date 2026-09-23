import type { NationEconomy } from "./economy";
import type { Modifiers } from "./modifiers";
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

/** Cohesion a division out of contact recovers in a day. */
const ORGANISATION_PER_DAY = 3;

export const marchDaysFor = (terrain: Terrain): number => MARCH_DAYS[terrain];

export const terrainDefenceOf = (terrain: Terrain): number =>
  TERRAIN_DEFENCE[terrain];

/** A division fresh from the depots, standing where it was raised. */
export const raisedAt = (nation: number, province: number): Division => ({
  kind: "infantry",
  marched: 0,
  movingTo: province,
  nation,
  organisation: TEMPLATES.infantry.organisation,
  province,
  strength: TEMPLATES.infantry.manpower,
});

/** Whether the nation has the men and the weapons for another division. */
export const canRaise = (economy: NationEconomy): boolean =>
  economy.manpower >= TEMPLATES.infantry.manpower &&
  economy.equipment >= TEMPLATES.infantry.equipment;

/** The economy with one division's men and weapons taken out of it. */
export const paidForDivision = (economy: NationEconomy): NationEconomy => ({
  ...economy,
  equipment: economy.equipment - TEMPLATES.infantry.equipment,
  manpower: economy.manpower - TEMPLATES.infantry.manpower,
});

/** The men in a set of divisions, all of them together. */
export const strengthOf = (divisions: readonly Division[]): number =>
  divisions.reduce((total, division) => total + division.strength, 0);

/** How much of its full self a division still is, from 0 to 1. */
const fitnessOf = (division: Division): number =>
  division.strength / TEMPLATES[division.kind].manpower;

/** What a division fights with beyond its own men: its nation's modifiers and its supply. */
export interface Backing {
  readonly modifiers: Modifiers;
  /** The share of what it needs the division gets, from 0 to 1. */
  readonly fill: number;
}

/** What a division fighting with no supply at all is still worth. */
const UNSUPPLIED_WORTH = 0.3;

/** The share of a full day's worth that `fill` leaves a division. */
const suppliedWorth = (fill: number): number =>
  UNSUPPLIED_WORTH + (1 - UNSUPPLIED_WORTH) * fill;

/** What a division does in a battle: attack, or hold the ground it stands on. */
type Role = "attack" | "defence";

/** What a division is worth in a day of battle in `role`. */
const worthIn = (division: Division, backing: Backing, role: Role): number =>
  fitnessOf(division) *
  TEMPLATES[division.kind][role] *
  (1 + backing.modifiers[role]) *
  suppliedWorth(backing.fill);

/** What a division is worth in a day of attacking. */
export const attackOf = (division: Division, backing: Backing): number =>
  worthIn(division, backing, "attack");

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
