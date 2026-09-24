import { DecisionList } from "./decision-list";
import type { EntryLine } from "./entry-line";
import { PanelSection } from "./panel-section";
import type { CouncilVoice } from "./use-jev-council";

interface HudDecisionFeedProps {
  readonly lines: readonly EntryLine[];
  readonly voice: CouncilVoice;
}

const VOICE_LABELS = {
  consulting: "Jev に相談しています",
  jev: "Jev が判断しています",
  mixed: "Jev が判断し、届かなかった国は規則で判断しています",
  rules: "Jev に届かないため、規則で判断しています",
} satisfies Readonly<Record<CouncilVoice, string>>;

export const HudDecisionFeed = ({ lines, voice }: HudDecisionFeedProps) => (
  <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-l border-border bg-card p-4">
    <PanelSection title="各国の判断">
      <p className="text-xs text-muted-foreground">{VOICE_LABELS[voice]}</p>
    </PanelSection>
    <DecisionList lines={lines} />
  </aside>
);
