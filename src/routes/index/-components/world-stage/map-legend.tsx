import type { LegendEntry } from "./legend-entries";
import { stripeOffsets } from "./legend-stripes";
import { inkOf } from "./map-palette";

/** The swatch's side, in its own units. */
const SWATCH = 12;

interface MapLegendProps {
  readonly entries: readonly LegendEntry[];
}

/** What each colour of the map means, in the map's own colours; nothing where the map needs no legend. */
export const MapLegend = ({ entries }: MapLegendProps) => (
  <ul
    aria-label="地図の凡例"
    className="flex items-center gap-3"
    hidden={entries.length === 0}
  >
    {entries.map((entry) => (
      <li className="flex items-center gap-1 text-xs" key={entry.key}>
        <svg
          aria-hidden="true"
          className="size-3"
          viewBox={`0 0 ${SWATCH} ${SWATCH}`}
        >
          <rect
            fill={inkOf(entry.colour)}
            height={SWATCH}
            rx="2"
            width={SWATCH}
          />
          {stripeOffsets(entry.hatch, SWATCH).map((offset) => (
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
        {entry.label}
      </li>
    ))}
  </ul>
);
