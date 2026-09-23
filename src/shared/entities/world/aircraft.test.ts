import { describe, expect, it } from "vite-plus/test";
import type { Aviation } from "./aircraft";
import { airframeOf, aviationShareOf } from "./aircraft";
import { NO_RESOURCES } from "./resources";

describe(airframeOf, () => {
  it("should give the 1936 fighter's figures when the plane is a fighter", () => {
    expect(airframeOf("fighter")).toStrictEqual({
      agility: 50,
      airAttack: 18,
      airDefence: 10,
      cost: 24,
      fuel: 0.21,
      groundAttack: 0,
      navalAttack: 0,
      resources: { ...NO_RESOURCES, aluminium: 3, rubber: 1 },
      speed: 500,
    });
  });
});

describe(aviationShareOf, () => {
  it.each<{ aviation: Aviation; share: number }>([
    { aviation: "none", share: 0 },
    { aviation: "light", share: 0.2 },
    { aviation: "heavy", share: 0.4 },
  ])(
    "should put $share of the military factories on planes when aviation is $aviation",
    ({ aviation, share }) => {
      expect(aviationShareOf(aviation)).toBe(share);
    }
  );
});
