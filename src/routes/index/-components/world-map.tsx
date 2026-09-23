import { Option } from "effect";
import type {
  KeyboardEvent,
  PointerEvent,
  RefCallback,
  WheelEvent,
} from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { World } from "@/shared/entities/world";
import type { AirForce } from "@/shared/entities/world/air-force";
import type { Compliance } from "@/shared/entities/world/compliance";
import type { Division } from "@/shared/entities/world/divisions";
import { itemAt } from "@/shared/entities/world/lookup";
import type { Colour } from "@/shared/entities/world/nations";
import type { Navy } from "@/shared/entities/world/navy";
import { watersOf } from "@/shared/entities/world/navy";
import type { Networks } from "@/shared/entities/world/networks";
import { graphOf } from "@/shared/entities/world/provinces";
import type { Skies } from "@/shared/entities/world/skies";
import { skiesBelow } from "@/shared/entities/world/skies";
import type {
  SupplyNetwork,
  SupplyState,
} from "@/shared/entities/world/supply";
import type { Wars } from "@/shared/entities/world/wars";
import { divisionMarks } from "./division-marks";
import type { LineKind, Segment } from "./draw-map";
import { drawMap } from "./draw-map";
import { fleetMarks } from "./fleet-marks";
import { FrontLegend } from "./front-legend";
import type { Point as MapPoint } from "./front-marks";
import { frontsOf } from "./front-marks";
import { paintWorld } from "./map-bitmap";
import type { MapMode } from "./map-mode";
import { airTintOf, resourceTintOf, tintFor } from "./map-mode";
import { CRATES } from "./map-palette";
import { MapZoomControls } from "./map-zoom-controls";
import { nationLabels } from "./nation-labels";
import { nationAt } from "./pick-nation";
import { useMapView } from "./use-map-view";
import type { Surface } from "./viewport";
import { wingMarks } from "./wing-marks";

