import { Option } from "effect";
import type {
  KeyboardEvent,
  PointerEvent,
  RefCallback,
  WheelEvent,
} from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { World } from "@/shared/entities/world";
import type { Compliance } from "@/shared/entities/world/compliance";
import type { Division } from "@/shared/entities/world/divisions";
import type { SupplyNetwork } from "@/shared/entities/world/supply";
import { divisionMarks } from "./division-marks";
import { drawMap } from "./draw-map";
import { paintWorld } from "./map-bitmap";
import type { MapMode } from "./map-mode";
import { tintFor } from "./map-mode";
import { CRATES } from "./map-palette";
import { nationLabels } from "./nation-labels";
import { nationAt } from "./pick-nation";
import type { Surface, Viewport } from "./viewport";
import { clamped, fitViewport, pannedBy, zoomedAt } from "./viewport";

interface WorldMapProps {
  readonly world: World;
  /** Who holds each province now, by province id. */
  readonly owners: Int32Array;
  readonly divisions: readonly Division[];
  /** What every nation's supply can do today. */
  readonly supply: SupplyNetwork;
  /** How far the people of each province go along with whoever holds it. */
  readonly compliance: Compliance;
  /** What the provinces are coloured by. */
  readonly mode: MapMode;
  /** The nation drawn brighter than the rest, where one is picked. */
  readonly highlighted: Option.Option<number>;
  readonly onSelectNation: (nation: Option.Option<number>) => void;
  readonly onTogglePause: () => void;
}

/** Where a drag was last seen, in client coordinates. */
interface Point {
  readonly x: number;
  readonly y: number;
}

const noCleanup = () => {
  // Nothing was attached, so there is nothing to detach.
};

const UNMEASURED: Surface = { height: 0, width: 0 };
const NO_VIEW = Option.none<Viewport>();
const NO_CANVAS = Option.none<HTMLCanvasElement>();
const NO_DRAG = Option.none<Point>();

/** Wheel delta arrives in pixels, so the base sits near 1 and compounds. */
const ZOOM_PER_PIXEL = 1.0018;
/** What one key press moves the map, in screen pixels and in scale. */
const KEY_PAN = 96;
const KEY_ZOOM = 1.3;
/**
 * How far a pointer may travel and still count as a click rather than a drag.
 *
 * A finger resting on one province still reports a stream of moves, so touch is
 * given more room than a mouse whose position holds still.
 */
const CLICK_SLACK = { mouse: 4, pen: 6, touch: 12 };

const slackFor = (pointerType: string): number => {
  if (pointerType === "touch") {
    return CLICK_SLACK.touch;
  }
  if (pointerType === "pen") {
    return CLICK_SLACK.pen;
  }
  return CLICK_SLACK.mouse;
};

const LABEL_FONT = "600 13px system-ui, sans-serif";
/** How big an army counter is drawn, in screen pixels. */
const COUNTER_WIDTH = 24;
const COUNTER_HEIGHT = 14;
/** The nation's colour down the counter's left edge, which says whose it is. */
const COUNTER_STRIPE = 4;
/**
 * Dark rather than the nation's colour, because a counter filled with the
 * colour of the land under it disappears into that land.
 */
const COUNTER_FILL = "rgba(12, 14, 20, 0.88)";
const COUNTER_FONT = "600 10px system-ui, sans-serif";
/** The crate beside a counter whose divisions are short of supply, in screen pixels. */
const CRATE_SIZE = 8;
const CRATE_GAP = 2;
const CRATE_LINE = 1.5;

const noCrate = () => {
  // The divisions get all the supply they need, so no crate is drawn.
};

/** Draws a crate filled or outlined, which is what tells short from starved. */
const FILL_CRATE = {
  false: (pen: CanvasRenderingContext2D, left: number, top: number) => {
    pen.strokeRect(
      left + CRATE_LINE / 2,
      top + CRATE_LINE / 2,
      CRATE_SIZE - CRATE_LINE,
      CRATE_SIZE - CRATE_LINE
    );
  },
  true: (pen: CanvasRenderingContext2D, left: number, top: number) => {
    pen.fillRect(left, top, CRATE_SIZE, CRATE_SIZE);
  },
} satisfies Record<
  `${boolean}`,
  (pen: CanvasRenderingContext2D, left: number, top: number) => void
>;
const COUNTER_INK = "rgba(255, 255, 255, 0.95)";
const LABEL_INK = "rgba(255, 255, 255, 0.88)";
const LABEL_OUTLINE = "rgba(0, 0, 0, 0.65)";
const LABEL_OUTLINE_WIDTH = 3;

const measure = (element: HTMLCanvasElement): Surface => ({
  height: element.clientHeight,
  width: element.clientWidth,
});

