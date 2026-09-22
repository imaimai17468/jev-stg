import { describe, expect, it } from "vite-plus/test";
import { drawMap } from "./draw-map";
import type { MapPen } from "./draw-map";
import type { NationLabel } from "./nation-labels";
import { TWO_NATIONS } from "./world-fixture";

interface Drawn {
  readonly cleared: readonly (readonly number[])[];
  readonly worlds: readonly (readonly number[])[];
  readonly texts: readonly string[];
}

interface Recorder {
  readonly pen: MapPen;
  readonly drawn: Drawn;
}

const recorder = (): Recorder => {
  const cleared: number[][] = [];
  const worlds: number[][] = [];
  const texts: string[] = [];
  return {
    drawn: { cleared, texts, worlds },
    pen: {
      clear: (width, height) => {
        cleared.push([width, height]);
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

    drawMap(pen, TWO_NATIONS, VIEW, SURFACE, []);

    expect(drawn.cleared).toStrictEqual([[200, 100]]);
  });

  it("should place the world at the viewport's offset and scale when a frame is drawn", () => {
    const { drawn, pen } = recorder();

    drawMap(pen, TWO_NATIONS, VIEW, SURFACE, []);

    expect(drawn.worlds).toStrictEqual([[-2, -2, 12, 4]]);
  });

  it("should write a nation's name when it holds enough land to carry one", () => {
    const { drawn, pen } = recorder();

    drawMap(pen, TWO_NATIONS, VIEW, SURFACE, [label(900)]);

    expect(drawn.texts).toStrictEqual(["国0"]);
  });

  it("should write no name when the nation holds less land than a name needs", () => {
    const { drawn, pen } = recorder();

    drawMap(pen, TWO_NATIONS, VIEW, SURFACE, [label(899)]);

    expect(drawn.texts).toStrictEqual([]);
  });
});
