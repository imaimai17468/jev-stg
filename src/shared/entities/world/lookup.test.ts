import { describe, expect, it } from "vite-plus/test";
import { itemAt } from "./lookup";

describe(itemAt, () => {
  it("should answer the stored item when the index is inside the list", () => {
    expect(itemAt(["a", "b"], 1, "z")).toBe("b");
  });

  it("should answer the fallback when the index is past the end", () => {
    expect(itemAt(["a", "b"], 4, "z")).toBe("z");
  });
});
