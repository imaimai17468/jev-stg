import type { Headline } from "./headline";
import { StatRows } from "./stat-rows";

interface HudTopBarProps {
  readonly headline: Headline;
}

export const HudTopBar = ({ headline }: HudTopBarProps) => (
  <header className="absolute inset-x-0 top-0 flex h-12 items-center gap-6 border-b border-border bg-card px-4">
    <h1 className="text-sm font-medium">{headline.title}</h1>
    <StatRows layout="row" stats={headline.stats} />
  </header>
);
