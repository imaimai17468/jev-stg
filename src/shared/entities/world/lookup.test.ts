import { describe, expect, it } from "vite-plus/test";
import { itemAt, lastWhere, replacedAt } from "./lookup";

describe(itemAt, () => {
  it("should answer the stored item when the index is inside the list", () => {
    expect(itemAt(["a", "b"], 1, "z")).toBe("b");
  });

  it("should answer the fallback when the index is past the end", () => {
    expect(itemAt(["a", "b"], 4, "z")).toBe("z");
  });
});

describe(replacedAt, () => {
  it("should replace only the item at the index when the index is inside the list", () => {
    expect(replacedAt(["a", "b", "c"], 1, "B")).toStrictEqual(["a", "B", "c"]);
  });
});

describe(lastWhere, () => {
  it("should answer the last item kept when several are", () => {
    expect(
      lastWhere(["a1", "b", "a2"], (item) => item.startsWith("a"), "z")
    ).toBe("a2");
  });

  it("should answer the fallback when none is kept", () => {
    expect(lastWhere(["a", "b"], (item) => item === "c", "z")).toBe("z");
  });
});