/** How far a key press pushes the map, or nothing for a key the map ignores. */
const panForKey = (key: string): Point => {
  if (key === "ArrowLeft") {
    return { x: KEY_PAN, y: 0 };
  }
  if (key === "ArrowRight") {
    return { x: -KEY_PAN, y: 0 };
  }
  if (key === "ArrowUp") {
    return { x: 0, y: KEY_PAN };
  }
  if (key === "ArrowDown") {
    return { x: 0, y: -KEY_PAN };
  }
  return { x: 0, y: 0 };
};

/** What a key does to the scale, or 1 for a key the map ignores. */
const zoomForKey = (key: string): number => {
  if (key === "+" || key === "=") {
    return KEY_ZOOM;
  }
  if (key === "-") {
    return 1 / KEY_ZOOM;
  }
  return 1;
};

const WorldMapSurface = ({
  compliance,
  divisions,
  highlighted,
  mode,
  onSelectNation,
  onTogglePause,
  owners,
  supply,
  world,
}: WorldMapProps) => {
  const canvas = useRef(NO_CANVAS);
  const dragFrom = useRef(NO_DRAG);
  const dragTravel = useRef(0);
  const dragSlack = useRef(CLICK_SLACK.mouse);
  const [surface, setSurface] = useState<Surface>(UNMEASURED);
  const [chosenView, setChosenView] = useState(NO_VIEW);
  // The element the ref was last handed. It is state as well as a ref so the
  // observer below is torn down and rebuilt against the element rather than
  // against the mount, and a ref so the painting effect reaches it without
  // mutating a value the render read.
  const [attached, setAttached] = useState(NO_CANVAS);

  const attach: RefCallback<HTMLCanvasElement> = useCallback((node) => {
    const element = Option.fromNullishOr(node);
    canvas.current = element;
    setAttached(element);
  }, []);

  useEffect(() => {
    // Synchronise the measured size with the element's box. The observer
    // reports the first box itself, so nothing here measures up front.
    if (Option.isNone(attached)) {
      return noCleanup;
    }
    const element = attached.value;
    const observer = new ResizeObserver(() => {
      setSurface(measure(element));
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [attached]);

  const tint = useMemo(
    () => tintFor(mode, { compliance, network: supply }),
    [mode, supply, compliance]
  );

  // One bitmap per world, painted at cell resolution and scaled by the canvas,
  // so a pan or a zoom repaints nothing.
  const painted = useMemo(() => {
    const offscreen = new OffscreenCanvas(world.grid.width, world.grid.height);
    const target = Option.fromNullishOr(offscreen.getContext("2d"));
    if (Option.isNone(target)) {
      return Option.none<OffscreenCanvas>();
    }
    target.value.putImageData(
      new ImageData(
        paintWorld(world, owners, highlighted, tint),
        world.grid.width,
        world.grid.height
      ),
      0,
      0
    );
    return Option.some(offscreen);
  }, [world, owners, highlighted, tint]);

  const overlay = useMemo(
    () => ({
      labels: nationLabels(world, owners),
      marks: divisionMarks(world, divisions, supply),
    }),
    [world, owners, divisions, supply]
  );

  const viewOf = useCallback(
    (chosen: Option.Option<Viewport>): Viewport =>
      clamped(
        Option.getOrElse(chosen, () => fitViewport(world.grid, surface)),
        world.grid,
        surface
      ),
    [world.grid, surface]
  );

  const view = viewOf(chosenView);

  useEffect(() => {
    // Synchronise the canvas with the viewport the render settled on.
    if (Option.isNone(canvas.current) || surface.width === 0) {
      return;
    }
    const element = canvas.current.value;
    const context = Option.fromNullishOr(element.getContext("2d"));
    if (Option.isNone(context)) {
      return;
    }
    const pen = context.value;
    const ratio = window.devicePixelRatio;
    const width = Math.round(surface.width * ratio);
    const height = Math.round(surface.height * ratio);
    // Assigning either side resets the backing store even when the value is
    // unchanged, which would reallocate it on every pointer move.
    if (element.width !== width) {
      element.width = width;
    }
    if (element.height !== height) {
      element.height = height;
    }
    pen.setTransform(ratio, 0, 0, ratio, 0, 0);
    pen.imageSmoothingEnabled = false;
    pen.font = LABEL_FONT;
    pen.textAlign = "center";
    pen.textBaseline = "middle";
    pen.lineWidth = LABEL_OUTLINE_WIDTH;
    pen.strokeStyle = LABEL_OUTLINE;
    pen.fillStyle = LABEL_INK;
    drawMap(
      {
        clear: (clearWidth, clearHeight) => {
          pen.clearRect(0, 0, clearWidth, clearHeight);
        },
        counter: (value, x, y, colour, crate) => {
          const left = x - COUNTER_WIDTH / 2;
          const top = y - COUNTER_HEIGHT / 2;
          pen.fillStyle = COUNTER_FILL;
          pen.fillRect(left, top, COUNTER_WIDTH, COUNTER_HEIGHT);
          pen.fillStyle = `rgb(${colour.red} ${colour.green} ${colour.blue})`;
          pen.fillRect(left, top, COUNTER_STRIPE, COUNTER_HEIGHT);
          pen.fillStyle = COUNTER_INK;
          pen.font = COUNTER_FONT;
          pen.fillText(value, x + COUNTER_STRIPE / 2, y);
          Option.match(CRATES[crate], {
            onNone: noCrate,
            onSome: (drawn) => {
              const crateLeft = left + COUNTER_WIDTH + CRATE_GAP;
              const crateTop = y - CRATE_SIZE / 2;
              const ink = `rgb(${drawn.colour.red} ${drawn.colour.green} ${drawn.colour.blue})`;
              pen.fillStyle = COUNTER_FILL;
              pen.fillRect(
                crateLeft - 1,
                crateTop - 1,
                CRATE_SIZE + 2,
                CRATE_SIZE + 2
              );
              pen.fillStyle = ink;
              pen.strokeStyle = ink;
              pen.lineWidth = CRATE_LINE;
              FILL_CRATE[`${drawn.filled}`](pen, crateLeft, crateTop);
              pen.lineWidth = LABEL_OUTLINE_WIDTH;
              pen.strokeStyle = LABEL_OUTLINE;
            },
          });
          pen.font = LABEL_FONT;
          pen.fillStyle = LABEL_INK;
        },
        text: (value, x, y) => {
          pen.strokeText(value, x, y);
          pen.fillText(value, x, y);
        },
        world: (x, y, imageWidth, imageHeight) => {
          if (Option.isSome(painted)) {
            pen.drawImage(painted.value, x, y, imageWidth, imageHeight);
          }
        },
      },
      world,
      view,
      surface,
      overlay
    );
  }, [painted, overlay, surface, view, world]);

  const startDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragFrom.current = Option.some({ x: event.clientX, y: event.clientY });
    dragTravel.current = 0;
    dragSlack.current = slackFor(event.pointerType);
  };

  // Every handler below folds the previous viewport rather than the one this
  // render holds, because a burst of pointer or wheel events is delivered before
  // React renders the first of them.
  const continueDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    const from = dragFrom.current;
    if (Option.isNone(from)) {
      return;
    }
    const byX = event.clientX - from.value.x;
    const byY = event.clientY - from.value.y;
    dragTravel.current += Math.abs(byX) + Math.abs(byY);
    setChosenView((chosen) =>
      Option.some(pannedBy(viewOf(chosen), world.grid, surface, byX, byY))
    );
    dragFrom.current = Option.some({ x: event.clientX, y: event.clientY });
  };

  const endDrag = () => {
    dragFrom.current = NO_DRAG;
  };

  // A pointer that went nowhere between down and up is a click on a country,
  // where one that travelled was the viewer moving the map.
  const pick = (event: PointerEvent<HTMLCanvasElement>) => {
    // A release whose press landed somewhere else, such as a button in the HUD,
    // is that control's gesture rather than a click on a country.
    if (Option.isNone(dragFrom.current)) {
      return;
    }
    if (dragTravel.current > dragSlack.current) {
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    onSelectNation(
      nationAt(
        world,
        owners,
        view,
        event.clientX - box.left,
        event.clientY - box.top
      )
    );
  };

  const zoom = (event: WheelEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const factor = ZOOM_PER_PIXEL ** -event.deltaY;
    const atX = event.clientX - box.left;
    const atY = event.clientY - box.top;
    setChosenView((chosen) =>
      Option.some(
        zoomedAt(viewOf(chosen), world.grid, surface, factor, atX, atY)
      )
    );
  };

  const steer = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === " ") {
      // Every repeat still has to swallow the page scroll, and only the first
      // of them is the viewer asking to pause.
      event.preventDefault();
      if (event.repeat) {
        return;
      }
      onTogglePause();
      return;
    }
    const pan = panForKey(event.key);
    const factor = zoomForKey(event.key);
    if (pan.x === 0 && pan.y === 0 && factor === 1) {
      return;
    }
    event.preventDefault();
    setChosenView((chosen) =>
      Option.some(
        zoomedAt(
          pannedBy(viewOf(chosen), world.grid, surface, pan.x, pan.y),
          world.grid,
          surface,
          factor,
          surface.width / 2,
          surface.height / 2
        )
      )
    );
  };

  return (
    <canvas
      aria-label={`シード ${world.seed} の世界地図。クリックで国を選択、矢印キーで移動、プラスとマイナスで拡大縮小、スペースで一時停止`}
      className="size-full cursor-grab touch-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring active:cursor-grabbing"
      onKeyDown={steer}
      onPointerCancel={endDrag}
      onPointerDown={startDrag}
      onPointerMove={continueDrag}
      onPointerUp={(event) => {
        pick(event);
        endDrag();
      }}
      onWheel={zoom}
      ref={attach}
      tabIndex={0}
    />
  );
};

/**
 * The map redraws only when the world, the picked nation, the mode or what it
 * shows changes, so the calendar ticking beside it costs nothing here.
 */
export const WorldMap = memo(WorldMapSurface);
