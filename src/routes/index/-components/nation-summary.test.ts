import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { START_ADVANCEMENT } from "@/shared/entities/world/advancement";
import { NO_AIR_FORCE } from "@/shared/entities/world/air-force";
import { airspaceOf } from "@/shared/entities/world/airspace";
import { noQuiet } from "@/shared/entities/world/armistice";
import { START_CLOCK } from "@/shared/entities/world/clock";
import { startCompliance } from "@/shared/entities/world/compliance";
import {
  INDEPENDENT,
  openingDiplomacy,
  warDeclared,
} from "@/shared/entities/world/diplomacy";
import type { NationEconomy } from "@/shared/entities/world/economy";
import { NO_ECONOMY } from "@/shared/entities/world/economy";
import { openingServices } from "@/shared/entities/world/espionage";
import { FULL_SUPPLY_LEVEL } from "@/shared/entities/world/infrastructure";
import { noGleaned } from "@/shared/entities/world/intel";
import { NO_NAVY } from "@/shared/entities/world/navy";
import { noNetworks } from "@/shared/entities/world/networks";
import { openingPlants } from "@/shared/entities/world/plants";
import type { Province } from "@/shared/entities/world/provinces";
import { NO_RESOURCES } from "@/shared/entities/world/resources";
import type { Simulation } from "@/shared/entities/world/simulation";
import { supplyOf } from "@/shared/entities/world/simulation";
import { UNASSIGNED } from "@/shared/entities/world/spread";
import type { World } from "@/shared/entities/world/world";
import type { AdvancementSummary } from "./advancement-summary";
import { advancementTreeOf } from "./advancement-tree";
import { summaryOf } from "./nation-summary";

const land = (
  id: number,
  terrain: "plains" | "hills",
  cells: number,
  neighbours: readonly number[]
): Province => ({ cells, id, kind: "land", neighbours, terrain, x: id, y: 0 });

const PROVINCES: readonly Province[] = [
  land(0, "plains", 4, [1, 2, 3]),
  land(1, "plains", 2, [0]),
  land(2, "hills", 3, [0]),
  { cells: 9, id: 3, kind: "sea", neighbours: [0], x: 3, y: 0 },
  land(4, "hills", 1, []),
];

/**
 * Two nations and a sea zone. Nation 0 holds two plains and a hill, one of its
 * provinces touches nation 1, another touches only its own, and a third touches
 * the water, which is every case the pass branches on.
 */
const WORLD: World = {
  airspace: airspaceOf(PROVINCES, 1),
  cellProvince: Int32Array.from([0, 1, 2, 3, 4]),
  grid: { height: 1, width: 5 },
  nations: [
    {
      capital: 0,
      colour: { blue: 0, green: 0, red: 0 },
      id: 0,
      leaning: "army",
      name: "国0",
    },
    {
      capital: 2,
      colour: { blue: 0, green: 0, red: 0 },
      id: 1,
      leaning: "army",
      name: "国1",
    },
  ],
  provinces: PROVINCES,
  deposits: [0, 1, 2, 3, 4].map(() => NO_RESOURCES),
  seed: 1,
};

/** One economy per nation, told apart by the equipment each has stacked. */
const ECONOMIES: readonly NationEconomy[] = [
  { ...NO_ECONOMY, equipment: 40 },
  { ...NO_ECONOMY, equipment: 90 },
];

/** Nation 0 holds three provinces, nation 1 holds one, and a sea zone is free. */
const OWNERS = Int32Array.from([0, 0, 1, UNASSIGNED, 0]);

/**
 * The two nations at war, so the panel has enemies to name, with an air base
 * at each capital and no plane in the air.
 */
