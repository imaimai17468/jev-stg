import type { Headline } from "./headline";

interface HudTopBarProps {
  readonly headline: Headline;
}

export const HudTopBar = ({ headline }: HudTopBarProps) => (
  <header className="absolute inset-x-0 top-0 flex h-12 items-center gap-6 border-b border-border bg-card px-4">
    <h1 className="text-sm font-medium">{headline.title}</h1>
    <dl className="flex items-center gap-5">
      {headline.stats.map((stat) => (
        <div className="flex items-baseline gap-2" key={stat.label}>
          <dt className="text-xs text-muted-foreground">{stat.label}</dt>
          <dd className="font-mono text-sm tabular-nums">{stat.value}</dd>
        </div>
      ))}
    </dl>
  </header>
);
