import { Schema } from "effect";
import { lastWhere } from "./lookup";
import type { Bonus } from "./modifiers";
import type { ShipClass } from "./ships";

/**
 * The line of the tree a technology sits on, which is what Jev compares one
 * month's research across: each line puts its earliest technology on offer.
 */
const TechLineSchema = Schema.Literals([
  "infantry-weapons",
  "armour",
  "mobile-infantry",
  "special-forces",
  "destroyers",
  "cruisers",
  "battleships",
  "carriers",
  "submarines",
  "naval-armament",
  "fighters",
  "close-support",
  "naval-bombers",
  "industry",
  "construction",
  "fuel",
  "electronics",
]);

export type TechLine = typeof TechLineSchema.Type;

export const TECH_LINES = TechLineSchema.literals;

/**
 * The research category a line belongs to in Hearts of Iron IV, which is what
 * a research bonus such as a stolen blueprint names.
 */
export type TechCategory =
  | "infantry"
  | "armour"
  | "naval"
  | "air"
  | "industry"
  | "electronics";

const CATEGORIES = {
  armour: "armour",
  battleships: "naval",
  carriers: "naval",
  "close-support": "air",
  construction: "industry",
  cruisers: "naval",
  destroyers: "naval",
  electronics: "electronics",
  fighters: "air",
  fuel: "industry",
  industry: "industry",
  "infantry-weapons": "infantry",
  "mobile-infantry": "infantry",
  "naval-armament": "naval",
  "naval-bombers": "air",
  "special-forces": "infantry",
  submarines: "naval",
} satisfies Readonly<Record<TechLine, TechCategory>>;

export const categoryOf = (line: TechLine): TechCategory => CATEGORIES[line];

/** Every technology, in the order the tree lists them. */
export const TechIdSchema = Schema.Literals([
  "basic-infantry-equipment",
  "infantry-equipment-1",
  "improved-infantry-equipment-1",
  "infantry-equipment-2",
  "improved-infantry-equipment-2",
  "infantry-equipment-3",
  "improved-infantry-equipment-3",
  "great-war-tank",
  "light-tank-1",
  "light-tank-2",
  "medium-tank-1",
  "heavy-tank-1",
  "early-truck",
  "truck",
  "mechanized-equipment-1",
  "mountain-infantry-1",
  "marines-1",
  "paratroopers-1",
  "destroyer-1",
  "destroyer-2",
  "destroyer-3",
  "destroyer-4",
  "light-cruiser-1",
  "light-cruiser-2",
  "light-cruiser-3",
  "light-cruiser-4",
  "battleship-1",
  "battleship-2",
  "battleship-3",
  "battleship-4",
  "carrier-1",
  "carrier-2",
  "carrier-3",
  "carrier-4",
  "submarine-1",
  "submarine-2",
  "submarine-3",
  "submarine-4",
  "naval-gunnery",
  "basic-light-battery",
  "basic-medium-battery",
  "basic-heavy-battery",
  "small-caliber-semi-armor-piercing-shell",
  "armor-piercing-capped-medium-shell",
  "armor-piercing-capped-shell",
  "improved-light-battery",
  "improved-medium-battery",
  "improved-heavy-battery",
  "small-caliber-armor-piercing-shell",
  "medium-caliber-semi-armor-piercing-shell",
  "super-heavy-armor-piercing-shell",
  "basic-torpedo",
  "magnetic-detonator",
  "bracket-shooting",
  "ladder-shooting",
  "shell-dyes",
  "interwar-fighter",
  "fighter-1",
  "fighter-2",
  "fighter-3",
  "close-air-support-1",
  "close-air-support-2",
  "close-air-support-3",
  "naval-bomber-1",
  "naval-bomber-2",
  "naval-bomber-3",
  "basic-machine-tools",
  "concentrated-industry-1",
  "concentrated-industry-2",
  "concentrated-industry-3",
  "concentrated-industry-4",
  "concentrated-industry-5",
  "dispersed-industry-1",
  "dispersed-industry-2",
  "dispersed-industry-3",
  "dispersed-industry-4",
  "dispersed-industry-5",
  "construction-1",
  "construction-2",
  "construction-3",
  "construction-4",
  "construction-5",
  "excavation-1",
  "excavation-2",
  "excavation-3",
  "excavation-4",
  "excavation-5",
  "fuel-storage",
  "fuel-refining-1",
  "fuel-refining-2",
  "fuel-refining-3",
  "fuel-refining-4",
  "fuel-refining-5",
  "electronic-mechanical-engineering",
  "mechanical-computing",
  "computing-machine",
  "improved-computing-machine",
  "advanced-computing-machine",
  "atomic-research",
]);

