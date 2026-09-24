import { Option } from "effect";
import type { NationSummary } from "../nation-summary";
import { NationDetail } from "./nation-detail";

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