const SIMULATION: Simulation = {
  advancements: [START_ADVANCEMENT, START_ADVANCEMENT],
  airBases: Uint8Array.from([5, 0, 2, 0, 0]),
  airForces: [NO_AIR_FORCE, NO_AIR_FORCE],
  airPower: [new Float32Array(0), new Float32Array(0)],
  infrastructure: new Uint8Array(5).fill(FULL_SUPPLY_LEVEL),
  chronicle: [],
  compliance: startCompliance(OWNERS),
  deals: [],
  invasions: [],
  navies: [NO_NAVY, NO_NAVY],
  negotiations: [],
  quiet: noQuiet(2),
  stances: ["balanced", "balanced"],
  clock: START_CLOCK,
  divisions: [
    {
      arrival: "march",
      dropped: 0,
      entrenchment: 0,
      kind: "infantry",
      marched: 0,
      movingTo: 0,
      nation: 0,
      organisation: 60,
      planning: 0,
      province: 0,
      strength: 20_000,
      task: "line",
    },
  ],
  economies: ECONOMIES,
  owners: OWNERS,
  plants: openingPlants({ owners: OWNERS, world: WORLD }, ECONOMIES),
  diplomacy: warDeclared(openingDiplomacy(OWNERS, 2, [0]), 0, 1),
  gleaned: noGleaned(2),
  grantedSlots: new Uint8Array(5),
  networks: noNetworks(2, 5),
  services: openingServices(2),
  unrest: [],
};

/** What the panel says of a nation with no dockyard and nothing afloat. */
const NO_FLEET = [
  { label: "造船所", value: "0" },
  { label: "建造中", value: "輸送船（0%）" },
  { label: "駆逐艦", value: "0" },
  { label: "巡洋艦", value: "0" },
  { label: "戦艦", value: "0" },
  { label: "空母", value: "0" },
  { label: "潜水艦", value: "0" },
  { label: "輸送船（航路で使用中）", value: "0（0）" },
  { label: "飛び地に届いた補給", value: "100%" },
  { label: "海越しの輸入の到着", value: "100%" },
  { label: "準備中の海上輸送", value: "0（0師団）" },
];

/** What the panel says of a nation with no plane and one air base of five levels. */
const NO_PLANES = [
  { label: "航空機の生産", value: "作らない" },
  { label: "戦闘機", value: "0（出撃中 0）" },
  { label: "近接航空支援機", value: "0（出撃中 0）" },
  { label: "雷撃機", value: "0（出撃中 0）" },
  { label: "輸送機", value: "0（出撃中 0）" },
  { label: "航空基地", value: "5段階（1,000機分）" },
  { label: "燃料（昨日の消費）", value: "0%（0）" },
  { label: "制空権を握る空域", value: "0" },
  { label: "敵に制空権を握られた空域", value: "0" },
];

/** What the panel says of a nation with no mine and no factory that needs one. */
const NO_TRADE = [
  { label: "交易法", value: "輸出重視" },
  { label: "鋼鉄", value: "採掘 0・必要 0・輸入 0・輸出 0" },
  { label: "タングステン", value: "採掘 0・必要 0・輸入 0・輸出 0" },
  { label: "クロム", value: "採掘 0・必要 0・輸入 0・輸出 0" },
  { label: "アルミ", value: "採掘 0・必要 0・輸入 0・輸出 0" },
  { label: "ゴム", value: "採掘 0・必要 0・輸入 0・輸出 0" },
  { label: "石油", value: "採掘 0・必要 0・輸入 0・輸出 0" },
  { label: "資源不足による軍需生産の低下", value: "0%" },
  { label: "交易で増減した民需工場", value: "0" },
];

/**
 * What the panel says of the intelligence work of a nation with no agency,
 * which still sees what nation 1's trade law shows of its economy and navy.
 */
const FRESH_SERVICE = [
  { label: "諜報機関", value: "未設立" },
  { label: "工作員", value: "0/0人（作戦中 0、捕まっている 0）" },
  { label: "工作員の置き場所", value: "自国で防諜" },
  { label: "作戦", value: "なし" },
  { label: "防諜", value: "0.0" },
  { label: "暗号解読", value: "なし" },
  { label: "国1の諜報", value: "経済20%・陸軍0%・海軍10%・空軍0%" },
];

/** What the panel says of a nation that holds only the technologies it opened the world with and has pursued nothing. */
const UNADVANCED: AdvancementSummary = {
  focus: { label: "進めている方針", value: "なし" },
  focusesDone: [],
  researched: START_ADVANCEMENT.research.researched.length,
  slots: [{ label: "空き枠", value: "3" }],
};

