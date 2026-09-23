import type { Colour } from "@/shared/entities/world/nations";
import type { ComplianceLevel } from "./compliance-level";
import { COMPLIANCE_LEVELS } from "./compliance-level";
import type { MapMode } from "./map-mode";
import {
  COMPLIANCE_COLOURS,
  COMPLIANCE_HATCH,
  NETWORK_COLOURS,
  NETWORK_HATCH,
  RESOURCE_COLOURS,
  SEA_HOLD_HATCH,
  SEA_HOLD_SWATCHES,
  SUPPLY_COLOURS,
  SUPPLY_HATCH,
} from "./map-palette";
import type { NetworkLevel } from "./network-level";
import { NETWORK_LEVELS } from "./network-level";
import type { ResourceLevel } from "./resource-level";
import { RESOURCE_LEVELS } from "./resource-level";
import type { SeaHoldLevel } from "./sea-hold";
import { SEA_HOLD_LEVELS } from "./sea-hold";
import type { SupplyLevel } from "./supply-level";
import { SUPPLY_LEVELS } from "./supply-level";

/** One swatch of a map's legend and what it stands for. */
export interface LegendEntry {
  readonly key: string;
  readonly label: string;
  readonly colour: Colour;
  /** The cells between the stripes across it, zero for none. */
  readonly hatch: number;
}

const SUPPLY_LABELS = {
  plenty: "余裕大",
  short: "不足",
  some: "余裕あり",
  starved: "大きく不足",
  stretched: "余裕なし",
} satisfies Record<SupplyLevel, string>;

const COMPLIANCE_LABELS = {
  complying: "服従度 60%以上",
  defiant: "服従度 30%未満",
  home: "自国の土地",
  wavering: "服従度 30〜60%",
} satisfies Record<ComplianceLevel, string>;

const SEA_HOLD_LABELS = {
  contested: "争われている海",
  empty: "艦のいない海",
  held: "1国が握る海（その国の色）",
} satisfies Record<SeaHoldLevel, string>;

const AIR_HOLD_LABELS = {
  contested: "争われている空",
  empty: "誰も飛んでいない空",
  held: "1国が制空権を握る空（その国の色）",
} satisfies Record<SeaHoldLevel, string>;

const NETWORK_LABELS = {
  building: "諜報網 10未満（まだ効かない）",
  counts: "諜報網 10〜50",
  none: "諜報網なし",
  strong: "諜報網 50以上",
} satisfies Record<NetworkLevel, string>;

const RESOURCE_LABELS = {
  aluminium: "アルミ",
  chromium: "クロム",
  none: "資源なし",
  oil: "石油",
  rubber: "ゴム",
  steel: "鋼鉄",
  tungsten: "タングステン",
} satisfies Record<ResourceLevel, string>;

/** No province of the resource map is striped. */
const NO_RESOURCE_HATCH = {
  aluminium: 0,
  chromium: 0,
  none: 0,
  oil: 0,
  rubber: 0,
  steel: 0,
  tungsten: 0,
} satisfies Record<ResourceLevel, number>;

/** The legend of a map painted in `levels`, each with its colour, stripes and label. */
const legendOf = <Level extends string>(
  levels: readonly Level[],
  colours: Readonly<Record<Level, Colour>>,
  hatches: Readonly<Record<Level, number>>,
  labels: Readonly<Record<Level, string>>
): readonly LegendEntry[] =>
  levels.map((level) => ({
    colour: colours[level],
    hatch: hatches[level],
    key: level,
    label: labels[level],
  }));

/** What the map in each mode needs a legend for: nothing on the political map, whose colours are the nations. */
const LEGENDS = {
  air: legendOf(
    SEA_HOLD_LEVELS,
    SEA_HOLD_SWATCHES,
    SEA_HOLD_HATCH,
    AIR_HOLD_LABELS
  ),
  compliance: legendOf(
    COMPLIANCE_LEVELS,
    COMPLIANCE_COLOURS,
    COMPLIANCE_HATCH,
    COMPLIANCE_LABELS
  ),
  naval: legendOf(
    SEA_HOLD_LEVELS,
    SEA_HOLD_SWATCHES,
    SEA_HOLD_HATCH,
    SEA_HOLD_LABELS
  ),
  intel: legendOf(
    NETWORK_LEVELS,
    NETWORK_COLOURS,
    NETWORK_HATCH,
    NETWORK_LABELS
  ),
  political: [],
  resources: legendOf(
    RESOURCE_LEVELS,
    RESOURCE_COLOURS,
    NO_RESOURCE_HATCH,
    RESOURCE_LABELS
  ),
  supply: legendOf(SUPPLY_LEVELS, SUPPLY_COLOURS, SUPPLY_HATCH, SUPPLY_LABELS),
} satisfies Record<MapMode, readonly LegendEntry[]>;

export const legendFor = (mode: MapMode): readonly LegendEntry[] =>
  LEGENDS[mode];
