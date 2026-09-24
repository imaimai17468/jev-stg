import { describe, expect, it } from "vite-plus/test";
import { NO_RESOURCES } from "@/shared/entities/world/economy/resources";
import { richestResourceOf } from "./resource-level";

/** A world digging ten times as much steel as tungsten and twice as much tungsten as chromium. */
const WORLD = { ...NO_RESOURCES, chromium: 50, steel: 1000, tungsten: 100 };

describe(richestResourceOf, () => {
  it("should read a province as holding nothing when it yields nothing", () => {
    expect(richestResourceOf(NO_RESOURCES, WORLD)).toBe("none");
  });

  it("should read a province by its scarcer ore when that is the larger share of the world's", () => {
    expect(
      richestResourceOf({ ...NO_RESOURCES, steel: 20, tungsten: 5 }, WORLD)
    ).toBe("tungsten");
  });

  it("should read a province by its steel when that is the larger share of the world's", () => {
    expect(
      richestResourceOf({ ...NO_RESOURCES, steel: 90, tungsten: 5 }, WORLD)
    ).toBe("steel");
  });
});
