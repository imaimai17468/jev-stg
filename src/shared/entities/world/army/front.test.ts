import { describe, expect, it } from "vite-plus/test";
import { AT_WAR, LINE_GRAPH, LINE_OWNERS, LINE_WORLD } from "../army-fixture";
import { declared, noWars } from "../wars";
import { enemyNeighbours, frontField, stepToward } from "./front";

describe(frontField, () => {
  it("should count the steps to the line facing the enemy when a war is on", () => {
    const field = frontField(
      LINE_WORLD.provinces,
      LINE_GRAPH,
      LINE_OWNERS,
      AT_WAR,
      0
    );

    expect([...field]).toStrictEqual([1, 0, -1, -1, -1]);
  });

  it("should line up against the enemy rather than a neighbour at peace when both border the nation", () => {
    const threeWay = Int32Array.from([2, 0, 1, 1, -1]);
    const wars = declared(noWars(3), { one: 0, other: 1 });

    const field = frontField(
      LINE_WORLD.provinces,
      LINE_GRAPH,
      threeWay,
      wars,
      0
    );

    expect([...field]).toStrictEqual([-1, 0, -1, -1, -1]);
  });

  it("should watch its borders when the enemy it is fighting no longer touches it", () => {
    const cutOff = Int32Array.from([0, 0, 2, 2, -1]);
    const wars = declared(noWars(3), { one: 0, other: 1 });

    const field = frontField(LINE_WORLD.provinces, LINE_GRAPH, cutOff, wars, 0);

    expect([...field]).toStrictEqual([1, 0, -1, -1, -1]);
  });

  it("should run to the nation's own border when it is fighting nobody", () => {
    const field = frontField(
      LINE_WORLD.provinces,
      LINE_GRAPH,
      LINE_OWNERS,
      noWars(2),
      0
    );

    expect([...field]).toStrictEqual([1, 0, -1, -1, -1]);
  });

  it("should reach nothing when the nation holds no border and no enemy", () => {
    const alone = Int32Array.from([0, 0, 0, 0, -1]);

    const field = frontField(
      LINE_WORLD.provinces,
      LINE_GRAPH,
      alone,
      noWars(2),
      0
    );

    expect([...field]).toStrictEqual([-1, -1, -1, -1, -1]);
  });
});

describe(stepToward, () => {
  it("should walk to the neighbour nearer the front when one is nearer", () => {
    const field = Int32Array.from([2, 1, 0, 0, -1]);

    expect(stepToward(LINE_GRAPH, field, 0)).toBe(1);
  });

  it("should stand still when the division is already at the front", () => {
    const field = Int32Array.from([2, 1, 0, 0, -1]);

    expect(stepToward(LINE_GRAPH, field, 2)).toBe(2);
  });

  it("should stand still when no route leads to the front at all", () => {
    const field = Int32Array.from([-1, -1, -1, -1, -1]);

    expect(stepToward(LINE_GRAPH, field, 0)).toBe(0);
  });

  it("should stand still when every neighbour is further from the front", () => {
    const field = Int32Array.from([1, 4, 4, 4, -1]);

    expect(stepToward(LINE_GRAPH, field, 0)).toBe(0);
  });
});

describe(enemyNeighbours, () => {
  it("should name the enemy's provinces when they touch the one a stack stands in", () => {
    expect(
      enemyNeighbours(LINE_GRAPH, LINE_OWNERS, AT_WAR, 0, 1)
    ).toStrictEqual([2]);
  });

  it("should name nothing when the neighbours are at peace with the nation", () => {
    expect(
      enemyNeighbours(LINE_GRAPH, LINE_OWNERS, noWars(2), 0, 1)
    ).toStrictEqual([]);
  });
});
