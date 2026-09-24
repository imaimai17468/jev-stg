import { Schema } from "effect";
import type { Arms, Battalion, Ground } from "./battalions";
import { armsOf, battalionOf, groundModifierOf } from "./battalions";
import type { NationEconomy } from "./economy";
import type { Leaning } from "./leaning";
import { itemAt, lastWhere } from "./lookup";
import type { Modifiers } from "./modifiers";
import type { Nation } from "./nations";
import { entrenchedShare } from "./preparation";
import type { Terrain } from "./terrain";

/** Every kind of division a nation raises, named by the line battalions it is built around. */
const DivisionKindSchema = Schema.Literals([
  "infantry",
  "cavalry",
  "motorized",
  "mechanized",
  "light-armour",
  "medium-armour",
  "heavy-armour",
  "mountaineers",
  "marines",
  "paratroopers",
]);

export type DivisionKind = typeof DivisionKindSchema.Type;

const DIVISION_KINDS = DivisionKindSchema.literals;

/** One line of battalions in a division, and how many of them it holds. */
interface Line {
  readonly battalion: Battalion;
  readonly count: number;
}

/**
 * The battalions each kind is built from: ten of its own line, and an armoured
 * division's tanks alongside as many motorized battalions, the way Hearts of
 * Iron IV's armoured templates carry infantry that keeps up with the tanks.
 * The counts are this game's own.
 */
const COMPOSITIONS = {
  cavalry: [{ battalion: "cavalry", count: 10 }],
  "heavy-armour": [
    { battalion: "heavy-armour", count: 5 },
    { battalion: "motorized", count: 5 },
  ],
  infantry: [{ battalion: "infantry", count: 10 }],
  "light-armour": [
    { battalion: "light-armour", count: 5 },
    { battalion: "motorized", count: 5 },
  ],
  marines: [{ battalion: "marines", count: 10 }],
  mechanized: [{ battalion: "mechanized", count: 10 }],
  "medium-armour": [
    { battalion: "medium-armour", count: 5 },
    { battalion: "motorized", count: 5 },
  ],
  motorized: [{ battalion: "motorized", count: 10 }],
  mountaineers: [{ battalion: "mountaineers", count: 10 }],
  paratroopers: [{ battalion: "paratroopers", count: 10 }],
} satisfies Readonly<Record<DivisionKind, readonly Line[]>>;

/** The total over `kind`'s battalions of what `read` takes from each. */
const summedOver = (
  kind: DivisionKind,
  read: (battalion: Battalion) => number
): number =>
  COMPOSITIONS[kind].reduce(
    (total, { battalion, count }) => total + count * read(battalion),
    0
  );

/** The average over `kind`'s battalions of what `read` takes from each. */
const averagedOver = (
  kind: DivisionKind,
  read: (battalion: Battalion) => number
): number => summedOver(kind, read) / summedOver(kind, () => 1);

/**
 * This world's men for one of Hearts of Iron IV's, which keeps an infantry
 * division of ten battalions at the 20,000 men it was raised with before its
 * battalions were counted.
 */
const MEN_PER_BATTALION_MAN = 2;

/** This world's equipment for one industrial capacity, which keeps that division at 1,000. */
const EQUIPMENT_PER_COST = 2;

/** The men it takes to raise a division of `kind`, and the most it ever holds. */
const manpowerOf = (kind: DivisionKind): number =>
  summedOver(kind, (battalion) => battalionOf(battalion).manpower) *
  MEN_PER_BATTALION_MAN;

/** The equipment it takes to raise a division of `kind`. */
const equipmentOf = (kind: DivisionKind): number =>
  summedOver(kind, (battalion) => battalionOf(battalion).cost) *
  EQUIPMENT_PER_COST;

/** The cohesion a division of `kind` starts a battle with and falls back without. */
const organisationOf = (kind: DivisionKind): number =>
  averagedOver(kind, (battalion) => battalionOf(battalion).organisation);

/** How fast a division of `kind` recovers its cohesion against an infantry division. */
const recoveryOf = (kind: DivisionKind): number =>
  averagedOver(kind, (battalion) => battalionOf(battalion).recovery) /
  battalionOf("infantry").recovery;

