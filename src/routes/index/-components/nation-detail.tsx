import { terrainOf, territoryOf } from "./nation-stats";
import type { NationSummary } from "./nation-summary";
import { StatRows } from "./stat-rows";

interface NationDetailProps {
  readonly summary: NationSummary;
}

export const NationDetail = ({ summary }: NationDetailProps) => (
  <div className="flex flex-col gap-6">
    <section className="flex flex-col gap-2">
      <h2 className="text-xs text-muted-foreground">領土</h2>
      <StatRows layout="column" stats={territoryOf(summary)} />
    </section>
    <section className="flex flex-col gap-2">
      <h2 className="text-xs text-muted-foreground">地形</h2>
      <StatRows layout="column" stats={terrainOf(summary)} />
    </section>
    <section className="flex flex-col gap-2">
      <h2 className="text-xs text-muted-foreground">隣接する国</h2>
      <ul className="flex flex-col gap-1">
        {summary.neighbours.map((name) => (
          <li className="text-sm" key={name}>
            {name}
          </li>
        ))}
      </ul>
    </section>
  </div>
);
