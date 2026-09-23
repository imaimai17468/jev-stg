import { describe, expect, it } from "vite-plus/test";
import { legendFor } from "./legend-entries";
import { MAP_COLOURS } from "./map-palette";

describe(legendFor, () => {
  it("should list who holds each sky, striped where it is fought for, when the map shows air superiority", () => {
    expect(legendFor("air")).toStrictEqual([
      {
        colour: { blue: 150, green: 150, red: 150 },
        hatch: 0,
        key: "held",
        label: "1国が制空権を握る空（その国の色）",
      },
      {
        colour: { blue: 150, green: 150, red: 150 },
        hatch: 3,
        key: "contested",
        label: "争われている空",
      },
      {
        colour: MAP_COLOURS.sea,
        hatch: 0,
        key: "empty",
        label: "誰も飛んでいない空",
      },
    ]);
  });

  it("should list no swatch when the map shows who holds what", () => {
    expect(legendFor("political")).toStrictEqual([]);
  });
});