/** One technology a nation can research. */
export type TechId = typeof TechIdSchema.Type;

export const TECH_IDS = TechIdSchema.literals;

/** Which of a warship's weapons a technology improves. */
export type ShipWeapon = "light" | "heavy" | "torpedo";

/** A share a technology adds to one weapon of every warship of one class. */
export interface ShipUpgrade {
  readonly shipClass: ShipClass;
  readonly weapon: ShipWeapon;
  readonly share: number;
}

/** What one technology is and what it takes. */
export interface Tech {
  readonly name: string;
  readonly line: TechLine;
  /** The year it becomes current. Researching it earlier is slower. */
  readonly year: number;
  /** Its research cost, as a multiple of `BASE_TECH_COST` days. */
  readonly cost: number;
  /**
   * The technologies that lead to it, any one of which opens it once
   * researched, as a path does in Hearts of Iron IV. Empty for a root.
   */
  readonly from: readonly TechId[];
  /** Technologies this one rules out, and that rule it out, once either is started. */
  readonly excludes: readonly TechId[];
  readonly bonus: Bonus;
  readonly upgrades: readonly ShipUpgrade[];
}

/** One `share` upgrade to `weapon` for every class in `classes`. */
const upgradesFor = (
  classes: readonly ShipClass[],
  weapon: ShipWeapon,
  share: number
): readonly ShipUpgrade[] =>
  classes.map((shipClass) => ({ share, shipClass, weapon }));

/** The classes Hearts of Iron IV's small-calibre shells reach, leaving out the heavy cruisers and battlecruisers this world has none of. */
const LIGHT_GUNNED: readonly ShipClass[] = [
  "destroyer",
  "cruiser",
  "battleship",
  "carrier",
];

/**
 * A technology that only opens later ones, and the rest of what it adds
 * (a ship module, a building, a production efficiency) has nothing in this
 * world to act on.
 */
const step = (
  name: string,
  line: TechLine,
  year: number,
  cost: number,
  from: readonly TechId[]
): Tech => ({
  bonus: {},
  cost,
  excludes: [],
  from,
  line,
  name,
  upgrades: [],
  year,
});

/**
 * Hearts of Iron IV's technologies as the 1.16 wiki gives them, with the
 * naval and air trees of the game without Man the Guns and By Blood Alone
 * and the armour tree of the game without No Step Back.
 * A technology whose every effect acts on a unit, a building or a mechanic
 * this world lacks is left out, unless one that is in needs it.
 */
