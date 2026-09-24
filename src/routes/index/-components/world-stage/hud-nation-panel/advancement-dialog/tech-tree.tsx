import type { TreeGroup, YearTier } from "../../advancement-tree";
import { TierNodes } from "./tier-nodes";

interface TechTreeProps {
  readonly lines: readonly TreeGroup<YearTier>[];
}

export const TechTree = ({ lines }: TechTreeProps) => (
  <div className="flex flex-col gap-5">
    {lines.map((line) => (
      <section className="flex flex-col gap-2" key={line.title}>
        <h3 className="text-sm font-medium">{line.title}</h3>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {line.tiers.map((tier) => (
            <div className="flex shrink-0 flex-col gap-1.5" key={tier.year}>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {tier.year}
              </span>
              <TierNodes flow="stack" nodes={tier.nodes} />
            </div>
          ))}
        </div>
      </section>
    ))}
  </div>
);
