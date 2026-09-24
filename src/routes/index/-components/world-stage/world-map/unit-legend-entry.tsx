import type { Frame, SymbolPaths } from "../unit-symbols";

/** The room around a frame inside its glyph, in the frame's own units, so its rim is not cut. */
const MARGIN = 8;
/** How thick the glyph's lines are, in the frame's own units. */
const LINE = 9;

interface UnitLegendEntryProps {
  readonly frame: Frame;
  readonly symbol: SymbolPaths;
  readonly label: string;
}

/** One line of the unit legend: a frame and the symbol inside it, drawn from the same paths the map's counters are, and what they mean. */
export const UnitLegendEntry = ({
  frame,
  label,
  symbol,
}: UnitLegendEntryProps) => (
  <li className="flex items-center gap-2">
    <svg
      aria-hidden="true"
      className="h-4 w-6 shrink-0"
      viewBox={`${-MARGIN} ${-MARGIN} ${frame.width + 2 * MARGIN} ${frame.height + 2 * MARGIN}`}
    >
      <path
        d={frame.outline}
        fill="none"
        stroke="currentColor"
        strokeWidth={LINE}
      />
      <path
        d={symbol.strokes}
        fill="none"
        stroke="currentColor"
        strokeWidth={LINE}
      />
      <path d={symbol.fills} fill="currentColor" />
    </svg>
    {label}
  </li>
);
