import type { Colour } from "@/shared/entities/world/nations";
import type { Terrain } from "@/shared/entities/world/terrain";

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
