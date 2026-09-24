import type { Stat } from "./stat";

/** How a run of readings is set: down a panel, or across a bar. */
type StatLayout = "column" | "row";

const LIST_CLASS = {
  column: "flex flex-col gap-1",
  row: "flex items-center gap-5",
} satisfies Record<StatLayout, string>;

const ROW_CLASS = {
  column: "flex items-baseline justify-between",
  row: "flex items-baseline gap-2",
} satisfies Record<StatLayout, string>;

const LABEL_CLASS = {
  column: "text-sm",
  row: "text-xs text-muted-foreground",
} satisfies Record<StatLayout, string>;

interface StatRowsProps {
  readonly stats: readonly Stat[];
  readonly layout: StatLayout;
}

export const StatRows = ({ layout, stats }: StatRowsProps) => (
  <dl className={LIST_CLASS[layout]}>
    {stats.map((stat) => (
      <div className={ROW_CLASS[layout]} key={stat.label}>
        <dt className={LABEL_CLASS[layout]}>{stat.label}</dt>
        <dd className="font-mono text-sm tabular-nums">{stat.value}</dd>
      </div>
    ))}
  </dl>
);
