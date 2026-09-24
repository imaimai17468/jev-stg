import { Option } from "effect";
import { NO_AIR_FORCE } from "@/shared/entities/world/air/air-force";
import { armouryOf } from "@/shared/entities/world/armoury";
import { battlePlanOf } from "@/shared/entities/world/army/battle-plan";
import type { SupplyNetwork } from "@/shared/entities/world/army/supply";
import type { Diplomacy, Standing } from "@/shared/entities/world/diplomacy";
import {
  factionOf,
  NO_FACTION,
  puppetsOf,
  sideOf,
  standingOf,
} from "@/shared/entities/world/diplomacy";
import { ledgersOf, NO_LEDGER } from "@/shared/entities/world/economy/commerce";
import type { NationEconomy } from "@/shared/entities/world/economy/economy";
import { NO_ECONOMY } from "@/shared/entities/world/economy/economy";
import type { HeldSlots } from "@/shared/entities/world/economy/plants";
import { slotsHeldBy } from "@/shared/entities/world/economy/plants";
import {
  counterIntelligenceOf,
  NO_SERVICE,
  slotsOf,
} from "@/shared/entities/world/espionage";
import { meanInfrastructureOf } from "@/shared/entities/world/geography/infrastructure";
import type { Leaning } from "@/shared/entities/world/geography/leaning";
import {
  nationsBeside,
  NO_NATION,
} from "@/shared/entities/world/geography/nations";
import type { Terrain } from "@/shared/entities/world/geography/terrain";
import type { World } from "@/shared/entities/world/geography/world";
import { valueAt } from "@/shared/entities/world/grid";
import { intelOf } from "@/shared/entities/world/insight";
import { itemAt } from "@/shared/entities/world/lookup";
import { NO_NAVY } from "@/shared/entities/world/navy/navy";
import { graphOf } from "@/shared/entities/world/provinces";
import { START_ADVANCEMENT } from "@/shared/entities/world/research/advancement";
import type { Simulation } from "@/shared/entities/world/simulation";
import {
  armouriesOf,
  espialOf,
  modifiersOfAll,
  skiesOf,
  stirredIn,
} from "@/shared/entities/world/simulation";
import { superiorityOf } from "@/shared/entities/world/skies";
import { enemiesOf } from "@/shared/entities/world/wars";
import type { AdvancementSummary } from "./advancement-summary";
import { advancementSummaryOf } from "./advancement-summary";
import type { AdvancementTree } from "./advancement-tree";
import { advancementTreeOf } from "./advancement-tree";
import { airSummaryOf } from "./air-summary";
import { frontSummaryOf } from "./front-summary";
import { intelSummaryOf } from "./intel-summary";
import { navySummaryOf } from "./navy-summary";
import { occupationSummaryOf } from "./occupation-summary";
import type { Stat } from "./stat";
import { supplySummaryOf } from "./supply-summary";
import { tradeSummaryOf } from "./trade-summary";
import { warGoalSummaryOf } from "./war-goal-summary";

/** How much of a nation's ground is one kind of terrain. */
export interface TerrainShare {
  readonly terrain: Terrain;
  readonly provinces: number;
}

/** Whether a nation answers to itself, to another, or to nobody any more. */
export type StandingSummary =
  | { readonly kind: "independent" }
  | { readonly kind: "puppet"; readonly overlord: string }
  | { readonly kind: "annexed"; readonly by: string };

/** The faction a nation fights under: its name and everyone in it, by name. */
export interface FactionSummary {
  readonly name: string;
  readonly members: readonly string[];
}