/** The supply a division of `kind` uses, counted in infantry divisions. */
export const supplyUseOf = (kind: DivisionKind): number =>
  summedOver(kind, (battalion) => battalionOf(battalion).supply) /
  summedOver("infantry", (battalion) => battalionOf(battalion).supply);

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
 * The share of its kind's cohesion a regrouping division recovers before
 * it goes back to the line. The share is this game's own.
 */
const REGROUPED_SHARE = 0.8;

/** Whether a regrouping division has recovered enough to go back to the line. */
export const regroupedEnough = (division: Division): boolean =>
  division.organisation >= organisationOf(division.kind) * REGROUPED_SHARE;

/** Cohesion an infantry division out of contact recovers in a day. */
const ORGANISATION_PER_DAY = 3;

/**
 * The days it takes a division of `kind` to walk into a province of
 * `terrain`: an infantry division's days, cut by how much faster its slowest
 * battalion moves there.
 */
export const marchDaysFor = (kind: DivisionKind, terrain: Terrain): number => {
  const infantry = battalionOf("infantry").speed;
  const slowest = Math.min(
    ...COMPOSITIONS[kind].map(
      ({ battalion }) =>
        battalionOf(battalion).speed *
        (1 + groundModifierOf(battalion, terrain).movement)
    )
  );
  return (MARCH_DAYS[terrain] * infantry) / slowest;
};

export const terrainDefenceOf = (terrain: Terrain): number =>
  TERRAIN_DEFENCE[terrain];

/** A division of `kind` fresh from the depots, standing where it was raised. */
export const raisedAt = (
  nation: number,
  province: number,
  kind: DivisionKind
): Division => ({
  arrival: "march",
  entrenchment: 0,
  kind,
  marched: 0,
  movingTo: province,
  nation,
  organisation: organisationOf(kind),
  planning: 0,
  province,
  strength: manpowerOf(kind),
  task: "line",
});

/** The men it takes to raise `count` infantry divisions. */
export const menFor = (count: number): number => count * manpowerOf("infantry");

/** Whether the nation has the men and the weapons for another division of `kind`. */
export const canRaise = (economy: NationEconomy, kind: DivisionKind): boolean =>
  economy.manpower >= manpowerOf(kind) &&
  economy.equipment >= equipmentOf(kind);

