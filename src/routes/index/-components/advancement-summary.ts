import { Option } from "effect";
import type { Advancement } from "@/shared/entities/world/advancement";
import { freeSlotsOf } from "@/shared/entities/world/advancement";
import { FOCUS_DAYS, focusOf } from "@/shared/entities/world/focus";
import type { Study } from "@/shared/entities/world/research";
import { daysOf } from "@/shared/entities/world/research";
import { techOf } from "@/shared/entities/world/techs";
import type { Stat } from "./stat";

/** What the nation panel says about a nation's research and focus tree. */
export interface AdvancementSummary {
  /** How many technologies it has finished. */
  readonly researched: number;
  /** One row per busy slot with how far along it is, then the free slots. */
  readonly slots: readonly Stat[];
  /** The focus it pursues and the days left on it. */
  readonly focus: Stat;
  /** The focuses it has finished, by name, the first finished first. */
  readonly focusesDone: readonly string[];
}

const PERCENT = 100;

/** The share of its technology's research-days `study` has done, as a percentage. */
export const percentDone = (study: Study): string =>
  `${Math.floor((study.progress / daysOf(study.tech)) * PERCENT)}%`;

/** The busy slots, each with the share of its technology's research-days done. */
const slotRows = (advancement: Advancement): readonly Stat[] => {
  const busy = advancement.research.studies.map((study) => ({
    label: techOf(study.tech).name,
    value: percentDone(study),
  }));
  const free = freeSlotsOf(advancement);
  if (free === 0) {
    return busy;
  }
  return [...busy, { label: "空き枠", value: String(free) }];
};

/** The days left on a focus `progress` days in. */
export const daysLeft = (progress: number): string =>
  `あと${FOCUS_DAYS - progress}日`;

const focusRow = (advancement: Advancement): Stat =>
  Option.match(advancement.focuses.current, {
    onNone: () => ({ label: "進めている方針", value: "なし" }),
    onSome: (pursuit) => ({
      label: focusOf(pursuit.focus).name,
      value: daysLeft(pursuit.progress),
    }),
  });

/** The nation's research and focus tree as the panel reads them. */
export const advancementSummaryOf = (
  advancement: Advancement
): AdvancementSummary => ({
  focus: focusRow(advancement),
  focusesDone: advancement.focuses.done.map((focus) => focusOf(focus).name),
  researched: advancement.research.researched.length,
  slots: slotRows(advancement),
});
