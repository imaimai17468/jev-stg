import { NationList } from "./nation-list";
import { terrainOf, territoryOf } from "./nation-stats";
import type { NationSummary } from "./nation-summary";
import { PanelSection } from "./panel-section";
import { StatRows } from "./stat-rows";

interface NationDetailProps {
  readonly summary: NationSummary;
}

export const NationDetail = ({ summary }: NationDetailProps) => (
  <div className="flex flex-col gap-6">
    <PanelSection title="領土">
      <StatRows layout="column" stats={territoryOf(summary)} />
    </PanelSection>
    <PanelSection title="戦争">
      <NationList empty="どことも戦っていません" names={summary.enemies} />
    </PanelSection>
    <PanelSection title="地形">
      <StatRows layout="column" stats={terrainOf(summary)} />
    </PanelSection>
    <PanelSection title="隣接する国">
      <NationList empty="陸で接する国はありません" names={summary.neighbours} />
    </PanelSection>
  </div>
);
