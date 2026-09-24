import { describe, expect, it } from "vite-plus/test";
import { transportsFor } from "./airborne";

describe(transportsFor, () => {
  it.each([
    { divisions: 0, transports: 0 },
    { divisions: 1, transports: 50 },
    { divisions: 3, transports: 135 },
  ])(
    "should take $transports transport planes when $divisions paratrooper divisions drop at once",
    ({ divisions, transports }) => {
      expect(transportsFor(divisions)).toBe(transports);
    }
  );
});
