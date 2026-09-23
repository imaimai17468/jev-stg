import { describe, expect, it } from "vite-plus/test";
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
  return {
    drawn: { cleared, counters, texts, worlds },
    pen: {
      clear: (width, height) => {
        cleared.push([width, height]);
      },
      counter: (value, x, y) => {
        counters.push([Number(value), x, y]);
      },
      text: (value) => {
        texts.push(value);
      },
      world: (x, y, width, height) => {
        worlds.push([x, y, width, height]);
      },
    },
  };
};

const VIEW = { scale: 2, x: 1, y: 1 };
const SURFACE = { height: 100, width: 200 };

const NOTHING_OVER = { labels: [], marks: [] };

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
      labels: [label(900)],
      marks: [],
    });

    expect(drawn.texts).toStrictEqual(["国0"]);
  });

  it("should write no name when the nation holds less land than a name needs", () => {
    const { drawn, pen } = recorder();

    drawMap(pen, FIXTURE_WORLD, VIEW, SURFACE, {
      labels: [label(899)],
      marks: [],
    });

    expect(drawn.texts).toStrictEqual([]);
  });

  it("should centre a counter on its province when divisions stand there", () => {
    const { drawn, pen } = recorder();

    drawMap(pen, FIXTURE_WORLD, VIEW, SURFACE, {
      labels: [],
      marks: [
        {
          colour: { blue: 0, green: 0, red: 0 },
          count: 7,
          province: 0,
          x: 3,
          y: 5,
        },
      ],
    });

    expect(drawn.counters).toStrictEqual([[7, 4, 8]]);
  });
});
