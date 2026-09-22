import { Option } from "effect";
import { NationDetail } from "./nation-detail";
import type { NationSummary } from "./nation-summary";

interface NationPanelBodyProps {
  readonly selection: Option.Option<NationSummary>;
}

export const NationPanelBody = ({ selection }: NationPanelBodyProps) => {
  if (Option.isNone(selection)) {
    return (
      <p className="text-sm text-muted-foreground">
        地図の国をクリックすると、その国の中身が出ます。
      </p>
    );
  }
  return <NationDetail summary={selection.value} />;
};
