import { describe, expect, it } from "vite-plus/test";
import type { SupplyState } from "@/shared/entities/world/supply";
import { drawMap } from "./draw-map";
import type { MapPen } from "./draw-map";
import type { NationLabel } from "./nation-labels";
import { FIXTURE_WORLD } from "./world-fixture";

interface Drawn {
  readonly cleared: readonly (readonly number[])[];
  readonly worlds: readonly (readonly number[])[];
  readonly texts: readonly string[];
  /** Each counter as its number and the point it was centred on. */
  readonly counters: readonly (readonly number[])[];
  /** Each counter's supply, in the order they were drawn. */
  readonly crates: readonly SupplyState[];
  /** Each fleet counter as its number and the point it was centred on. */
  readonly fleets: readonly (readonly number[])[];
  /** Each wing counter as its number and the point it was centred on. */
  readonly wings: readonly (readonly number[])[];
}

interface Recorder {
  readonly pen: MapPen;
  readonly drawn: Drawn;
}

const recorder = (): Recorder => {
  const cleared: number[][] = [];
  const worlds: number[][] = [];
  const texts: string[] = [];
  const counters: number[][] = [];
  const crates: SupplyState[] = [];
  const fleets: number[][] = [];
  const wings: number[][] = [];
  return {
    drawn: { cleared, counters, crates, fleets, texts, wings, worlds },
    pen: {
      clear: (width, height) => {
        cleared.push([width, height]);
      },
      counter: (value, x, y, _colour, supply) => {
        counters.push([Number(value), x, y]);
        crates.push(supply);
      },
      fleet: (value, x, y) => {
        fleets.push([Number(value), x, y]);
      },
      text: (value) => {
        texts.push(value);
      },
      wing: (value, x, y) => {
        wings.push([Number(value), x, y]);
      },
      world: (x, y, width, height) => {
        worlds.push([x, y, width, height]);
      },
    },
  };
};

const VIEW = { scale: 2, x: 1, y: 1 };
const SURFACE = { height: 100, width: 200 };

const NOTHING_OVER = { fleets: [], labels: [], marks: [], wings: [] };

const label = (weight: number): NationLabel => ({
  id: 0,
  name: "国0",
  weight,
  x: 3,
  y: 5,
});

describe(drawMap, () => {
  it("should clear the whole surface when a frame is drawn", () => {
    const { drawn, pen } = recorder();

    drawMap(pen, FIXTURE_WORLD, VIEW, SURFACE, NOTHING_OVER);

    expect(drawn.cleared).toStrictEqual([[200, 100]]);
  });

  it("should place the world at the viewport's offset and scale when a frame is drawn", () => {
    const { drawn, pen } = recorder();

    drawMap(pen, FIXTURE_WORLD, VIEW, SURFACE, NOTHING_OVER);

    expect(drawn.worlds).toStrictEqual([[-2, -2, 12, 4]]);
  });

  it("should write a nation's name when it holds enough land to carry one", () => {
    const { drawn, pen } = recorder();

    drawMap(pen, FIXTURE_WORLD, VIEW, SURFACE, {
      ...NOTHING_OVER,
      labels: [label(900)],
    });

    expect(drawn.texts).toStrictEqual(["国0"]);
  });

  it("should write no name when the nation holds less land than a name needs", () => {
    const { drawn, pen } = recorder();

    drawMap(pen, FIXTURE_WORLD, VIEW, SURFACE, {
      ...NOTHING_OVER,
      labels: [label(899)],
    });

    expect(drawn.texts).toStrictEqual([]);
  });

  it("should centre a counter on its province when divisions stand there", () => {
    const { drawn, pen } = recorder();

    drawMap(pen, FIXTURE_WORLD, VIEW, SURFACE, {
      ...NOTHING_OVER,
      marks: [
        {
          colour: { blue: 0, green: 0, red: 0 },
          count: 7,
          province: 0,
          supply: "supplied",
          x: 3,
          y: 5,
        },
      ],
    });

    expect(drawn.counters).toStrictEqual([[7, 4, 8]]);
  });

  it("should hand the counter its divisions' supply when they are short of it", () => {
    const { drawn, pen } = recorder();

    drawMap(pen, FIXTURE_WORLD, VIEW, SURFACE, {
      ...NOTHING_OVER,
      marks: [
        {
          colour: { blue: 0, green: 0, red: 0 },
          count: 3,
          province: 0,
          supply: "short",
          x: 3,
          y: 5,
        },
      ],
    });

    expect(drawn.crates).toStrictEqual(["short"]);
  });

  it("should centre a fleet counter on its zone when warships are at sea there", () => {
    const { drawn, pen } = recorder();

    drawMap(pen, FIXTURE_WORLD, VIEW, SURFACE, {
      ...NOTHING_OVER,
      fleets: [
        {
          colour: { blue: 0, green: 0, red: 0 },
          count: 4,
          x: 4.5,
          y: 0.5,
        },
      ],
    });

    expect(drawn.fleets).toStrictEqual([[4, 7, -1]]);
  });

  it("should centre a wing counter on its region when planes fly a mission over it", () => {
    const { drawn, pen } = recorder();

    drawMap(pen, FIXTURE_WORLD, VIEW, SURFACE, {
      ...NOTHING_OVER,
      wings: [
        {
          colour: { blue: 0, green: 0, red: 0 },
          count: 120,
          x: 1.5,
          y: 2,
        },
      ],
    });

    expect(drawn.wings).toStrictEqual([[120, 1, 2]]);
  });
});