/** The economy with one division of `kind`'s men called up and its weapons taken out. */
export const paidForDivision = (
  economy: NationEconomy,
  kind: DivisionKind
): NationEconomy => ({
  ...economy,
  equipment: economy.equipment - equipmentOf(kind),
  manpower: economy.manpower - manpowerOf(kind),
  recruited: economy.recruited + manpowerOf(kind),
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
 * How many divisions of each kind a nation of each leaning raises for every
 * ten: mostly infantry, with the fast and the specialist divisions a 1936
 * army could raise, where its leaning puts them. The mixes are this game's own.
 */
const ARMY_MIX = {
  army: {
    cavalry: 1,
    infantry: 6,
    "light-armour": 1,
    motorized: 1,
    mountaineers: 1,
  },
  industry: { infantry: 6, "light-armour": 1, motorized: 2, mountaineers: 1 },
  navy: { infantry: 6, "light-armour": 1, marines: 2, motorized: 1 },
} satisfies Readonly<
  Record<Leaning, Partial<Readonly<Record<DivisionKind, number>>>>
>;

/** How many of every ten divisions a nation of `leaning` raises as `kind`, none where its mix has none. */
const mixShareOf = (leaning: Leaning, kind: DivisionKind): number => {
  const mix: Partial<Readonly<Record<DivisionKind, number>>> =
    ARMY_MIX[leaning];
  return mix[kind] ?? 0;
};

/**
 * The kind a nation of `leaning` raises next, with `fielded` divisions of
 * each kind already in the field: the one furthest short of its share of the
 * mix once the next is counted in, the earlier kind first on a tie. The
 * shortfalls are compared as whole numbers of the mix's parts, so a tie stays
 * a tie.
 */
export const nextKindFor = (
  leaning: Leaning,
  fielded: ReadonlyMap<DivisionKind, number>
): DivisionKind => {
  const total = [...fielded.values()].reduce((sum, count) => sum + count, 1);
  const mixed = DIVISION_KINDS.reduce(
    (sum, kind) => sum + mixShareOf(leaning, kind),
    0
  );
  const shortOf = (kind: DivisionKind): number =>
    mixShareOf(leaning, kind) * total - (fielded.get(kind) ?? 0) * mixed;
  return itemAt(
    DIVISION_KINDS.toSorted((one, other) => shortOf(other) - shortOf(one)),
    0,
    "infantry"
  );
};

/** How many divisions of each kind `nation` has among `divisions`. */
const fieldedKindsOf = (
  divisions: readonly Division[],
  nation: number
): ReadonlyMap<DivisionKind, number> => {
  const fielded = new Map<DivisionKind, number>();
  for (const division of divisions) {
    if (division.nation !== nation) {
      continue;
    }
    fielded.set(division.kind, (fielded.get(division.kind) ?? 0) + 1);
  }
  return fielded;
};

/**
 * A day of the depots beside `divisions` already in the field: one division
 * of the kind its mix is shortest of standing at `home` where the nation can
 * afford it, and none where it cannot, so the weapons for a costly division
 * are saved up rather than spent on a cheaper one.
 */
export const dailyLevyBeside =
  (divisions: readonly Division[]): Levied =>
  (economy, nation, home) => {
    const kind = nextKindFor(
      nation.leaning,
      fieldedKindsOf(divisions, nation.id)
    );
    if (!canRaise(economy, kind)) {
      return { divisions: [], economy };
    }
    return {
      divisions: [raisedAt(nation.id, home, kind)],
      economy: paidForDivision(economy, kind),
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
} satisfies Readonly<Record<Leaning, number>>;

/**
 * The kinds of the divisions a nation of `leaning` with `manpower` opens the
 * world with: as many as its opening share of the men raises, each the kind
 * its mix is shortest of once the ones before it are raised.
 */
export const openingKindsOf = (
  manpower: number,
  leaning: Leaning
): readonly DivisionKind[] => {
  const kinds: DivisionKind[] = [];
  const fielded = new Map<DivisionKind, number>();
  let men = manpower * OPENING_ARMY_SHARE[leaning];
  let kind = nextKindFor(leaning, fielded);
  while (manpowerOf(kind) <= men) {
    men -= manpowerOf(kind);
    kinds.push(kind);
    fielded.set(kind, (fielded.get(kind) ?? 0) + 1);
    kind = nextKindFor(leaning, fielded);
  }
  return kinds;
};

/**
 * The economy with the men of the divisions of `kinds` raised before the
 * world opened called up. Their weapons were built before the world opened,
 * so they cost none of its equipment.
 */
export const calledUpFor = (
  economy: NationEconomy,
  kinds: readonly DivisionKind[]
): NationEconomy => {
  const men = kinds.reduce((total, kind) => total + manpowerOf(kind), 0);
  return {
    ...economy,
    manpower: economy.manpower - men,
    recruited: economy.recruited + men,
  };
};

/** The men in a set of divisions, all of them together. */
export const strengthOf = (divisions: readonly Division[]): number =>
  divisions.reduce((total, division) => total + division.strength, 0);

/** How much of its full self a division still is, from 0 to 1. */
const fitnessOf = (division: Division): number =>
  division.strength / manpowerOf(division.kind);

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

/** Hearts of Iron IV's infantry equipment, from the 1918 kit to the 1942 one. */
const WEAPONS = {
  "basic-infantry-equipment": { defence: 20, softAttack: 3 },
  "infantry-equipment-1": { defence: 22, softAttack: 6 },
  "infantry-equipment-2": { defence: 28, softAttack: 9 },
  "infantry-equipment-3": { defence: 34, softAttack: 12 },
} satisfies Readonly<Record<InfantryEquipment, Arms>>;

/** What each role reads off the arms a battalion fights with. */
const ROLE_STAT = {
  attack: "softAttack",
  defence: "defence",
} satisfies Readonly<Record<Role, keyof Arms>>;

/**
 * The share a division's attack loses while it fights off a beach, after
 * Hearts of Iron IV's 50% penalty to a landing's attack, and the ground whose
 * modifiers it fights on besides the terrain.
 */
const LANDING = {
  landing: { grounds: ["amphibious"], penalty: 0.5 },
  march: { grounds: [], penalty: 0 },
} satisfies Readonly<
  Record<
    Arrival,
    { readonly grounds: readonly Ground[]; readonly penalty: number }
  >
>;

/**
 * What the battalions of `kind` put into `role` fighting with `rifles` on
 * every one of `grounds`, each battalion's arms raised by its modifiers
 * there and cut by `penalty`, and never below nothing.
 */
const armedWorth = (
  kind: DivisionKind,
  rifles: Arms,
  role: Role,
  grounds: readonly Ground[],
  penalty: number
): number =>
  summedOver(
    kind,
    (battalion) =>
      armsOf(battalion, rifles)[ROLE_STAT[role]] *
      Math.max(
        0,
        1 -
          penalty +
          grounds.reduce(
            (total, ground) =>
              total + groundModifierOf(battalion, ground)[role],
            0
          )
      )
  );

/**
 * What a full, supplied 1936 infantry division is worth in each role, which
 * is what this world's battles were balanced on before a division's worth was
 * read off its battalions.
 */
const INFANTRY_WORTH = {
  attack: 6,
  defence: 10,
} satisfies Readonly<Record<Role, number>>;

/** What that 1936 infantry division's battalions put into each role. */
const INFANTRY_ARMED = {
  attack: armedWorth(
    "infantry",
    WEAPONS["infantry-equipment-1"],
    "attack",
    [],
    0
  ),
  defence: armedWorth(
    "infantry",
    WEAPONS["infantry-equipment-1"],
    "defence",
    [],
    0
  ),
} satisfies Readonly<Record<Role, number>>;

/**
 * What a division of `kind` is worth in `role` on `terrain`, arriving by
 * `arrival`, with `equipment` for its rifles, against a 1936 infantry
 * division standing on open ground.
 */
const templateWorth = (
  kind: DivisionKind,
  equipment: InfantryEquipment,
  role: Role,
  terrain: Terrain,
  arrival: Arrival
): number => {
  const landing = LANDING[arrival];
  const penalty = landing.penalty * Number(role === "attack");
  const grounds = [terrain, ...landing.grounds.filter(() => role === "attack")];
  return (
    (INFANTRY_WORTH[role] *
      armedWorth(kind, WEAPONS[equipment], role, grounds, penalty)) /
    INFANTRY_ARMED[role]
  );
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

/** What a division is worth in a day of battle in `role` on `terrain`. */
const worthIn = (
  division: Division,
  backing: Backing,
  role: Role,
  terrain: Terrain
): number =>
  fitnessOf(division) *
  (1 + entrenchedShare(division)) *
  (1 + division.planning * PLANNING_BY_ROLE[role]) *
  templateWorth(
    division.kind,
    backing.equipment,
    role,
    terrain,
    division.arrival
  ) *
  (1 + backing.modifiers[role]) *
  suppliedWorth(backing.fill) *
  backing.air *
  (1 + backing.insight);

/** What a division is worth in a day of one role on ground of `terrain`. */
type Worth = (division: Division, backing: Backing, terrain: Terrain) => number;

/** What a division is worth in a day of attacking into `terrain`. */
export const attackOf: Worth = (division, backing, terrain) =>
  worthIn(division, backing, "attack", terrain);

/** What it is worth in a day of holding ground of `terrain`. */
export const defenceOf: Worth = (division, backing, terrain) =>
  worthIn(division, backing, "defence", terrain);

/**
 * The division with a day of rest behind it, up to its kind's cohesion as
 * its nation's doctrine raises it, recovering as fast as its battalions and
 * the doctrine let it and only as far as its supply does: a division with
 * none recovers nothing.
 */
export const rested = (division: Division, backing: Backing): Division => ({
  ...division,
  organisation: Math.min(
    organisationOf(division.kind) * (1 + backing.modifiers.organisation),
    division.organisation +
      ORGANISATION_PER_DAY *
        recoveryOf(division.kind) *
        (1 + backing.modifiers.recovery) *
        backing.fill
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
      manpowerOf(division.kind) * ATTRITION_PER_DAY * (1 - fill)
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
