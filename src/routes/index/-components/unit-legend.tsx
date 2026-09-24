import { ChevronRightIcon } from "lucide-react";
import { UnitLegendEntry } from "./unit-legend-entry";
import type { Domain, UnitSymbol } from "./unit-symbols";
import { everySymbol, FRAMES, NO_SYMBOL, SYMBOL_PATHS } from "./unit-symbols";

const SYMBOL_LABELS = {
  airborne: "空挺",
  amphibious: "海兵",
  armour: "戦車（軽・中・重）",
  cavalry: "騎兵",
  infantry: "歩兵",
  mechanized: "機械化歩兵",
  motorized: "自動車化歩兵",
  mountain: "山岳歩兵",
} satisfies Record<UnitSymbol, string>;

/** The order the legend lists the land symbols in: foot first, then wheels and tracks, then the specialists. */
const LEGEND_ORDER = everySymbol([
  "infantry",
  "cavalry",
  "motorized",
  "mechanized",
  "armour",
  "mountain",
  "amphibious",
  "airborne",
]);

/** The domains in the order the legend lists their frames. */
const DOMAIN_ORDER: readonly Domain[] = ["land", "sea", "air"];

const DOMAIN_LABELS = {
  air: "航空団（数字は機数）",
  land: "師団（数字は師団数）",
  sea: "艦隊（数字は艦数）",
} satisfies Record<Domain, string>;

/**
 * What the counters on the map mean: the frame's shape says land, sea or air,
 * the symbol inside a land frame says what kind of division most of the stack
 * is, and the frame is filled in the colour of the nation it belongs to.
 *
 * It opens expanded and folds to its heading, because it sits over a corner of
 * the map and hides the counters there.
 */
export const UnitLegend = () => (
  <details
    className="group rounded-md border border-border bg-card px-3 text-xs"
    open
  >
    <summary className="flex min-h-11 cursor-pointer items-center gap-2 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring active:bg-muted">
      <ChevronRightIcon
        aria-hidden
        className="size-3.5 transition-transform group-open:rotate-90 motion-reduce:transition-none"
      />
      部隊記号（枠の色は国の色）
    </summary>
    <ul className="flex flex-col gap-1">
      {DOMAIN_ORDER.map((domain) => (
        <UnitLegendEntry
          frame={FRAMES[domain]}
          key={domain}
          label={DOMAIN_LABELS[domain]}
          symbol={NO_SYMBOL}
        />
      ))}
    </ul>
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 pb-2">
      {LEGEND_ORDER.map((symbol) => (
        <UnitLegendEntry
          frame={FRAMES.land}
          key={symbol}
          label={SYMBOL_LABELS[symbol]}
          symbol={SYMBOL_PATHS[symbol]}
        />
      ))}
    </ul>
  </details>
);
