import type { Option } from "effect";
import { NationPanelBody } from "./nation-panel-body";
import type { NationSummary } from "./nation-summary";

interface HudNationPanelProps {
  readonly selection: Option.Option<NationSummary>;
}

export const HudNationPanel = ({ selection }: HudNationPanelProps) => (
  <aside className="w-72 shrink-0 overflow-y-auto border-r border-border bg-card p-4">
    <NationPanelBody selection={selection} />
  </aside>
);