interface WorldMapProps {
  readonly world: World;
  /** Who holds each province now, by province id. */
  readonly owners: Int32Array;
  /** Who is fighting whom, which decides where the fronts run. */
  readonly wars: Wars;
  readonly divisions: readonly Division[];
  /** What every nation's supply can do today. */
  readonly supply: SupplyNetwork;
  /** How far the people of each province go along with whoever holds it. */
  readonly compliance: Compliance;
  /** Every nation's navy, by nation id. */
  readonly navies: readonly Navy[];
  /** Every nation's air force, by nation id. */
  readonly airForces: readonly AirForce[];
  /** The air power every nation flew today, and who is fighting whom under it. */
  readonly skies: Skies;
  /** How strong each nation's intelligence network is in each province, by nation id and then province id. */
  readonly networks: Networks;
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
/**
 * How big a fleet counter is drawn, in screen pixels: wider than an army's
 * and narrowing to a keel, with the nation's colour along its deck.
 */
const FLEET_WIDTH = 28;
const FLEET_HEIGHT = 16;
const FLEET_KEEL = 5;
/**
 * How big a wing counter is drawn, in screen pixels: a dark fuselage with a
 * pair of dark wings across it, the nation's colour inset along the wings so
 * it still shows over a sky painted in the same colour.
 */
const WING_SPAN = 30;
const WING_CHORD = 8;
const WING_INSET = 2;
const FUSELAGE_WIDTH = 10;
const FUSELAGE_LENGTH = 18;
/**
 * How a nation's lines are drawn, in screen pixels: its colour over a dark
 * casing, so a line keeps showing over land painted the same colour, the front
 * solid and the fallback line dashed so the two read apart without colour.
 */
const LINE_CASING = "rgba(12, 14, 20, 0.85)";
const LINE_STYLES = {
  fallback: { casing: 4, dash: [6, 4], width: 2 },
  front: { casing: 5, dash: [], width: 3 },
} satisfies Record<
  LineKind,
  { casing: number; dash: readonly number[]; width: number }
>;
/** How an offensive's arrow is drawn, in screen pixels. */
const ARROW_WIDTH = 5;
const ARROW_CASING = 8;
const ARROW_HEAD = 12;
const ARROW_HEAD_HALF_WIDTH = 7;
/** The most of its last leg an arrow's head takes, so a short arrow keeps a shaft. */
const ARROW_HEAD_SHARE = 0.6;
const LABEL_INK = "rgba(255, 255, 255, 0.88)";
const LABEL_OUTLINE = "rgba(0, 0, 0, 0.65)";
const LABEL_OUTLINE_WIDTH = 3;

/** One counter as the canvas draws it: its text, its centre and its nation's colour. */
interface Counter {
  readonly value: string;
  readonly x: number;
  readonly y: number;
  readonly colour: Colour;
}

const inkOf = (colour: Colour): string =>
  `rgb(${colour.red} ${colour.green} ${colour.blue})`;

/**
 * Draws an army counter, with the crate beside it where its divisions are
 * short of supply, and leaves the pen set for the names again.
 */
const drawCounter = (
  pen: CanvasRenderingContext2D,
  counter: Counter,
  crate: SupplyState
): void => {
  const { colour, value, x, y } = counter;
  const left = x - COUNTER_WIDTH / 2;
  const top = y - COUNTER_HEIGHT / 2;
  pen.fillStyle = COUNTER_FILL;
  pen.fillRect(left, top, COUNTER_WIDTH, COUNTER_HEIGHT);
  pen.fillStyle = inkOf(colour);
  pen.fillRect(left, top, COUNTER_STRIPE, COUNTER_HEIGHT);
  pen.fillStyle = COUNTER_INK;
  pen.font = COUNTER_FONT;
  pen.fillText(value, x + COUNTER_STRIPE / 2, y);
  Option.match(CRATES[crate], {
    onNone: noCrate,
    onSome: (drawn) => {
      const crateLeft = left + COUNTER_WIDTH + CRATE_GAP;
      const crateTop = y - CRATE_SIZE / 2;
      const ink = inkOf(drawn.colour);
      pen.fillStyle = COUNTER_FILL;
      pen.fillRect(crateLeft - 1, crateTop - 1, CRATE_SIZE + 2, CRATE_SIZE + 2);
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
};

/**
 * Draws a fleet counter, a hull narrowing to its keel with the nation's
 * colour along the deck, and leaves the pen set for the names again.
 */
const drawFleet = (pen: CanvasRenderingContext2D, counter: Counter): void => {
  const { colour, value, x, y } = counter;
  const top = y - FLEET_HEIGHT / 2;
  pen.fillStyle = COUNTER_FILL;
  pen.beginPath();
  pen.moveTo(x - FLEET_WIDTH / 2, top);
  pen.lineTo(x + FLEET_WIDTH / 2, top);
  pen.lineTo(x + FLEET_WIDTH / 2 - FLEET_KEEL, y + FLEET_HEIGHT / 2);
  pen.lineTo(x - FLEET_WIDTH / 2 + FLEET_KEEL, y + FLEET_HEIGHT / 2);
  pen.closePath();
  pen.fill();
  pen.fillStyle = inkOf(colour);
  pen.fillRect(x - FLEET_WIDTH / 2, top, FLEET_WIDTH, COUNTER_STRIPE);
  pen.fillStyle = COUNTER_INK;
  pen.font = COUNTER_FONT;
  pen.fillText(value, x, y + COUNTER_STRIPE / 2);
  pen.font = LABEL_FONT;
  pen.fillStyle = LABEL_INK;
};

/**
 * Draws a wing counter, a dark fuselage and wings with the nation's colour
 * inset along the wings and the planes written below, and leaves the pen set
 * for the names again.
 */
const drawWing = (pen: CanvasRenderingContext2D, counter: Counter): void => {
  const { colour, value, x, y } = counter;
  pen.fillStyle = COUNTER_FILL;
  pen.fillRect(
    x - FUSELAGE_WIDTH / 2,
    y - FUSELAGE_LENGTH / 2,
    FUSELAGE_WIDTH,
    FUSELAGE_LENGTH
  );
  pen.fillRect(x - WING_SPAN / 2, y - WING_CHORD / 2, WING_SPAN, WING_CHORD);
  pen.fillStyle = inkOf(colour);
  pen.fillRect(
    x - WING_SPAN / 2 + WING_INSET,
    y - WING_CHORD / 2 + WING_INSET,
    WING_SPAN - 2 * WING_INSET,
    WING_CHORD - 2 * WING_INSET
  );
  pen.fillStyle = COUNTER_INK;
  pen.font = COUNTER_FONT;
  pen.strokeText(value, x, y + FUSELAGE_LENGTH / 2 + COUNTER_STRIPE);
  pen.fillText(value, x, y + FUSELAGE_LENGTH / 2 + COUNTER_STRIPE);
  pen.font = LABEL_FONT;
  pen.fillStyle = LABEL_INK;
};

/** Strokes `path` twice: the dark casing, then the colour over it. */
const strokeCased = (
  pen: CanvasRenderingContext2D,
  path: Path2D,
  colour: Colour,
  line: { readonly casing: number; readonly width: number }
): void => {
  pen.strokeStyle = LINE_CASING;
  pen.lineWidth = line.casing;
  pen.stroke(path);
  pen.strokeStyle = inkOf(colour);
  pen.lineWidth = line.width;
  pen.stroke(path);
};

/** The SVG path data that runs through `points` in order. */
const pathThrough = (points: readonly MapPoint[]): string =>
  `M${points.map((point) => `${point.x} ${point.y}`).join("L")}`;

/**
 * Draws a nation's front or fallback line, every segment in one path, and
 * leaves the pen set for the names again.
 */
const drawLines = (
  pen: CanvasRenderingContext2D,
  segments: readonly Segment[],
  colour: Colour,
  kind: LineKind
): void => {
  const style = LINE_STYLES[kind];
  const path = new Path2D(
    segments
      .map((segment) =>
        pathThrough([
          { x: segment.x1, y: segment.y1 },
          { x: segment.x2, y: segment.y2 },
        ])
      )
      .join("")
  );
  pen.setLineDash(style.dash);
  pen.lineCap = "butt";
  strokeCased(pen, path, colour, style);
  pen.setLineDash([]);
  pen.lineWidth = LABEL_OUTLINE_WIDTH;
  pen.strokeStyle = LABEL_OUTLINE;
};

const ORIGIN: MapPoint = { x: 0, y: 0 };

/**
 * Draws an offensive's arrow: a cased shaft along the points and a head on
 * the last of them pointing the way the last step runs, and leaves the pen set
 * for the names again.
 */
const drawArrow = (
  pen: CanvasRenderingContext2D,
  points: readonly MapPoint[],
  colour: Colour
): void => {
  const tip = itemAt(points, points.length - 1, ORIGIN);
  const before = itemAt(points, points.length - 2, tip);
  const angle = Math.atan2(tip.y - before.y, tip.x - before.x);
  const head = Math.min(
    ARROW_HEAD,
    Math.hypot(tip.x - before.x, tip.y - before.y) * ARROW_HEAD_SHARE
  );
  const neck = {
    x: tip.x - Math.cos(angle) * head,
    y: tip.y - Math.sin(angle) * head,
  };
  const halfWidth = (ARROW_HEAD_HALF_WIDTH * head) / ARROW_HEAD;
  const across = {
    x: Math.cos(angle + Math.PI / 2) * halfWidth,
    y: Math.sin(angle + Math.PI / 2) * halfWidth,
  };
  pen.lineCap = "round";
  pen.lineJoin = "round";
  strokeCased(
    pen,
    new Path2D(pathThrough([...points.slice(0, -1), neck])),
    colour,
    {
      casing: ARROW_CASING,
      width: ARROW_WIDTH,
    }
  );
  pen.beginPath();
  pen.moveTo(tip.x, tip.y);
  pen.lineTo(neck.x + across.x, neck.y + across.y);
  pen.lineTo(neck.x - across.x, neck.y - across.y);
  pen.closePath();
  pen.strokeStyle = LINE_CASING;
  pen.lineWidth = ARROW_CASING - ARROW_WIDTH;
  pen.stroke();
  pen.fillStyle = inkOf(colour);
  pen.fill();
  pen.lineCap = "butt";
  pen.lineJoin = "miter";
  pen.lineWidth = LABEL_OUTLINE_WIDTH;
  pen.strokeStyle = LABEL_OUTLINE;
  pen.fillStyle = LABEL_INK;
};

const keepWheelOnMap = (event: Event) => {
  event.preventDefault();
};

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
  airForces,
  compliance,
  divisions,
  highlighted,
  mode,
  navies,
  networks,
  onSelectNation,
  onTogglePause,
  owners,
  skies,
  supply,
  wars,
  world,
}: WorldMapProps) => {
  const canvas = useRef(NO_CANVAS);
  const dragFrom = useRef(NO_DRAG);
  const dragTravel = useRef(0);
  const dragSlack = useRef(CLICK_SLACK.mouse);
  const [surface, setSurface] = useState<Surface>(UNMEASURED);
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
    // A trackpad pinch arrives as a wheel event, and the browser zooms the whole
    // page unless the event is cancelled. React listens for wheel passively,
    // where cancelling is ignored, so the canvas holds a listener of its own.
    element.addEventListener("wheel", keepWheelOnMap, { passive: false });
    return () => {
      observer.disconnect();
      element.removeEventListener("wheel", keepWheelOnMap);
    };
  }, [attached]);

