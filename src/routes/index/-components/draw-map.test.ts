import { describe, expect, it } from "vite-plus/test";
import type { SupplyState } from "@/shared/entities/world/supply";
import { drawMap } from "./draw-map";
import type { LineKind, MapPen, Segment } from "./draw-map";
import type { FrontMark, Point } from "./front-marks";
import type { NationLabel } from "./nation-labels";
import type { UnitSymbol } from "./unit-symbols";
import { FIXTURE_WORLD } from "./world-fixture";

interface Drawn {
  readonly cleared: readonly (readonly number[])[];
  readonly worlds: readonly (readonly number[])[];
  readonly texts: readonly string[];
  /** Each counter as its number and the point it was centred on. */
  readonly counters: readonly (readonly number[])[];
  /** Each counter's supply, in the order they were drawn. */
  readonly crates: readonly SupplyState[];
  /** Each counter's unit symbol, in the order they were drawn. */
  readonly symbols: readonly UnitSymbol[];
  /** Each fleet counter as its number and the point it was centred on. */
  readonly fleets: readonly (readonly number[])[];
  /** Each wing counter as its number and the point it was centred on. */
  readonly wings: readonly (readonly number[])[];
  /** Each run of lines as what it was drawn as and its segments, in the order drawn. */
  readonly lines: readonly {
    readonly kind: LineKind;
    readonly segments: readonly Segment[];
  }[];
  readonly arrows: readonly (readonly Point[])[];
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
  const symbols: UnitSymbol[] = [];
  const fleets: number[][] = [];
  const wings: number[][] = [];
  const lines: { kind: LineKind; segments: readonly Segment[] }[] = [];
  const arrows: (readonly Point[])[] = [];
  return {
    drawn: {
      arrows,
      cleared,
      counters,
      crates,
      fleets,
      lines,
      symbols,
      texts,
      wings,
      worlds,
    },
    pen: {
      arrow: (points) => {
        arrows.push(points);
      },
      clear: (width, height) => {
        cleared.push([width, height]);
      },
      counter: (value, x, y, _colour, supply, symbol) => {
        counters.push([Number(value), x, y]);
        crates.push(supply);
        symbols.push(symbol);
      },
      fleet: (value, x, y) => {
        fleets.push([Number(value), x, y]);
      },
      lines: (segments, _colour, kind) => {
        lines.push({ kind, segments });
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

const NOTHING_OVER = {
  fleets: [],
  fronts: [],
  labels: [],
  marks: [],
  wings: [],
};

/** One nation's front along the edge at column 3, its fallback line at column 2, and one offensive. */
const FRONT: FrontMark = {
  colour: { blue: 0, green: 0, red: 0 },
  fallback: [{ towardX: -1, towardY: 0, x1: 2, x2: 2, y1: 1, y2: 3 }],
  front: [{ towardX: 0, towardY: 1, x1: 3, x2: 5, y1: 4, y2: 4 }],
  nation: 0,
  offensives: [
    [
      { x: 3, y: 2 },
      { x: 6, y: 2 },
    ],
  ],
};

const label = (weight: number): NationLabel => ({
  id: 0,
  name: "国0",
  weight,
  x: 3,
  y: 5,
});

describe(drawMap, () => {
  it("should draw the fallback line and then the front, each set off the border into its own side, when a nation has a front", () => {
    const { drawn, pen } = recorder();

    drawMap(pen, FIXTURE_WORLD, VIEW, SURFACE, {
      ...NOTHING_OVER,
      fronts: [FRONT],
    });

    expect(drawn.lines).toStrictEqual([
      { kind: "fallback", segments: [{ x1: 0, x2: 0, y1: 0, y2: 4 }] },
      { kind: "front", segments: [{ x1: 4, x2: 8, y1: 8, y2: 8 }] },
    ]);
  });

  it("should draw each offensive's arrow on screen when a nation has a front", () => {
    const { drawn, pen } = recorder();

    drawMap(pen, FIXTURE_WORLD, VIEW, SURFACE, {
      ...NOTHING_OVER,
      fronts: [FRONT],
    });

    expect(drawn.arrows).toStrictEqual([
      [
        { x: 4, y: 2 },
        { x: 10, y: 2 },
      ],
    ]);
  });

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
          symbol: "infantry",
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
          symbol: "infantry",
          x: 3,
          y: 5,
        },
      ],
    });

    expect(drawn.crates).toStrictEqual(["short"]);
  });

  it("should hand the counter its unit symbol when divisions stand there", () => {
    const { drawn, pen } = recorder();

    drawMap(pen, FIXTURE_WORLD, VIEW, SURFACE, {
      ...NOTHING_OVER,
      marks: [
        {
          colour: { blue: 0, green: 0, red: 0 },
          count: 2,
          province: 0,
          supply: "supplied",
          symbol: "armour",
          x: 3,
          y: 5,
        },
      ],
    });

    expect(drawn.symbols).toStrictEqual(["armour"]);
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
