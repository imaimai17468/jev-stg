import type { Option } from "effect";
import { NationPanelBody } from "./nation-panel-body";
import type { NationSummary } from "./nation-summary";

interface HudNationPanelProps {
  readonly selection: Option.Option<NationSummary>;
}

export const HudNationPanel = ({ selection }: HudNationPanelProps) => (
  <aside className="absolute top-12 bottom-16 left-0 w-72 overflow-y-auto border-r border-border bg-card p-4">
    <NationPanelBody selection={selection} />
  </aside>
);
