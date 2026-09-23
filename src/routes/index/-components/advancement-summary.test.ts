import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { Advancement } from "@/shared/entities/world/advancement";
import { advancementSummaryOf } from "./advancement-summary";

/** Every slot busy, a focus twenty days in, and two focuses behind it. */
const BUSY: Advancement = {
  focuses: {
    current: Option.some({ focus: "technical-schools", progress: 20 }),
    done: ["research-bureau", "army-effort"],
  },
  research: {
    researched: ["tools-1"],
    studies: [
      { progress: 50, tech: "artillery-1" },
      { progress: 30, tech: "tools-2" },
      { progress: 0, tech: "construction-1" },
      { progress: 99.9, tech: "electronics-1" },
    ],
  },
};

describe(advancementSummaryOf, () => {
  it("should show each slot's progress against this year's cost and the days left on the focus when every slot is busy", () => {
    expect(advancementSummaryOf(BUSY, 1936)).toStrictEqual({
      focus: { label: "技術学校", value: "あと50日" },
      focusesDone: ["研究局", "陸軍拡張"],
      researched: 1,
      slots: [
        { label: "野砲I", value: "50%" },
        { label: "工作機械II", value: "13%" },
        { label: "建設技術I", value: "0%" },
        { label: "電子工学", value: "99%" },
      ],
    });
  });
});