const TECHS = {
  "advanced-computing-machine": {
    ...step("高度計算機", "electronics", 1942, 2.5, [
      "improved-computing-machine",
    ]),
    bonus: { research: 0.08 },
  },
  "armor-piercing-capped-medium-shell": {
    ...step("被帽徹甲弾（中口径）", "naval-armament", 1936, 0.5, [
      "basic-medium-battery",
    ]),
    upgrades: upgradesFor(["cruiser"], "light", 0.05),
  },
  "armor-piercing-capped-shell": {
    ...step("被帽徹甲弾（大口径）", "naval-armament", 1936, 0.5, [
      "basic-heavy-battery",
    ]),
    upgrades: upgradesFor(["battleship"], "heavy", 0.05),
  },
  "atomic-research": {
    ...step("原子力研究", "electronics", 1940, 5, []),
    bonus: { research: 0.04 },
  },
  "basic-heavy-battery": step("基本大口径砲", "naval-armament", 1936, 1, [
    "naval-gunnery",
  ]),
  "basic-infantry-equipment": step(
    "基本歩兵装備",
    "infantry-weapons",
    1918,
    1.5,
    []
  ),
  "basic-light-battery": step("基本小口径砲", "naval-armament", 1936, 1, [
    "naval-gunnery",
  ]),
  "basic-machine-tools": step("基本工作機械", "industry", 1936, 1.5, []),
  "basic-medium-battery": step("基本中口径砲", "naval-armament", 1936, 1, [
    "naval-gunnery",
  ]),
  "basic-torpedo": step("基本魚雷", "naval-armament", 1922, 2, []),
  "battleship-1": step("戦艦I", "battleships", 1922, 1.5, []),
  "battleship-2": step("戦艦II", "battleships", 1936, 2, ["battleship-1"]),
  "battleship-3": step("戦艦III", "battleships", 1940, 2, ["battleship-2"]),
  "battleship-4": step("戦艦IV", "battleships", 1944, 2, ["battleship-3"]),
  "bracket-shooting": {
    ...step("夾叉射撃", "naval-armament", 1922, 2.5, []),
    upgrades: [
      ...upgradesFor(["battleship"], "light", 0.05),
      ...upgradesFor(["battleship"], "heavy", 0.05),
    ],
  },
  "carrier-1": step("空母I", "carriers", 1922, 1.5, []),
  "carrier-2": step("空母II", "carriers", 1936, 2, ["carrier-1"]),
  "carrier-3": step("空母III", "carriers", 1940, 2, ["carrier-2"]),
  "carrier-4": step("空母IV", "carriers", 1944, 2, ["carrier-3"]),
  "close-air-support-1": step("近接航空支援機I", "close-support", 1936, 2, [
    "interwar-fighter",
  ]),
  "close-air-support-2": step("近接航空支援機II", "close-support", 1940, 2, [
    "close-air-support-1",
  ]),
  "close-air-support-3": step("近接航空支援機III", "close-support", 1944, 2, [
    "close-air-support-2",
  ]),
  "computing-machine": {
    ...step("計算機", "electronics", 1938, 2.5, ["mechanical-computing"]),
    bonus: { research: 0.05 },
  },
  "concentrated-industry-1": {
    ...step("集中工業I", "industry", 1936, 2, ["basic-machine-tools"]),
    bonus: { buildingSlots: 0.2, dockyards: 0.1, production: 0.15 },
    excludes: ["dispersed-industry-1"],
  },
  "concentrated-industry-2": {
    ...step("集中工業II", "industry", 1937, 2, ["concentrated-industry-1"]),
    bonus: { buildingSlots: 0.2, dockyards: 0.1, production: 0.15 },
  },
  "concentrated-industry-3": {
    ...step("集中工業III", "industry", 1939, 2, ["concentrated-industry-2"]),
    bonus: { buildingSlots: 0.2, dockyards: 0.1, production: 0.15 },
  },
  "concentrated-industry-4": {
    ...step("集中工業IV", "industry", 1941, 2, ["concentrated-industry-3"]),
    bonus: { buildingSlots: 0.2, dockyards: 0.1, production: 0.15 },
  },
  "concentrated-industry-5": {
    ...step("集中工業V", "industry", 1943, 2, ["concentrated-industry-4"]),
    bonus: { buildingSlots: 0.2, dockyards: 0.1, production: 0.15 },
  },
  "construction-1": {
    ...step("建設I", "construction", 1936, 2, []),
    bonus: { construction: 0.1 },
  },
  "construction-2": {
    ...step("建設II", "construction", 1937, 2, ["construction-1"]),
    bonus: { construction: 0.1 },
  },
  "construction-3": {
    ...step("建設III", "construction", 1939, 2, ["construction-2"]),
    bonus: { construction: 0.1 },
  },
  "construction-4": {
    ...step("建設IV", "construction", 1941, 2, ["construction-3"]),
    bonus: { construction: 0.1 },
  },
  "construction-5": {
    ...step("建設V", "construction", 1943, 2, ["construction-4"]),
    bonus: { construction: 0.1 },
  },
  "destroyer-1": step("駆逐艦I", "destroyers", 1922, 1.5, []),
  "destroyer-2": step("駆逐艦II", "destroyers", 1936, 2, ["destroyer-1"]),
  "destroyer-3": step("駆逐艦III", "destroyers", 1940, 2, ["destroyer-2"]),
  "destroyer-4": step("駆逐艦IV", "destroyers", 1944, 2, ["destroyer-3"]),
  "dispersed-industry-1": {
    ...step("分散工業I", "industry", 1936, 2, ["basic-machine-tools"]),
    bonus: { buildingSlots: 0.2, dockyards: 0.1, production: 0.1 },
    excludes: ["concentrated-industry-1"],
  },
  "dispersed-industry-2": {
    ...step("分散工業II", "industry", 1937, 2, ["dispersed-industry-1"]),
    bonus: { buildingSlots: 0.2, dockyards: 0.1, production: 0.1 },
  },
  "dispersed-industry-3": {
    ...step("分散工業III", "industry", 1939, 2, ["dispersed-industry-2"]),
    bonus: { buildingSlots: 0.2, dockyards: 0.1, production: 0.1 },
  },
  "dispersed-industry-4": {
    ...step("分散工業IV", "industry", 1941, 2, ["dispersed-industry-3"]),
    bonus: { buildingSlots: 0.2, dockyards: 0.1, production: 0.1 },
  },
  "dispersed-industry-5": {
    ...step("分散工業V", "industry", 1943, 2, ["dispersed-industry-4"]),
    bonus: { buildingSlots: 0.2, dockyards: 0.1, production: 0.1 },
  },
  "early-truck": step("初期型トラック", "mobile-infantry", 1936, 1.5, []),
  "electronic-mechanical-engineering": {
    ...step("電子機械工学", "electronics", 1936, 1, []),
    bonus: { research: 0.03 },
  },
  "excavation-1": {
    ...step("採掘I", "construction", 1936, 2, ["construction-1"]),
    bonus: { extraction: 0.1 },
  },
  "excavation-2": {
    ...step("採掘II", "construction", 1937, 2, ["construction-2"]),
    bonus: { extraction: 0.1 },
  },
  "excavation-3": {
    ...step("採掘III", "construction", 1939, 2, ["construction-3"]),
    bonus: { extraction: 0.1 },
  },
  "excavation-4": {
    ...step("採掘IV", "construction", 1941, 2, ["construction-4"]),
    bonus: { extraction: 0.1 },
  },
  "excavation-5": {
    ...step("採掘V", "construction", 1943, 2, ["construction-5"]),
    bonus: { extraction: 0.1 },
  },
  "fighter-1": step("戦闘機I", "fighters", 1936, 2, ["interwar-fighter"]),
  "fighter-2": step("戦闘機II", "fighters", 1940, 2, ["fighter-1"]),
  "fighter-3": step("戦闘機III", "fighters", 1944, 2, ["fighter-2"]),
  "fuel-refining-1": {
    ...step("燃料精製I", "fuel", 1936, 3, ["fuel-storage"]),
    bonus: { refining: 0.2 },
  },
  "fuel-refining-2": {
    ...step("燃料精製II", "fuel", 1937, 3, ["fuel-refining-1"]),
    bonus: { refining: 0.2 },
  },
  "fuel-refining-3": {
    ...step("燃料精製III", "fuel", 1939, 3, ["fuel-refining-2"]),
    bonus: { refining: 0.2 },
  },
  "fuel-refining-4": {
    ...step("燃料精製IV", "fuel", 1941, 3, ["fuel-refining-3"]),
    bonus: { refining: 0.2 },
  },
  "fuel-refining-5": {
    ...step("燃料精製V", "fuel", 1943, 3, ["fuel-refining-4"]),
    bonus: { refining: 0.2 },
  },
  "fuel-storage": step("燃料貯蔵", "fuel", 1936, 1, []),
  "great-war-tank": step("第一次大戦型戦車", "armour", 1918, 2, []),
  "heavy-tank-1": step("重戦車I", "armour", 1934, 2, ["great-war-tank"]),
  "improved-computing-machine": {
    ...step("改良計算機", "electronics", 1940, 2.5, ["computing-machine"]),
    bonus: { research: 0.08 },
  },
  "improved-heavy-battery": step("改良大口径砲", "naval-armament", 1939, 1, [
    "armor-piercing-capped-shell",
  ]),
  "improved-infantry-equipment-1": {
    ...step("改良歩兵装備I", "infantry-weapons", 1938, 1.5, [
      "infantry-equipment-1",
    ]),
    bonus: { attack: 0.05 },
  },
  "improved-infantry-equipment-2": {
    ...step("改良歩兵装備II", "infantry-weapons", 1940, 2, [
      "infantry-equipment-2",
    ]),
    bonus: { attack: 0.05 },
  },
  "improved-infantry-equipment-3": {
    ...step("改良歩兵装備III", "infantry-weapons", 1944, 1.5, [
      "infantry-equipment-3",
    ]),
    bonus: { attack: 0.05 },
  },
  "improved-light-battery": step("改良小口径砲", "naval-armament", 1939, 1, [
    "small-caliber-semi-armor-piercing-shell",
  ]),
  "improved-medium-battery": step("改良中口径砲", "naval-armament", 1939, 1, [
    "armor-piercing-capped-medium-shell",
  ]),
  "infantry-equipment-1": step("歩兵装備I", "infantry-weapons", 1936, 1.5, [
    "basic-infantry-equipment",
  ]),
  "infantry-equipment-2": step("歩兵装備II", "infantry-weapons", 1939, 2, [
    "improved-infantry-equipment-1",
  ]),
  "infantry-equipment-3": step("歩兵装備III", "infantry-weapons", 1942, 2, [
    "improved-infantry-equipment-2",
  ]),
  "interwar-fighter": step("戦間期戦闘機", "fighters", 1933, 2, []),
  "ladder-shooting": {
    ...step("交互射撃", "naval-armament", 1922, 2.5, ["bracket-shooting"]),
    upgrades: [
      ...upgradesFor(["battleship"], "light", 0.1),
      ...upgradesFor(["battleship"], "heavy", 0.1),
    ],
  },
  "light-cruiser-1": step("軽巡洋艦I", "cruisers", 1922, 1.5, []),
  "light-cruiser-2": step("軽巡洋艦II", "cruisers", 1936, 2, [
    "light-cruiser-1",
  ]),
  "light-cruiser-3": step("軽巡洋艦III", "cruisers", 1940, 2, [
    "light-cruiser-2",
  ]),
  "light-cruiser-4": step("軽巡洋艦IV", "cruisers", 1944, 2, [
    "light-cruiser-3",
  ]),
  "light-tank-1": step("軽戦車I", "armour", 1934, 2, ["great-war-tank"]),
  "light-tank-2": step("軽戦車II", "armour", 1936, 2, ["light-tank-1"]),
  "magnetic-detonator": {
    ...step("磁気信管", "naval-armament", 1936, 2.5, ["basic-torpedo"]),
    upgrades: upgradesFor(
      ["destroyer", "submarine", "cruiser"],
      "torpedo",
      0.2
    ),
  },
  "marines-1": step("海兵隊I", "special-forces", 1936, 2, []),
  "mechanical-computing": {
    ...step("機械式計算", "electronics", 1936, 2.5, [
      "electronic-mechanical-engineering",
    ]),
    bonus: { research: 0.04 },
  },
  "mechanized-equipment-1": step("機械化装備I", "mobile-infantry", 1940, 2, [
    "truck",
  ]),
  "medium-caliber-semi-armor-piercing-shell": {
    ...step("半徹甲弾（中口径）", "naval-armament", 1942, 0.5, [
      "improved-medium-battery",
    ]),
    upgrades: upgradesFor(["cruiser"], "light", 0.05),
  },
  "medium-tank-1": step("中戦車I", "armour", 1938, 2, ["light-tank-2"]),
  "mountain-infantry-1": step("山岳歩兵I", "special-forces", 1936, 2, []),
  "naval-bomber-1": step("雷撃機I", "naval-bombers", 1936, 2, [
    "interwar-fighter",
  ]),
  "naval-bomber-2": step("雷撃機II", "naval-bombers", 1940, 2, [
    "naval-bomber-1",
  ]),
  "naval-bomber-3": step("雷撃機III", "naval-bombers", 1944, 2, [
    "naval-bomber-2",
  ]),
  "naval-gunnery": step("艦砲術", "naval-armament", 1922, 1, []),
  "paratroopers-1": step("空挺部隊I", "special-forces", 1936, 2, []),
  "shell-dyes": {
    ...step("着色弾", "naval-armament", 1922, 2.5, ["ladder-shooting"]),
    upgrades: [
      ...upgradesFor(["battleship"], "light", 0.15),
      ...upgradesFor(["battleship"], "heavy", 0.15),
      ...upgradesFor(["cruiser"], "light", 0.1),
      ...upgradesFor(["cruiser"], "heavy", 0.1),
      ...upgradesFor(["destroyer"], "light", 0.05),
      ...upgradesFor(["destroyer"], "heavy", 0.05),
    ],
  },
  "small-caliber-armor-piercing-shell": {
    ...step("徹甲弾（小口径）", "naval-armament", 1942, 0.5, [
      "improved-light-battery",
    ]),
    upgrades: upgradesFor(LIGHT_GUNNED, "light", 0.05),
  },
  "small-caliber-semi-armor-piercing-shell": {
    ...step("半徹甲弾（小口径）", "naval-armament", 1936, 0.5, [
      "basic-light-battery",
    ]),
    upgrades: upgradesFor(LIGHT_GUNNED, "light", 0.05),
  },
  "submarine-1": step("潜水艦I", "submarines", 1922, 1.5, []),
  "submarine-2": step("潜水艦II", "submarines", 1936, 2, ["submarine-1"]),
  "submarine-3": step("潜水艦III", "submarines", 1940, 2, ["submarine-2"]),
  "submarine-4": step("潜水艦IV", "submarines", 1944, 2, ["submarine-3"]),
  "super-heavy-armor-piercing-shell": {
    ...step("超重徹甲弾", "naval-armament", 1942, 0.5, [
      "improved-heavy-battery",
    ]),
    upgrades: upgradesFor(["battleship"], "heavy", 0.05),
  },
  truck: step("トラック", "mobile-infantry", 1936, 2, ["early-truck"]),
} satisfies Readonly<Record<TechId, Tech>>;

export const techOf = (tech: TechId): Tech => TECHS[tech];

/**
 * What picks, for a kind of design, the newest of `designs` in the tree's
 * order whose kind `kindOf` gives and whose technology is researched, and
 * the kind's entry in `firsts` where none is.
 */
export const newestPicker =
  <D extends string, K extends string>(
    designs: readonly D[],
    kindOf: (design: D) => K,
    firsts: Readonly<Record<K, D>>
  ) =>
  (researched: ReadonlySet<string>, kind: K): D =>
    lastWhere(
      designs,
      (design) => kindOf(design) === kind && researched.has(design),
      firsts[kind]
    );
