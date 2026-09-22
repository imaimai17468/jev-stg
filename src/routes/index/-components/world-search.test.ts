import { describe, expect, it } from "vite-plus/test";
import { parseWorldSearch } from "./world-search";

describe(parseWorldSearch, () => {
  it("should carry the seed when the search holds a number", () => {
    expect(parseWorldSearch({ seed: 4321 })).toStrictEqual({ seed: 4321 });
  });

  it("should carry the seed when the search holds it as text", () => {
    expect(parseWorldSearch({ seed: "88" })).toStrictEqual({ seed: 88 });
  });

  it("should carry no seed when the search holds none", () => {
    expect(parseWorldSearch({})).toStrictEqual({});
  });

  it("should carry no seed when the search holds text that is not a number", () => {
    expect(parseWorldSearch({ seed: "east" })).toStrictEqual({});
  });

  it("should carry no seed when the search holds the one value the generator cannot start from", () => {
    expect(parseWorldSearch({ seed: 0 })).toStrictEqual({});
  });
});
