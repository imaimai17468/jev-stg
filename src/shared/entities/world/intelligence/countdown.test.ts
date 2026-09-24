import { describe, expect, it } from "vitest";
import { countedDown } from "./countdown";

describe(countedDown, () => {
  it("should drop the items on their last day and take a day off the rest when a day passes", () => {
    const items = [{ daysLeft: 1 }, { daysLeft: 3 }];

    const left = countedDown(items);

    expect(left).toStrictEqual([{ daysLeft: 2 }]);
  });
});
