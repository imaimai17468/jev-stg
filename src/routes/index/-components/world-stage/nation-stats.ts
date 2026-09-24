import { Option } from "effect";
import type { Leaning } from "@/shared/entities/world/geography/leaning";
import type { Terrain } from "@/shared/entities/world/geography/terrain";
import { countLabel } from "./count-label";
import type { NationSummary, StandingSummary } from "./nation-summary";
import type { Stat } from "./stat";

const TERRAIN_LABELS = {
  desert: "砂漠",
  forest: "森林",
  hills: "丘陵",
  mountains: "山岳",
  plains: "平野",
  tundra: "ツンドラ",
} satisfies Readonly<Record<Terrain, string>>;

/** The ground a nation holds, the people on it, and the building slots it has. */
export const territoryOf = (summary: NationSummary): readonly Stat[] => [
  { label: "州", value: String(summary.provinces) },
  { label: "面積", value: String(summary.cells) },
  { label: "人口", value: countLabel(summary.economy.population) },
  {
    label: "建設枠",
    value: `${summary.slots.used} / ${summary.slots.total}`,
  },
];

/** What that ground is made of, the most of it first. */
export const terrainOf = (summary: NationSummary): readonly Stat[] =>
  summary.terrain.map((share) => ({
    label: TERRAIN_LABELS[share.terrain],
    value: String(share.provinces),
  }));

const LEANING_LABELS = {
  army: "陸軍国",
  industry: "工業国",
  navy: "海軍国",
} satisfies Readonly<Record<Leaning, string>>;

/** How the panel words what a nation put its interwar years into. */
export const leaningLabel = (leaning: Leaning): string =>
  LEANING_LABELS[leaning];

/** How the panel words a nation's standing. */
export const standingLabel = (standing: StandingSummary): string => {
  if (standing.kind === "puppet") {
    return `${standing.overlord}の傀儡`;
  }
  if (standing.kind === "annexed") {
    return `${standing.by}に併合された`;
  }
  return "独立";
};

/** What the faction section shows: its heading and the nations under it. */
interface FactionListing {
  readonly title: string;
  readonly members: readonly string[];
}

export const factionListing = (summary: NationSummary): FactionListing =>
  Option.match(summary.faction, {
    onNone: () => ({ members: [], title: "陣営" }),
    onSome: (faction) => ({ members: faction.members, title: faction.name }),
  });