/** What the panels say about one nation. */
export interface NationSummary {
  readonly id: number;
  readonly name: string;
  /** What it put its interwar years into, which decided what it opened with. */
  readonly leaning: Leaning;
  readonly provinces: number;
  /** The nation's area, in map cells. */
  readonly cells: number;
  /** The building slots its ground has, and how many of them stand taken. */
  readonly slots: HeldSlots;
  /** Its terrain, the most of it first. */
  readonly terrain: readonly TerrainShare[];
  /** The nations it shares a land border with, by name. */
  readonly neighbours: readonly string[];
  /** Its people, its industry, and what they have turned out so far. */
  readonly economy: NationEconomy;
  /** The divisions it has in the field. */
  readonly divisions: number;
  /** The nations it is fighting, by name. */
  readonly enemies: readonly string[];
  /** Its war goal and the world tension it needs to justify one. */
  readonly warGoal: readonly Stat[];
  readonly standing: StandingSummary;
  readonly faction: Option.Option<FactionSummary>;
  /** The nations that answer to it, by name. */
  readonly puppets: readonly string[];
  readonly advancement: AdvancementSummary;
  /** Its focus tree and research tree, each node marked with where it stands. */
  readonly tree: AdvancementTree;
  /** Its battle plan: its fronts, their objectives, and its fallback line. */
  readonly front: readonly Stat[];
  readonly supply: readonly Stat[];
  readonly occupation: readonly Stat[];
  readonly navy: readonly Stat[];
  readonly air: readonly Stat[];
  readonly intel: readonly Stat[];
  readonly trade: readonly Stat[];
}

const EMPTY: NationSummary = {
  advancement: advancementSummaryOf(START_ADVANCEMENT),
  air: [],
  supply: [],
  cells: 0,
  slots: { total: 0, used: 0 },
  divisions: 0,
  economy: NO_ECONOMY,
  enemies: [],
  faction: Option.none(),
  front: [],
  id: -1,
  intel: [],
  leaning: NO_NATION.leaning,
  name: "",
  navy: [],
  neighbours: [],
  occupation: [],
  provinces: 0,
  puppets: [],
  standing: { kind: "independent" },
  terrain: [],
  trade: [],
  tree: advancementTreeOf(START_ADVANCEMENT),
  warGoal: [],
};

const terrainShares = (
  counts: ReadonlyMap<Terrain, number>
): readonly TerrainShare[] =>
  [...counts]
    .map(([terrain, provinces]) => ({ provinces, terrain }))
    .toSorted((left, right) => right.provinces - left.provinces);

/** Where a nation stands among the others, with every nation spelled out. */
type Allegiance = Pick<NationSummary, "faction" | "puppets" | "standing">;

/** The standing, with the nations it names spelled out. */
const standingSummary = (
  standing: Standing,
  nameOf: (nation: number) => string
): StandingSummary => {
  if (standing.kind === "puppet") {
    return { kind: "puppet", overlord: nameOf(standing.overlord) };
  }
  if (standing.kind === "annexed") {
    return { by: nameOf(standing.by), kind: "annexed" };
  }
  return standing;
};

/**
 * The nation's standing, its puppets, and the faction it fights under, which
 * is named after the nation that founded it and lists every nation fighting
 * under it, puppets included.
 */
const allegianceOf = (
  diplomacy: Diplomacy,
  nation: number,
  nameOf: (nation: number) => string
): Allegiance => {
  const faction = factionOf(diplomacy, nation);
  const standing = standingSummary(standingOf(diplomacy, nation), nameOf);
  const puppets = puppetsOf(diplomacy, nation).map(nameOf);
  if (faction === NO_FACTION) {
    return { faction: Option.none(), puppets, standing };
  }
  return {
    faction: Option.some({
      members: sideOf(diplomacy, nation).map(nameOf),
      name: `${nameOf(faction)}陣営`,
    }),
    puppets,
    standing,
  };
};

/**
 * Everything the HUD says about a nation, read off the world in one pass.
 *
 * A nation the world does not hold comes back empty rather than absent, because
 * the panel that reads this is only rendered for a nation the map named.
 */
