import type { FocusTier, TreeGroup } from "./advancement-tree";
import { TierNodes } from "./tier-nodes";

interface FocusTreeProps {
  readonly branches: readonly TreeGroup<FocusTier>[];
}

export const FocusTree = ({ branches }: FocusTreeProps) => (
  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
    {branches.map((branch) => (
      <section className="flex flex-col gap-3" key={branch.title}>
        <h3 className="text-sm font-medium">{branch.title}</h3>
        {branch.tiers.map((tier) => (
          <TierNodes
            flow="wrap"
            key={tier.nodes.map((node) => node.id).join(" ")}
            nodes={tier.nodes}
          />
        ))}
      </section>
    ))}
  </div>
);
