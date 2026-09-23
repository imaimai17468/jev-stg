import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { headlineOf } from "./headline";
import { summaryOf } from "./nation-summary";
import { TWO_NATIONS } from "./world-fixture";

describe(headlineOf, () => {
  it("should count the world when no nation is picked", () => {
    expect(headlineOf(TWO_NATIONS, Option.none())).toStrictEqual({
      stats: [
        { label: "国", value: "2" },
        { label: "州", value: "3" },
        { label: "seed", value: "1" },
      ],
      title: "世界",
    });
  });

  it("should count the nation when one is picked", () => {
    const selection = Option.some(summaryOf(TWO_NATIONS, 1));

    expect(headlineOf(TWO_NATIONS, selection)).toStrictEqual({
      stats: [
        { label: "州", value: "1" },
        { label: "面積", value: "4" },
        { label: "隣接", value: "0" },
      ],
      title: "国1",
    });
  });
});
