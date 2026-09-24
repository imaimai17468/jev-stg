import { AdvancementDialog } from "./advancement-dialog";
import { NationList } from "./nation-list";
import {
  factionListing,
  leaningLabel,
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
      <PanelSection title="国柄">
        <p className="text-sm">{leaningLabel(summary.leaning)}</p>
      </PanelSection>
      <PanelSection title="立場">
        <p className="text-sm">{standingLabel(summary.standing)}</p>
      </PanelSection>
      <PanelSection title="戦争">
        <NationList empty="どことも戦っていません" names={summary.enemies} />
      </PanelSection>
      <PanelSection title="戦線">
        <StatRows layout="column" stats={summary.front} />
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
      <PanelSection title="占領地">
        <StatRows layout="column" stats={summary.occupation} />
      </PanelSection>
      <PanelSection title="補給">
        <StatRows layout="column" stats={summary.supply} />
      </PanelSection>
      <PanelSection title="海軍">
        <StatRows layout="column" stats={summary.navy} />
      </PanelSection>
      <PanelSection title="空軍">
        <StatRows layout="column" stats={summary.air} />
      </PanelSection>
      <PanelSection title="諜報">
        <StatRows layout="column" stats={summary.intel} />
      </PanelSection>
      <PanelSection title="資源と交易">
        <StatRows layout="column" stats={summary.trade} />
      </PanelSection>
      <PanelSection
        title={`研究（研究済み ${summary.advancement.researched}）`}
      >
        <StatRows layout="column" stats={summary.advancement.slots} />
        <AdvancementDialog
          defaultTab="techs"
          nation={summary.name}
          tree={summary.tree}
          trigger="研究ツリーを見る"
        />
      </PanelSection>
      <PanelSection title="国家方針">
        <StatRows layout="column" stats={[summary.advancement.focus]} />
        <AdvancementDialog
          defaultTab="focuses"
          nation={summary.name}
          tree={summary.tree}
          trigger="国家方針ツリーを見る"
        />
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