describe(summaryOf, () => {
  it("should gather a nation's ground, terrain and borders when it holds some", () => {
    expect(
      summaryOf(WORLD, SIMULATION, supplyOf(WORLD, SIMULATION), 0)
    ).toStrictEqual({
      advancement: UNADVANCED,
      air: NO_PLANES,
      cells: 7,
      divisions: 1,
      economy: { ...NO_ECONOMY, equipment: 40 },
      enemies: ["国1"],
      faction: Option.some({ members: ["国0"], name: "国0陣営" }),
      front: [
        { label: "戦線", value: "1 本" },
        { label: "攻勢目標", value: "国1の首都" },
        { label: "撤退線の州", value: "1" },
        { label: "再編中の師団", value: "0" },
        { label: "前線の塹壕（平均）", value: "0.0 / 10" },
        { label: "前線の計画ボーナス（平均）", value: "0%" },
      ],
      id: 0,
      intel: FRESH_SERVICE,
      leaning: "army",
      name: "国0",
      navy: NO_FLEET,
      neighbours: ["国1"],
      occupation: [
        { label: "占領している州", value: "0" },
        { label: "平均の服従度", value: "—" },
        { label: "抵抗運動が強まっている州", value: "0" },
        { label: "破壊工作を受けている州", value: "0" },
        { label: "召集できる人口", value: "100%" },
        { label: "動かせる工場", value: "100%" },
      ],
      provinces: 3,
      puppets: [],
      slots: { total: 1, used: 0 },
      standing: { kind: "independent" },
      supply: [
        { label: "補給が足りない師団", value: "0 / 1" },
        { label: "補給が届かない師団", value: "0" },
        { label: "装備の維持費", value: "2 / 日" },
        { label: "維持費の充足", value: "100%" },
        { label: "インフラの平均", value: "3.0 / 5" },
      ],
      terrain: [
        { provinces: 2, terrain: "plains" },
        { provinces: 1, terrain: "hills" },
      ],
      trade: NO_TRADE,
      tree: advancementTreeOf(START_ADVANCEMENT),
      warGoal: [
        { label: "戦争目標", value: "なし" },
        { label: "正当化に要る緊張度", value: "50%" },
      ],
    });
  });

  it("should read nothing when the world holds no nation with that id", () => {
    expect(
      summaryOf(WORLD, SIMULATION, supplyOf(WORLD, SIMULATION), 9)
    ).toStrictEqual({
      advancement: UNADVANCED,
      air: [],
      cells: 0,
      divisions: 0,
      economy: NO_ECONOMY,
      enemies: [],
      faction: Option.none(),
      front: [],
      id: -1,
      intel: [],
      leaning: "army",
      name: "",
      navy: [],
      neighbours: [],
      occupation: [],
      provinces: 0,
      puppets: [],
      slots: { total: 0, used: 0 },
      standing: { kind: "independent" },
      supply: [],
      terrain: [],
      trade: [],
      tree: advancementTreeOf(START_ADVANCEMENT),
      warGoal: [],
    });
  });

  it("should name the overlord and list no faction when the nation is an unaligned puppet", () => {
    const simulation: Simulation = {
      ...SIMULATION,
      diplomacy: {
        ...openingDiplomacy(OWNERS, 2, []),
        standings: [INDEPENDENT, { kind: "puppet", overlord: 0 }],
      },
    };

    const summary = summaryOf(
      WORLD,
      simulation,
      supplyOf(WORLD, simulation),
      1
    );

    expect({
      faction: summary.faction,
      standing: summary.standing,
    }).toStrictEqual({
      faction: Option.none(),
      standing: { kind: "puppet", overlord: "国0" },
    });
  });

  it("should list the puppets when the nation is an overlord", () => {
    const simulation: Simulation = {
      ...SIMULATION,
      diplomacy: {
        ...openingDiplomacy(OWNERS, 2, []),
        standings: [INDEPENDENT, { kind: "puppet", overlord: 0 }],
      },
    };

    expect(
      summaryOf(WORLD, simulation, supplyOf(WORLD, simulation), 0).puppets
    ).toStrictEqual(["国1"]);
  });

  it("should name the annexer when the nation has been annexed", () => {
    const simulation: Simulation = {
      ...SIMULATION,
      diplomacy: {
        ...openingDiplomacy(OWNERS, 2, []),
        standings: [INDEPENDENT, { by: 0, kind: "annexed" }],
      },
    };

    expect(
      summaryOf(WORLD, simulation, supplyOf(WORLD, simulation), 1).standing
    ).toStrictEqual({
      by: "国0",
      kind: "annexed",
    });
  });
});
