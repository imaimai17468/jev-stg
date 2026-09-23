import { SUPPLY_COLOURS, SUPPLY_HATCH } from "./map-palette";
import type { SupplyLevel } from "./supply-level";
import { stripeOffsets, SUPPLY_LEVELS } from "./supply-level";

/** The swatch's side, in its own units. */
const SWATCH = 12;

const LEVEL_LABELS = {
  plenty: "余裕大",
  short: "不足",
  some: "余裕あり",
  starved: "大きく不足",
  stretched: "余裕なし",
} satisfies Record<SupplyLevel, string>;

interface SupplyLegendProps {
  /** Whether the legend is left out, which it is while the map shows something else. */
  readonly hidden: boolean;
}

/** What each colour of the supply map means, in the map's own colours. */
export const SupplyLegend = ({ hidden }: SupplyLegendProps) => (
  <ul
    aria-label="補給の凡例"
    className="flex items-center gap-3"
    hidden={hidden}
  >
    {SUPPLY_LEVELS.map((level) => {
      const { blue, green, red } = SUPPLY_COLOURS[level];
      return (
        <li className="flex items-center gap-1 text-xs" key={level}>
          <svg
            aria-hidden="true"
            className="size-3"
            viewBox={`0 0 ${SWATCH} ${SWATCH}`}
          >
            <rect
              fill={`rgb(${red} ${green} ${blue})`}
              height={SWATCH}
              rx="2"
              width={SWATCH}
            />
            {stripeOffsets(SUPPLY_HATCH[level], SWATCH).map((offset) => (
              <line
                key={offset}
                stroke="rgb(0 0 0 / 0.45)"
                strokeWidth="1"
                x1={offset}
                x2="0"
                y1="0"
                y2={offset}
              />
            ))}
          </svg>
          {LEVEL_LABELS[level]}
        </li>
      );
    })}
  </ul>
);
