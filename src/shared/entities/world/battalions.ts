import type { Terrain } from "./geography/terrain";

/** Every line battalion a division is built from, after Hearts of Iron IV's. */
export type Battalion =
  | "infantry"
  | "cavalry"
  | "motorized"
  | "mechanized"
  | "light-armour"
  | "medium-armour"
  | "heavy-armour"
  | "mountaineers"
  | "marines"
  | "paratroopers";

/** Where a battalion fights: on a terrain, or off the transports onto a beach. */
export type Ground = Terrain | "amphibious";

/** What a battalion's modifiers add on one ground, as shares of its own values. */
interface GroundModifier {
  readonly attack: number;
  readonly defence: number;
  readonly movement: number;
}

/** What a battalion puts into a battle before its terrain modifies it. */
export interface Arms {
  readonly softAttack: number;
  readonly defence: number;
}

/** Whether a battalion fights with its nation's infantry equipment on top of its own. */
type Rifles = "carried" | "none";

/** What one battalion takes to raise and what it can do. */
interface BattalionStats {
  readonly manpower: number;
  /** The cohesion it holds at full strength. */
  readonly organisation: number;
  /** How fast it recovers its cohesion, as Hearts of Iron IV's default morale. */
  readonly recovery: number;
  /** How fast its slowest equipment moves, in kilometres an hour. */
  readonly speed: number;
  /** The supply it uses a day. */
  readonly supply: number;
  /** What its equipment costs a military factory, in industrial capacity. */
  readonly cost: number;
  readonly rifles: Rifles;
  /** What its equipment other than the infantry equipment adds. */
  readonly vehicles: Arms;
  /** The share its battalion adds to the soft attack of its equipment. */
  readonly softAttackBonus: number;
  readonly terrain: Partial<Readonly<Record<Ground, Partial<GroundModifier>>>>;
}

/** What 100 infantry equipment costs, which every battalion that carries it pays. */
const RIFLES_COST = 100 * 0.5;

/** What 35 trucks cost a motorized battalion. */
const TRUCKS_COST = 35 * 2.5;

const NO_VEHICLES: Arms = { defence: 0, softAttack: 0 };

/**
 * Hearts of Iron IV's line battalions: their men, cohesion, speed, supply and
 * terrain modifiers as its 1.12 files set them, and their equipment's attack,
 * defence, speed and cost as its 1.7 files did, the last to give tanks fixed
 * stats rather than a designer's modules. Its jungle, marsh, river, urban and
 * fort modifiers are left out, because this world has none of those.
 */
