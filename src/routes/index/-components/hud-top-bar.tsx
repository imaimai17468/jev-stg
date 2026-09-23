import type { Headline } from "./headline";
import { StatRows } from "./stat-rows";

interface HudTopBarProps {
  readonly headline: Headline;
}

export const HudTopBar = ({ headline }: HudTopBarProps) => (
  <header className="flex h-12 shrink-0 items-center gap-6 border-b border-border bg-card px-4">
    <h1 className="text-sm font-medium">{headline.title}</h1>
    <StatRows layout="row" stats={headline.stats} />
  </header>
);
