import { describe, expect, it } from "vite-plus/test";
import { HOME } from "@/shared/entities/world/intelligence/espionage";
import { destinationName, projectName } from "./intel-names";

/** Each nation named after its id. */
const nameOf = (nation: number): string => `国${nation}`;

describe(destinationName, () => {
  it("should read counter-intelligence at home when the operatives stay home", () => {
    expect(destinationName(HOME, nameOf)).toBe("自国で防諜");
  });

  it("should name the nation when the operatives work abroad", () => {
    expect(destinationName(2, nameOf)).toBe("国2");
  });
});

describe(projectName, () => {
  it("should read founding when the agency is being founded", () => {
    expect(projectName("found")).toBe("設立");
  });

  it("should name the upgrade when the agency buys one", () => {
    expect(projectName("army-department")).toBe("陸軍部");
  });
});
