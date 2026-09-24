import type { TreeNode } from "./advancement-tree";
import { TreeNodeCard } from "./tree-node-card";

/** How a tier sets its nodes: side by side, wrapping, or stacked. */
type TierFlow = "wrap" | "stack";

const FLOW_CLASS = {
  stack: "flex flex-col gap-1.5",
  wrap: "flex flex-wrap gap-2",
} satisfies Record<TierFlow, string>;

interface TierNodesProps {
  readonly nodes: readonly TreeNode[];
  readonly flow: TierFlow;
}

export const TierNodes = ({ flow, nodes }: TierNodesProps) => (
  <ul className={FLOW_CLASS[flow]}>
    {nodes.map((node) => (
      <TreeNodeCard key={node.id} node={node} />
    ))}
  </ul>
);
