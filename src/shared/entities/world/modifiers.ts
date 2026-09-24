import { foldedWith } from "./lookup";
/** Every modifier, in the order a description lists them. */
export const MODIFIERS: readonly Modifier[] = [
  "attack",
  "defence",
  "organisation",
  "recovery",
  "production",
  "dockyards",
  "construction",
  "research",
  "manpower",
  "supply",
  "extraction",
  "refining",
];

/**
 * How much better a nation is at each thing, as a share on top of what it
 * would do without: 0.1 attacks a tenth harder.
 */
export interface Modifiers {
  readonly attack: number;
  /** The share the building slots of every province it holds grow by. */
  readonly buildingSlots: number;
  readonly defence: number;
  /** The cohesion a division rests up to. */
  readonly organisation: number;
  /** How fast a division out of contact gets its cohesion back. */
  readonly recovery: number;
  /** The equipment a military factory turns out. */
  readonly production: number;
  /** What a dockyard puts into a ship. */
  readonly dockyards: number;
  /** What a civilian factory puts into construction. */
  readonly construction: number;
  /** The research-days a slot puts in. */
  readonly research: number;
  /** The share of the people the conscription law reaches. */
  readonly manpower: number;
  /** The divisions a province can keep supplied. */
  readonly supply: number;
  /** The resources a province's deposits give up. */
  readonly extraction: number;
  /** The fuel a unit of oil refines into. */
  readonly refining: number;
}

/** Something a technology or a national focus makes a nation better at. */
export type Modifier = keyof Modifiers;

/** What a technology or a focus adds, naming only what it changes. */
export type Bonus = Partial<Modifiers>;

/** A nation that has researched and pursued nothing yet. */
export const NO_MODIFIERS: Modifiers = {
  attack: 0,
  buildingSlots: 0,
  construction: 0,
  defence: 0,
  dockyards: 0,
  extraction: 0,
  manpower: 0,
  organisation: 0,
  production: 0,
  recovery: 0,
  refining: 0,
  research: 0,
  supply: 0,
};

/** The share `bonus` adds to `modifier`, which is none where it names none. */
export const shareOf = (bonus: Bonus, modifier: Modifier): number =>
  bonus[modifier] ?? 0;

/** `total` with `bonus` added to it. */
const added = (total: Modifiers, bonus: Bonus): Modifiers => ({
  attack: total.attack + shareOf(bonus, "attack"),
  buildingSlots: total.buildingSlots + shareOf(bonus, "buildingSlots"),
  construction: total.construction + shareOf(bonus, "construction"),
  defence: total.defence + shareOf(bonus, "defence"),
  dockyards: total.dockyards + shareOf(bonus, "dockyards"),
  extraction: total.extraction + shareOf(bonus, "extraction"),
  manpower: total.manpower + shareOf(bonus, "manpower"),
  organisation: total.organisation + shareOf(bonus, "organisation"),
  production: total.production + shareOf(bonus, "production"),
  recovery: total.recovery + shareOf(bonus, "recovery"),
  refining: total.refining + shareOf(bonus, "refining"),
  research: total.research + shareOf(bonus, "research"),
  supply: total.supply + shareOf(bonus, "supply"),
});

/** Every one of `bonuses` added together. */
export const summed = (bonuses: readonly Bonus[]): Modifiers =>
  foldedWith(bonuses, NO_MODIFIERS, added);
