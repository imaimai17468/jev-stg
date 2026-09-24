import { Option } from "effect";
import { cn } from "@/lib/utils";
import type { TreeNode } from "../../advancement-tree";
import { STANDING_MARKS } from "./standing-marks";

interface TreeNodeCardProps {
  readonly node: TreeNode;
}

export const TreeNodeCard = ({ node }: TreeNodeCardProps) => {
  const mark = STANDING_MARKS[node.standing];
  const Icon = mark.icon;
  return (
    <li
      className={cn(
        "flex w-36 items-start gap-1.5 rounded-md border px-2 py-1.5 text-xs",
        mark.className
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="wrap-break-word">{node.name}</span>
        <span className="sr-only">{mark.label}</span>
        {Option.toArray(node.progress).map((progress) => (
          <span className="font-mono tabular-nums" key={progress}>
            {progress}
          </span>
        ))}
      </span>
    </li>
  );
};
