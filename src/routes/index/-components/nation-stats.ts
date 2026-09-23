import type { Terrain } from "@/shared/entities/world/terrain";
import { countLabel } from "./count-label";
import type { NationSummary } from "./nation-summary";
import type { Stat } from "./stat";

const TERRAIN_LABELS = {
  desert: "砂漠",
  forest: "森林",
  hills: "丘陵",
  mountains: "山岳",
  plains: "平野",
  tundra: "ツンドラ",
} satisfies Readonly<Record<Terrain, string>>;

/** The ground a nation holds and the people on it. */
export const territoryOf = (summary: NationSummary): readonly Stat[] => [
  { label: "州", value: String(summary.provinces) },
  { label: "面積", value: String(summary.cells) },
  { label: "人口", value: countLabel(summary.economy.population) },
];

/** What that ground is made of, the most of it first. */
export const terrainOf = (summary: NationSummary): readonly Stat[] =>
  summary.terrain.map((share) => ({
    label: TERRAIN_LABELS[share.terrain],
    value: String(share.provinces),
  }));