export const summaryOf = (
  world: World,
  simulation: Simulation,
  supply: SupplyNetwork,
  nation: number
): NationSummary => {
  const { diplomacy, owners } = simulation;
  const graph = graphOf(world.provinces);
  const named = itemAt(world.nations, nation, NO_NATION);
  if (named.id < 0) {
    return EMPTY;
  }
  const nameOf = (other: number) => itemAt(world.nations, other, named).name;
  const modifiers = modifiersOfAll(simulation);
  const advancement = itemAt(
    simulation.advancements,
    nation,
    START_ADVANCEMENT
  );
  const armoury = armouryOf(advancement.research);
  const counts = new Map<Terrain, number>();
  const neighbours = new Set<number>();
  let provinces = 0;
  let cells = 0;
  for (const province of world.provinces) {
    if (province.kind !== "land") {
      continue;
    }
    if (valueAt(owners, province.id) !== nation) {
      continue;
    }
    provinces += 1;
    cells += province.cells;
    counts.set(province.terrain, (counts.get(province.terrain) ?? 0) + 1);
    for (const owner of nationsBeside(owners, province, nation)) {
      neighbours.add(owner);
    }
  }
  return {
    air: airSummaryOf({
      airBases: simulation.airBases,
      airForce: itemAt(simulation.airForces, nation, NO_AIR_FORCE),
      economy: itemAt(simulation.economies, nation, NO_ECONOMY),
      models: armoury.planes,
      nation,
      owners,
      superiority: superiorityOf(skiesOf(simulation), nation),
    }),
    advancement: advancementSummaryOf(advancement),
    cells,
    divisions: simulation.divisions.filter(
      (division) => division.nation === nation
    ).length,
    economy: itemAt(simulation.economies, nation, NO_ECONOMY),
    enemies: enemiesOf(diplomacy.wars, nation).map(nameOf),
    front: frontSummaryOf(
      world.nations,
      battlePlanOf(
        world.provinces,
        world.nations,
        graph,
        owners,
        diplomacy.wars,
        nation
      ),
      simulation.divisions,
      nation
    ),
    ...allegianceOf(diplomacy, nation, nameOf),
    id: nation,
    leaning: named.leaning,
    name: named.name,
    navy: navySummaryOf(
      itemAt(simulation.navies, nation, NO_NAVY),
      itemAt(simulation.economies, nation, NO_ECONOMY),
      simulation.invasions.filter((crossing) => crossing.nation === nation),
      armoury.ships
    ),
    neighbours: [...neighbours].map(nameOf),
    intel: intelSummaryOf({
      agencies: simulation.services.map((service) => service.agency),
      counterIntelligence: counterIntelligenceOf(
        itemAt(simulation.services, nation, NO_SERVICE)
      ),
      intel: intelOf(espialOf(simulation, graph)),
      nameOf,
      nation,
      service: itemAt(simulation.services, nation, NO_SERVICE),
      slots: slotsOf(
        nation,
        itemAt(simulation.services, nation, NO_SERVICE).agency,
        simulation
      ),
    }),
    occupation: occupationSummaryOf(
      world,
      {
        compliance: simulation.compliance,
        owners,
        plants: simulation.plants,
        stirred: stirredIn(simulation),
      },
      nation
    ),
    provinces,
    slots: slotsHeldBy(
      {
        grantedSlots: simulation.grantedSlots,
        modifiers,
        owners,
        plants: simulation.plants,
        world,
      },
      nation
    ),
    supply: supplySummaryOf(
      supply,
      simulation.divisions,
      itemAt(simulation.economies, nation, NO_ECONOMY),
      nation,
      meanInfrastructureOf(simulation.infrastructure, owners, nation)
    ),
    terrain: terrainShares(counts),
    trade: tradeSummaryOf(
      itemAt(simulation.economies, nation, NO_ECONOMY),
      itemAt(
        ledgersOf({
          ...simulation,
          armouries: armouriesOf(simulation),
          modifiers,
          world,
        }),
        nation,
        NO_LEDGER
      )
    ),
    tree: advancementTreeOf(advancement),
    warGoal: warGoalSummaryOf(diplomacy.warGoals, advancement.focuses, {
      day: simulation.clock.days,
      nameOf,
      nation,
    }),
  };
};
