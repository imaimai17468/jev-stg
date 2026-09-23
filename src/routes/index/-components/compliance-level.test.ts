import { describe, expect, it } from "vite-plus/test";
import { complianceLevelOf } from "./compliance-level";

describe(complianceLevelOf, () => {
  it("should read home when the province is the holder's own ground", () => {
    expect(complianceLevelOf({ kind: "home" })).toBe("home");
  });

  it("should read complying when occupied ground has come most of the way round", () => {
    expect(complianceLevelOf({ kind: "occupied", level: 0.7 })).toBe(
      "complying"
    );
  });

  it("should read wavering when it has come part of the way", () => {
    expect(complianceLevelOf({ kind: "occupied", level: 0.4 })).toBe(
      "wavering"
    );
  });

  it("should read defiant when it has hardly come round at all", () => {
    expect(complianceLevelOf({ kind: "occupied", level: 0.1 })).toBe("defiant");
  });
});
