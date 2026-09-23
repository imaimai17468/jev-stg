import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { Advancement } from "@/shared/entities/world/advancement";
import { START_ADVANCEMENT } from "@/shared/entities/world/advancement";
import type { Study } from "@/shared/entities/world/research";
import type { TechId } from "@/shared/entities/world/techs";
import { advancementSummaryOf } from "./advancement-summary";

/** A study of `tech` with `progress` research-days put into it. */
const studyOf = (tech: TechId, progress: number): Study => ({
  ahead: 0,
  bonus: 0,
  progress,
  saved: 0,
  tech,
});

/** Every slot busy, a focus twenty days in, and two focuses behind it. */
const BUSY: Advancement = {
  focuses: {
    current: Option.some({ focus: "technical-schools", progress: 20 }),
    done: ["research-bureau", "army-effort"],
  },
  research: {
    researched: ["construction-1"],
    saved: [],
    studies: [
      studyOf("fuel-storage", 55),
      studyOf("construction-2", 30),
      studyOf("basic-machine-tools", 0),
      studyOf("electronic-mechanical-engineering", 109.9),
    ],
    vouchers: [],
  },
};

describe(advancementSummaryOf, () => {
  it("should show each slot's progress against its research-days and the days left on the focus when every slot is busy", () => {
    expect(advancementSummaryOf(BUSY)).toStrictEqual({
      focus: { label: "技術学校", value: "あと50日" },
      focusesDone: ["研究局", "陸軍拡張"],
      researched: 1,
      slots: [
        { label: "燃料貯蔵", value: "50%" },
        { label: "建設II", value: "13%" },
        { label: "基本工作機械", value: "0%" },
        { label: "電子機械工学", value: "99%" },
      ],
    });
  });

  it("should count the free slots and show no focus when nothing is pursued or researched", () => {
    expect(advancementSummaryOf(START_ADVANCEMENT)).toStrictEqual({
      focus: { label: "進めている方針", value: "なし" },
      focusesDone: [],
      researched: 21,
      slots: [{ label: "空き枠", value: "3" }],
    });
  });
});
