import { NationList } from "./nation-list";
import {
  factionListing,
  standingLabel,
  terrainOf,
  territoryOf,
} from "./nation-stats";
import type { NationSummary } from "./nation-summary";
import { PanelSection } from "./panel-section";
import { StatRows } from "./stat-rows";

interface NationDetailProps {
  readonly summary: NationSummary;
}

export const NationDetail = ({ summary }: NationDetailProps) => {
  const faction = factionListing(summary);
  return (
    <div className="flex flex-col gap-6">
      <PanelSection title="領土">
        <StatRows layout="column" stats={territoryOf(summary)} />
      </PanelSection>
      <PanelSection title="立場">
        <p className="text-sm">{standingLabel(summary.standing)}</p>
      </PanelSection>
      <PanelSection title="戦争">
        <NationList empty="どことも戦っていません" names={summary.enemies} />
      </PanelSection>
      <PanelSection title={faction.title}>
        <NationList
          empty="どの陣営にも属していません"
          names={faction.members}
        />
      </PanelSection>
      <PanelSection title="傀儡">
        <NationList empty="傀儡国はありません" names={summary.puppets} />
      </PanelSection>
      <PanelSection
        title={`研究（研究済み ${summary.advancement.researched}）`}
      >
        <StatRows layout="column" stats={summary.advancement.slots} />
      </PanelSection>
      <PanelSection title="国家方針">
        <StatRows layout="column" stats={[summary.advancement.focus]} />
      </PanelSection>
      <PanelSection title="達成した国家方針">
        <NationList
          empty="まだありません"
          names={summary.advancement.focusesDone}
        />
      </PanelSection>
      <PanelSection title="地形">
        <StatRows layout="column" stats={terrainOf(summary)} />
      </PanelSection>
      <PanelSection title="隣接する国">
        <NationList
          empty="陸で接する国はありません"
          names={summary.neighbours}
        />
      </PanelSection>
    </div>
  );
};
