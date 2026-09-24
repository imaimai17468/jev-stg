import { describe, expect, it } from "vite-plus/test";
import { land, sea } from "../army-fixture";
import { graphOf } from "../provinces";
import { UNASSIGNED } from "../spread";
import type { Build } from "./networks";
import { networkBuiltOneDay, noNetworks } from "./networks";

/**
 * Seven land provinces in a row with a sea zone off province 2. Nation 0
 * holds province 0 and nation 1 the other six, so a network built in
 * province 1 meets foreign ground one way, the sea on the second step, and
 * runs out of steps before province 6.
 */
const ROW_GRAPH = graphOf([
  land(0, [1]),
  land(1, [0, 2]),
  land(2, [1, 3, 7]),
  land(3, [2, 4]),
  land(4, [3, 5]),
  land(5, [4, 6]),
  land(6, [5]),
  sea(7, [2]),
]);

const ROW_OWNERS = Int32Array.from([0, 1, 1, 1, 1, 1, 1, UNASSIGNED]);

/** One operative building from province 1 on nation 1's ground, with whatever a test needs changed. */
const building = (patch: Partial<Build>): Build => ({
  center: 1,
  counterIntelligence: 0,
  host: 1,
  operatives: 1,
  ...patch,
});

/** The network one day on from `strengths` with `builds`, on the row. */
const builtFrom = (
  strengths: readonly number[],
  builds: readonly Build[]
): Float32Array =>
  networkBuiltOneDay(
    Float32Array.from(strengths),
    builds,
    ROW_GRAPH,
    ROW_OWNERS
  );

const EMPTY = [0, 0, 0, 0, 0, 0, 0, 0];

describe(noNetworks, () => {
  it("should give every nation an empty network over every province when nothing is built yet", () => {
    expect(noNetworks(2, 3)).toStrictEqual([
      new Float32Array(3),
      new Float32Array(3),
    ]);
  });
});

describe(networkBuiltOneDay, () => {
  it("should halve the gain at every step over the host's land when one operative builds", () => {
    expect(builtFrom(EMPTY, [building({})])).toStrictEqual(
      Float32Array.from([0, 0.4, 0.2, 0.1, 0.05, 0.025, 0, 0])
    );
  });

  it("should slow the gain by the host's counter-intelligence when the host fields some", () => {
    expect(
      builtFrom(EMPTY, [building({ counterIntelligence: 4, operatives: 2 })])
    ).toStrictEqual(Float32Array.from([0, 0.4, 0.2, 0.1, 0.05, 0.025, 0, 0]));
  });

  it("should add the gains together when two builds reach the same provinces", () => {
    expect(builtFrom(EMPTY, [building({}), building({})])).toStrictEqual(
      Float32Array.from([0, 0.8, 0.4, 0.2, 0.1, 0.05, 0, 0])
    );
  });

  it("should let every province lose a little down to nothing when nobody builds", () => {
    expect(builtFrom([1, 0.02, 0, 0, 0, 0, 0, 0], [])).toStrictEqual(
      Float32Array.from([0.95, 0, 0, 0, 0, 0, 0, 0])
    );
  });

  it("should grow no stronger than the most a network grows when a build tops a strong province", () => {
    expect(
      builtFrom([0, 99.9, 0, 0, 0, 0, 0, 0], [building({})])
    ).toStrictEqual(Float32Array.from([0, 100, 0.2, 0.1, 0.05, 0.025, 0, 0]));
  });
});
