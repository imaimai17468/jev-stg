import { Option } from "effect";
import type { Colour } from "@/shared/entities/world/nations";
import type { SupplyState } from "@/shared/entities/world/supply";
import type { Terrain } from "@/shared/entities/world/terrain";
import type { SupplyLevel } from "./supply-level";

interface MapColours {
  /** Water, one flat tone so the coastline is the only thing the eye follows. */
  readonly sea: Colour;
  /** Land no nation reached, which a finished world should not hold. */
  readonly unowned: Colour;
  /** Between two provinces of one nation: visible up close, gone at a glance. */
  readonly provinceBorder: Colour;
  /** Between two nations, dark enough to read as a front line when it moves. */
  readonly nationBorder: Colour;
}

/**
 * The colours the map is painted in.
 *
 * A canvas takes pixels rather than CSS, so these are numbers here instead of
 * the tokens in `src/styles.css` that the panels around the map use. They are
 * picked against the same dark surface those tokens define.
 */
export const MAP_COLOURS: MapColours = {
  nationBorder: { blue: 16, green: 14, red: 12 },
  provinceBorder: { blue: 34, green: 30, red: 26 },
  sea: { blue: 38, green: 26, red: 18 },
  unowned: { blue: 82, green: 82, red: 82 },
};

/**
 * How much each terrain darkens or lightens the nation's colour.
 *
 * The relief has to survive being tinted fourteen different ways, so it is a
 * multiplier on the owner's colour rather than a colour of its own: a mountain
 * range stays a mountain range whoever holds it.
 */
export const TERRAIN_SHADE = {
  desert: 1.14,
  forest: 0.82,
  hills: 0.93,
  mountains: 0.74,
  plains: 1,
  tundra: 1.08,
} satisfies Readonly<Record<Terrain, number>>;

/**
 * What the supply map paints each level, after the steps Hearts of Iron IV
 * uses: bright blue for plenty, dark blue for some, purple for nothing to
 * spare, yellow for short and red for far short.
 */
export const SUPPLY_COLOURS = {
  plenty: { blue: 235, green: 150, red: 70 },
  short: { blue: 50, green: 190, red: 220 },
  some: { blue: 150, green: 70, red: 30 },
  starved: { blue: 40, green: 40, red: 200 },
  stretched: { blue: 150, green: 60, red: 120 },
} satisfies Readonly<Record<SupplyLevel, Colour>>;

/**
 * How far apart the dark diagonal stripes run across a province at each level,
 * in cells, with zero for none. The stripes mark the two short levels by
 * pattern as well as hue, and closer stripes mark the worse of them.
 */
export const SUPPLY_HATCH = {
  plenty: 0,
  short: 4,
  some: 0,
  starved: 2,
  stretched: 0,
} satisfies Readonly<Record<SupplyLevel, number>>;

/** How much a stripe darkens the colour under it. */
export const HATCH_SHADE = 0.55;

/** How a crate is drawn: its colour, and whether it is filled or outlined. */
interface Crate {
  readonly colour: Colour;
  readonly filled: boolean;
}

/**
 * The crate drawn beside a counter whose divisions get less than they need:
 * an outlined faded red where they are short, a filled bright red where they
 * are far short, and none where they get all of it. The fill tells the two
 * apart for a reader who cannot tell the reds apart.
 */
export const CRATES = {
  short: Option.some({
    colour: { blue: 110, green: 110, red: 200 },
    filled: false,
  }),
  starved: Option.some({
    colour: { blue: 40, green: 40, red: 235 },
    filled: true,
  }),
  supplied: Option.none(),
} satisfies Readonly<Record<SupplyState, Option.Option<Crate>>>;
