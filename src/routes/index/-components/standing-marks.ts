import type { LucideIcon } from "lucide-react";
import {
  BanIcon,
  CheckIcon,
  CircleIcon,
  HourglassIcon,
  LockIcon,
} from "lucide-react";
import type { TreeStanding } from "@/shared/entities/world/tree-standing";

/** How the tree dialog marks a node that stands one way: its icon, its word, its surface. */
interface StandingMark {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly className: string;
}

export const STANDING_MARKS = {
  done: { className: "bg-secondary", icon: CheckIcon, label: "完了" },
  excluded: {
    className: "border-dashed text-muted-foreground line-through",
    icon: BanIcon,
    label: "排他で不可",
  },
  locked: {
    className: "text-muted-foreground",
    icon: LockIcon,
    label: "前提待ち",
  },
  open: { className: "bg-card", icon: CircleIcon, label: "着手できる" },
  underway: {
    className: "border-primary bg-card",
    icon: HourglassIcon,
    label: "進行中",
  },
} satisfies Readonly<Record<TreeStanding, StandingMark>>;

/** The standings in the order the legend lists them. */
export const LEGEND_ORDER: readonly TreeStanding[] = [
  "done",
  "underway",
  "open",
  "locked",
  "excluded",
];
