import { describe, expect, it } from "vite-plus/test";
import { MAP_COLOURS, NETWORK_COLOURS } from "../map-palette";
import { legendFor } from "./legend-entries";

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

  it("should list each network level from none to strong, striped where it does not count yet, when the map shows intelligence", () => {
    expect(legendFor("intel")).toStrictEqual([
      {
        colour: NETWORK_COLOURS.none,
        hatch: 0,
        key: "none",
        label: "諜報網なし",
      },
      {
        colour: NETWORK_COLOURS.building,
        hatch: 4,
        key: "building",
        label: "諜報網 10未満（まだ効かない）",
      },
      {
        colour: NETWORK_COLOURS.counts,
        hatch: 0,
        key: "counts",
        label: "諜報網 10〜50",
      },
      {
        colour: NETWORK_COLOURS.strong,
        hatch: 0,
        key: "strong",
        label: "諜報網 50以上",
      },
    ]);
  });

  it("should list no swatch when the map shows who holds what", () => {
    expect(legendFor("political")).toStrictEqual([]);
  });
});
