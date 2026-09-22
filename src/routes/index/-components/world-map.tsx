import { Option } from "effect";
import type {
  KeyboardEvent,
  PointerEvent,
  RefCallback,
  WheelEvent,
} from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { World } from "@/shared/entities/world";
import { drawMap } from "./draw-map";
import { paintWorld } from "./map-bitmap";
import { nationLabels } from "./nation-labels";
import type { Surface, Viewport } from "./viewport";
import { clamped, fitViewport, pannedBy, zoomedAt } from "./viewport";

interface WorldMapProps {
  readonly world: World;
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

const LABEL_FONT = "600 13px system-ui, sans-serif";
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

export const WorldMap = ({ world }: WorldMapProps) => {
  const canvas = useRef(NO_CANVAS);
  const dragFrom = useRef(NO_DRAG);
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

  // One bitmap per world, painted at cell resolution and scaled by the canvas,
  // so a pan or a zoom repaints nothing.
  const painted = useMemo(() => {
    const offscreen = new OffscreenCanvas(world.grid.width, world.grid.height);
    const target = Option.fromNullishOr(offscreen.getContext("2d"));
    if (Option.isNone(target)) {
      return Option.none<OffscreenCanvas>();
    }
    target.value.putImageData(
      new ImageData(paintWorld(world), world.grid.width, world.grid.height),
      0,
      0
    );
    return Option.some(offscreen);
  }, [world]);

  const labels = useMemo(() => nationLabels(world), [world]);

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
      labels
    );
  }, [painted, labels, surface, view, world]);

  const startDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragFrom.current = Option.some({ x: event.clientX, y: event.clientY });
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
    setChosenView((chosen) =>
      Option.some(pannedBy(viewOf(chosen), world.grid, surface, byX, byY))
    );
    dragFrom.current = Option.some({ x: event.clientX, y: event.clientY });
  };

  const endDrag = () => {
    dragFrom.current = NO_DRAG;
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
      aria-label={`シード ${world.seed} の世界地図。矢印キーで移動、プラスとマイナスで拡大縮小`}
      className="size-full cursor-grab touch-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring active:cursor-grabbing"
      onKeyDown={steer}
      onPointerCancel={endDrag}
      onPointerDown={startDrag}
      onPointerMove={continueDrag}
      onPointerUp={endDrag}
      onWheel={zoom}
      ref={attach}
      tabIndex={0}
    />
  );
};
