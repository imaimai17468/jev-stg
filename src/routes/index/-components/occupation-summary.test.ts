import { describe, expect, it } from "vite-plus/test";
import {
  LINE_OWNERS,
  LINE_PLANTS,
  LINE_WORLD,
} from "@/shared/entities/world/army-fixture";
import type { Compliance } from "@/shared/entities/world/economy/compliance";
import { startCompliance } from "@/shared/entities/world/economy/compliance";
import { UNASSIGNED } from "@/shared/entities/world/spread";
import type { Stirred } from "@/shared/entities/world/unrest";
import type { Occupation } from "./occupation-summary";
import { occupationSummaryOf } from "./occupation-summary";

/** Nation 0 holding nation 1's provinces 2, a quarter round, and 3, just taken. */
const OCCUPIED: Compliance = {
  ...startCompliance(LINE_OWNERS),
  holders: Int32Array.from([0, 0, 0, 1, UNASSIGNED]),
  levels: Float32Array.from([1, 1, 0.25, 1, 1]),
};

/** No resistance work running anywhere on the line. */
const CALM: Stirred = {
  resistance: new Float32Array(5),
  sabotage: new Float32Array(5),
};

/** Nation 0 holding the whole line's land, with `stirred` running against it. */
const occupationUnder = (stirred: Stirred): Occupation => ({
  compliance: OCCUPIED,
  owners: Int32Array.from([0, 0, 0, 0, UNASSIGNED]),
  plants: LINE_PLANTS,
  stirred,
});

describe(occupationSummaryOf, () => {
  it("should count the occupied ground, its average compliance and what the nation can draw on when it occupies some", () => {
    expect(
      occupationSummaryOf(LINE_WORLD, occupationUnder(CALM), 0)
    ).toStrictEqual([
      { label: "占領している州", value: "2" },
      { label: "平均の服従度", value: "13%" },
      { label: "抵抗運動が強まっている州", value: "0" },
      { label: "破壊工作を受けている州", value: "0" },
      { label: "召集できる人口", value: "52%" },
      { label: "動かせる工場", value: "67%" },
    ]);
  });

  it("should count the provinces stirred up and sabotaged and draw on fewer factories when enemy operatives work against the occupation", () => {
    expect(
      occupationSummaryOf(
        LINE_WORLD,
        occupationUnder({
          resistance: Float32Array.from([0, 0, 0.1, 0.1, 0]),
          sabotage: Float32Array.from([0, 0, 0, 0.5, 0]),
        }),
        0
      ).slice(2)
    ).toStrictEqual([
      { label: "抵抗運動が強まっている州", value: "2" },
      { label: "破壊工作を受けている州", value: "1" },
      { label: "召集できる人口", value: "52%" },
      { label: "動かせる工場", value: "63%" },
    ]);
  });

  it("should put a dash for the average compliance when the nation occupies nothing", () => {
    expect(
      occupationSummaryOf(
        LINE_WORLD,
        {
          compliance: startCompliance(LINE_OWNERS),
          owners: LINE_OWNERS,
          plants: LINE_PLANTS,
          stirred: CALM,
        },
        0
      ).at(1)
    ).toStrictEqual({ label: "平均の服従度", value: "—" });
  });
});
