import type { Colour } from "@/shared/entities/world/nations";
import type { ComplianceLevel } from "./compliance-level";
import { COMPLIANCE_LEVELS } from "./compliance-level";
import type { MapMode } from "./map-mode";
import {
  COMPLIANCE_COLOURS,
  COMPLIANCE_HATCH,
  SUPPLY_COLOURS,
  SUPPLY_HATCH,
} from "./map-palette";
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
  compliance: legendOf(
    COMPLIANCE_LEVELS,
    COMPLIANCE_COLOURS,
    COMPLIANCE_HATCH,
    COMPLIANCE_LABELS
  ),
  political: [],
  supply: legendOf(SUPPLY_LEVELS, SUPPLY_COLOURS, SUPPLY_HATCH, SUPPLY_LABELS),
} satisfies Record<MapMode, readonly LegendEntry[]>;

export const legendFor = (mode: MapMode): readonly LegendEntry[] =>
  LEGENDS[mode];