const BATTALIONS = {
  cavalry: {
    cost: 120 * 0.5,
    manpower: 1000,
    organisation: 70,
    recovery: 0.3,
    rifles: "carried",
    softAttackBonus: 0,
    speed: 4 * 1.6,
    supply: 0.12,
    terrain: {
      amphibious: { attack: -0.4 },
      forest: { attack: -0.05 },
      hills: { attack: -0.05 },
      mountains: { attack: -0.1, movement: -0.05 },
    },
    vehicles: NO_VEHICLES,
  },
  "heavy-armour": {
    cost: 40 * 25,
    manpower: 500,
    organisation: 10,
    recovery: 0.3,
    rifles: "none",
    softAttackBonus: 0,
    speed: 5,
    supply: 0.32,
    terrain: {
      amphibious: { attack: -0.9 },
      forest: { attack: -0.4, movement: -0.4 },
      hills: { attack: -0.2 },
      mountains: { attack: -0.3 },
    },
    vehicles: { defence: 6, softAttack: 15 },
  },
  infantry: {
    cost: RIFLES_COST,
    manpower: 1000,
    organisation: 60,
    recovery: 0.3,
    rifles: "carried",
    softAttackBonus: 0,
    speed: 4,
    supply: 0.06,
    terrain: {},
    vehicles: NO_VEHICLES,
  },
  "light-armour": {
    cost: 60 * 8,
    manpower: 500,
    organisation: 10,
    recovery: 0.3,
    rifles: "none",
    softAttackBonus: 0,
    speed: 10,
    supply: 0.22,
    terrain: {
      amphibious: { attack: -0.4 },
      forest: { attack: -0.2, movement: -0.4 },
      mountains: { attack: -0.1 },
    },
    vehicles: { defence: 4, softAttack: 13 },
  },
  marines: {
    cost: 150 * 0.5,
    manpower: 1000,
    organisation: 70,
    recovery: 0.4,
    rifles: "carried",
    softAttackBonus: 0,
    speed: 4,
    supply: 0.05,
    terrain: { amphibious: { attack: 0.5 } },
    vehicles: NO_VEHICLES,
  },
  mechanized: {
    cost: RIFLES_COST + 40 * 8,
    manpower: 1200,
    organisation: 60,
    recovery: 0.3,
    rifles: "carried",
    softAttackBonus: 0.1,
    speed: 8,
    supply: 0.14,
    terrain: {
      amphibious: { attack: -0.4 },
      forest: { attack: -0.2 },
      mountains: { attack: -0.05 },
    },
    vehicles: { defence: 26, softAttack: 0 },
  },
  "medium-armour": {
    cost: 50 * 12,
    manpower: 500,
    organisation: 10,
    recovery: 0.3,
    rifles: "none",
    softAttackBonus: 0,
    speed: 8,
    supply: 0.25,
    terrain: {
      amphibious: { attack: -0.8 },
      forest: { attack: -0.3, movement: -0.4 },
      hills: { attack: -0.1 },
      mountains: { attack: -0.2 },
    },
    vehicles: { defence: 5, softAttack: 19 },
  },
  motorized: {
    cost: RIFLES_COST + TRUCKS_COST,
    manpower: 1200,
    organisation: 60,
    recovery: 0.3,
    rifles: "carried",
    softAttackBonus: 0,
    speed: 12,
    supply: 0.065,
    terrain: {
      amphibious: { attack: -0.2 },
      forest: { attack: -0.1, movement: -0.5 },
      mountains: { attack: -0.05 },
    },
    vehicles: NO_VEHICLES,
  },
  mountaineers: {
    cost: 140 * 0.5,
    manpower: 1000,
    organisation: 70,
    recovery: 0.4,
    rifles: "carried",
    softAttackBonus: 0,
    speed: 4,
    supply: 0.05,
    terrain: {
      hills: { attack: 0.2, defence: 0.05, movement: 0.1 },
      mountains: { attack: 0.35, defence: 0.1, movement: 0.2 },
    },
    vehicles: NO_VEHICLES,
  },
  paratroopers: {
    cost: 130 * 0.5,
    manpower: 1000,
    organisation: 70,
    recovery: 0.4,
    rifles: "carried",
    softAttackBonus: 0,
    speed: 4,
    supply: 0.05,
    terrain: {},
    vehicles: NO_VEHICLES,
  },
} satisfies Readonly<Record<Battalion, BattalionStats>>;

export const battalionOf = (battalion: Battalion): BattalionStats =>
  BATTALIONS[battalion];

/** What `battalion`'s modifiers add on `ground`, nothing where it has none there. */
export const groundModifierOf = (
  battalion: Battalion,
  ground: Ground
): GroundModifier => ({
  attack: 0,
  defence: 0,
  movement: 0,
  ...battalionOf(battalion).terrain[ground],
});

/** What `battalion` fights with, carrying `rifles` where it carries infantry equipment. */
export const armsOf = (battalion: Battalion, rifles: Arms): Arms => {
  const stats = battalionOf(battalion);
  const carried = Number(stats.rifles === "carried");
  return {
    defence: carried * rifles.defence + stats.vehicles.defence,
    softAttack:
      (carried * rifles.softAttack + stats.vehicles.softAttack) *
      (1 + stats.softAttackBonus),
  };
};
