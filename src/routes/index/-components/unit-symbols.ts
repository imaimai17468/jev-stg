import type { DivisionKind } from "@/shared/entities/world/divisions";
import type { Colour } from "@/shared/entities/world/geography/nations";
import { itemAt } from "@/shared/entities/world/lookup";

/**
 * The NATO (APP-6 / MIL-STD-2525) land unit icons the map tells divisions
 * apart by. Light, medium and heavy armour share one, because APP-6's unit
 * icon for armour carries no weight class.
 */
export type UnitSymbol =
  | "infantry"
  | "cavalry"
  | "motorized"
  | "mechanized"
  | "armour"
  | "mountain"
  | "amphibious"
  | "airborne";

/** Which domain a counter stands in, which decides the shape of its frame. */
export type Domain = "land" | "sea" | "air";

const SYMBOL_OF_KIND = {
  cavalry: "cavalry",
  "heavy-armour": "armour",
  infantry: "infantry",
  "light-armour": "armour",
  marines: "amphibious",
  mechanized: "mechanized",
  "medium-armour": "armour",
  motorized: "motorized",
  mountaineers: "mountain",
  paratroopers: "airborne",
} satisfies Record<DivisionKind, UnitSymbol>;

/**
 * `order` when it names every symbol, and a type error naming the list when one
 * is missing, so a symbol added later cannot drop out of a tie or a legend.
 */
export const everySymbol = <const Order extends readonly UnitSymbol[]>(
  order: Order &
    ([Exclude<UnitSymbol, Order[number]>] extends [never] ? unknown : never)
): Order => order;

/**
 * The symbols in the order a tie between them is settled: the more
 * specialised arm first, because a stack drawn as line infantry reads as the
 * default and hides the tanks or the paratroopers standing beside it.
 */
const SYMBOL_PRIORITY = everySymbol([
  "armour",
  "mechanized",
  "motorized",
  "cavalry",
  "airborne",
  "amphibious",
  "mountain",
  "infantry",
]);

/**
 * A frame's outline as SVG path data inside its own box, so the canvas (through
 * `Path2D`) and the legend's `<svg>` draw one and the same shape.
 */
export interface Frame {
  readonly width: number;
  readonly height: number;
  readonly outline: string;
}

/**
 * The friendly frames of APP-6 for each domain: a rectangle 3:2 on land, a
 * circle at sea, and a dome open at the bottom in the air.
 */
export const FRAMES = {
  air: {
    height: 120,
    outline: "M110,120C110,20 70,0 55,0C40,0 0,20 0,120",
    width: 110,
  },
  land: { height: 100, outline: "M0,0H150V100H0Z", width: 150 },
  sea: {
    height: 120,
    outline: "M0,60A60,60 0 1 1 120,60A60,60 0 1 1 0,60Z",
    width: 120,
  },
} satisfies Record<Domain, Frame>;

/**
 * What a symbol draws inside the land frame's 150 by 100 box: the lines it
 * strokes and the shapes it fills, as SVG path data, empty where it has none.
 */
export interface SymbolPaths {
  readonly strokes: string;
  readonly fills: string;
}

/** What a frame with nothing inside it draws, which is how a fleet's and a wing's are drawn. */
export const NO_SYMBOL: SymbolPaths = { fills: "", strokes: "" };

/** The crossed belts of an infantryman, corner to corner. */
const SALTIRE = "M0,0L150,100M0,100L150,0";
/** The track of a tank, an oval in the middle of the frame. */
const TRACK = "M100,30C125,30 125,70 100,70L50,70C25,70 25,30 50,30Z";

/**
 * The APP-6 icon for each symbol. The mountain, the wave and the parachute sit
 * along the frame's bottom as APP-6's sector 2 modifiers do, drawn larger than
 * the standard's proportion so they still read on a counter a dozen pixels
 * tall.
 */
export const SYMBOL_PATHS = {
  airborne: {
    fills: "",
    strokes: `${SALTIRE}M30,98C30,58 75,58 75,98C75,58 120,58 120,98`,
  },
  amphibious: {
    fills: "",
    strokes: `${SALTIRE}M15,88Q35,68 55,88T95,88T135,88`,
  },
  armour: { fills: "", strokes: TRACK },
  cavalry: { fills: "", strokes: "M0,100L150,0" },
  infantry: { fills: "", strokes: SALTIRE },
  mechanized: { fills: "", strokes: `${SALTIRE}${TRACK}` },
  motorized: { fills: "", strokes: `${SALTIRE}M75,0L75,100` },
  mountain: { fills: "M50,100L75,62L100,100Z", strokes: SALTIRE },
} satisfies Record<UnitSymbol, SymbolPaths>;

/**
 * The symbol that most of `kinds` are drawn as, a tie going to whichever comes
 * first in `SYMBOL_PRIORITY`.
 */
export const dominantSymbol = (kinds: readonly DivisionKind[]): UnitSymbol => {
  const counts = SYMBOL_PRIORITY.map(
    (symbol) => kinds.filter((kind) => SYMBOL_OF_KIND[kind] === symbol).length
  );
  return itemAt(
    SYMBOL_PRIORITY,
    counts.indexOf(Math.max(...counts)),
    "infantry"
  );
};

/** Whether a symbol drawn over a fill reads better in dark ink or light. */
export type Ink = "dark" | "light";

/** Where sRGB's transfer curve turns from a straight line to a power. */
const SRGB_KNEE = 0.04045;

/** One sRGB channel, 0 to 255, as the linear light WCAG's luminance sums. */
const linear = (channel: number): number => {
  const share = channel / 255;
  if (share <= SRGB_KNEE) {
    return share / 12.92;
  }
  return ((share + 0.055) / 1.055) ** 2.4;
};

/**
 * The relative luminance at which black and white ink reach the same WCAG
 * contrast ratio against the fill: (L + 0.05) / 0.05 = 1.05 / (L + 0.05).
 */
const EVEN_CONTRAST = Math.sqrt(1.05 * 0.05) - 0.05;

/** The ink with the higher WCAG contrast ratio against `fill`. */
export const inkOn = (fill: Colour): Ink => {
  const luminance =
    0.2126 * linear(fill.red) +
    0.7152 * linear(fill.green) +
    0.0722 * linear(fill.blue);
  if (luminance > EVEN_CONTRAST) {
    return "dark";
  }
  return "light";
};
