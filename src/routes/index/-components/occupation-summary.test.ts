import { describe, expect, it } from "vite-plus/test";
import { LINE_OWNERS, LINE_WORLD } from "@/shared/entities/world/army-fixture";
import type { Compliance } from "@/shared/entities/world/compliance";
import { startCompliance } from "@/shared/entities/world/compliance";
import { UNASSIGNED } from "@/shared/entities/world/spread";
import { occupationSummaryOf } from "./occupation-summary";

/** Nation 0 holding nation 1's provinces 2, a quarter round, and 3, just taken. */
const OCCUPIED: Compliance = {
  ...startCompliance(LINE_OWNERS),
  holders: Int32Array.from([0, 0, 0, 1, UNASSIGNED]),
  levels: Float32Array.from([1, 1, 0.25, 1, 1]),
};

describe(occupationSummaryOf, () => {
  it("should count the occupied ground, its average compliance and what the nation can draw on when it occupies some", () => {
    expect(
      occupationSummaryOf(
        LINE_WORLD,
        Int32Array.from([0, 0, 0, 0, UNASSIGNED]),
        OCCUPIED,
        0
      )
    ).toStrictEqual([
      { label: "占領している州", value: "2" },
      { label: "平均の服従度", value: "13%" },
      { label: "召集できる人口", value: "52%" },
      { label: "動かせる工場", value: "67%" },
    ]);
  });
});