  const lift = useMemo(
    () => skiesBelow(skies, world.airspace, world.provinces.length).lift,
    [world, skies]
  );

  const waters = useMemo(
    () => watersOf(graphOf(world.provinces), navies, lift),
    [world, navies, lift]
  );

  const resources = useMemo(() => resourceTintOf(world.deposits), [world]);

  const air = useMemo(
    () => airTintOf(skies.power, world.airspace.regionOf),
    [world, skies]
  );

  const tint = useMemo(
    () =>
      tintFor(mode, {
        air,
        compliance,
        network: supply,
        networks,
        resources,
        waters,
      }),
    [mode, supply, compliance, waters, air, resources, networks]
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

  const fronts = useMemo(
    () => frontsOf(world, owners, wars),
    [world, owners, wars]
  );

  const overlay = useMemo(
    () => ({
      fleets: fleetMarks(world, navies),
      fronts,
      labels: nationLabels(world, owners),
      marks: divisionMarks(world, divisions, supply),
      wings: wingMarks(world, airForces),
    }),
    [world, owners, divisions, supply, navies, airForces, fronts]
  );

  const {
    fit,
    panBy,
    steer: steerBy,
    view,
    zoomAt,
  } = useMapView(world.grid, surface);

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
          drawCounter(pen, { colour, value, x, y }, crate);
        },
        arrow: (points, colour) => {
          drawArrow(pen, points, colour);
        },
        lines: (segments, colour, kind) => {
          drawLines(pen, segments, colour, kind);
        },
        fleet: (value, x, y, colour) => {
          drawFleet(pen, { colour, value, x, y });
        },
        wing: (value, x, y, colour) => {
          drawWing(pen, { colour, value, x, y });
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

  const continueDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    const from = dragFrom.current;
    if (Option.isNone(from)) {
      return;
    }
    const byX = event.clientX - from.value.x;
    const byY = event.clientY - from.value.y;
    dragTravel.current += Math.abs(byX) + Math.abs(byY);
    panBy(byX, byY);
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
    zoomAt(factor, atX, atY);
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
    steerBy(pan.x, pan.y, factor);
  };

  return (
    <div className="relative min-w-0 flex-1">
      <canvas
        aria-label={`シード ${world.seed} の世界地図。クリックで国を選択、矢印キーで移動、プラスとマイナスで拡大縮小、スペースで一時停止`}
        className="absolute inset-0 size-full cursor-grab touch-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring active:cursor-grabbing"
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
      <FrontLegend shown={fronts.length > 0} />
      <MapZoomControls
        onFit={fit}
        onZoom={(factor) => {
          steerBy(0, 0, factor);
        }}
        step={KEY_ZOOM}
      />
    </div>
  );
};

/**
 * The map redraws only when the world, the picked nation, the mode or what it
 * shows changes, so the calendar ticking beside it costs nothing here.
 */
export const WorldMap = memo(WorldMapSurface);
