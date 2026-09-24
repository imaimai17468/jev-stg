import type { ReactNode } from "react";

interface FrontLegendProps {
  /** Whether the map is drawing any front, which is when the legend shows. */
  readonly shown: boolean;
}

/** The glyph's box, in its own units. */
const GLYPH_WIDTH = 24;
const GLYPH_HEIGHT = 12;
const MIDDLE = GLYPH_HEIGHT / 2;

/** Each line the map draws, the glyph it is drawn as here, and what it means. */
const ENTRIES: readonly {
  readonly key: string;
  readonly label: string;
  readonly glyph: ReactNode;
}[] = [
  {
    glyph: (
      <line
        stroke="currentColor"
        strokeWidth="3"
        x1="0"
        x2={GLYPH_WIDTH}
        y1={MIDDLE}
        y2={MIDDLE}
      />
    ),
    key: "front",
    label: "戦線",
  },
  {
    glyph: (
      <line
        stroke="currentColor"
        strokeDasharray="6 4"
        strokeWidth="2"
        x1="0"
        x2={GLYPH_WIDTH}
        y1={MIDDLE}
        y2={MIDDLE}
      />
    ),
    key: "fallback",
    label: "撤退線",
  },
  {
    glyph: (
      <>
        <line
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="3"
          x1="1"
          x2={GLYPH_WIDTH - 8}
          y1={MIDDLE}
          y2={MIDDLE}
        />
        <polygon
          fill="currentColor"
          points={`${GLYPH_WIDTH},${MIDDLE} ${GLYPH_WIDTH - 9},1 ${GLYPH_WIDTH - 9},${GLYPH_HEIGHT - 1}`}
        />
      </>
    ),
    key: "offensive",
    label: "攻勢（先端が目標の首都）",
  },
];

/**
 * What the lines the map draws over the nations mean. Each line is drawn in
 * the colour of the nation it belongs to, so the legend tells them apart by
 * shape alone.
 */
export const FrontLegend = ({ shown }: FrontLegendProps) => (
  <ul
    aria-label="戦線の凡例"
    className="flex flex-col gap-1 rounded-md border border-border bg-card px-3 py-2 text-xs"
    hidden={!shown}
  >
    {ENTRIES.map((entry) => (
      <li className="flex items-center gap-2" key={entry.key}>
        <svg
          aria-hidden="true"
          className="h-3 w-6"
          viewBox={`0 0 ${GLYPH_WIDTH} ${GLYPH_HEIGHT}`}
        >
          {entry.glyph}
        </svg>
        {entry.label}
      </li>
    ))}
  </ul>
);
