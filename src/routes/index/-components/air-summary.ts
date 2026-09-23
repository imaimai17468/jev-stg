import { basesHeldBy } from "@/shared/entities/world/air-bases";
import type { AirForce } from "@/shared/entities/world/air-force";
import { flyingOf, planesOf } from "@/shared/entities/world/air-force";
import type { Aircraft } from "@/shared/entities/world/aircraft";
import { AIRCRAFT, airframeOf } from "@/shared/entities/world/aircraft";
import type { NationEconomy } from "@/shared/entities/world/economy";
import { FUEL_CAPACITY } from "@/shared/entities/world/fuel";
import type { Superiority } from "@/shared/entities/world/skies";
import { countLabel, percentLabel } from "./count-label";
import { AIRCRAFT_NAMES, AVIATION_NAMES } from "./naval-names";
import type { Stat } from "./stat";

/** What the nation panel reads about one nation's air force. */
export interface Hangar {
  readonly airForce: AirForce;
  readonly economy: NationEconomy;
  /** The level of the air base in each province, by province id. */
  readonly airBases: Uint8Array;
  /** Who holds each province now, by province id. */
  readonly owners: Int32Array;
  readonly nation: number;
  /** How the sky over each region divides for the nation. */
  readonly superiority: Superiority;
}

/** Air superiority above this share counts as a sky held, where the wiki's colours turn to one side's. */
const HELD_ABOVE = 0.6;

/** What its military factories on planes are building, in the panel's words. */
const productionLabel = ({ airForce }: Hangar): string => {
  if (airForce.aviation === "none") {
    return AVIATION_NAMES.none;
  }
  return `${AVIATION_NAMES[airForce.aviation]}で${AIRCRAFT_NAMES[airForce.order]}（${percentLabel(
    Math.min(1, airForce.progress / airframeOf(airForce.order).cost)
  )}）`;
};

/** The planes of `aircraft` the air force has, and how many of them are flying a mission. */
const kindLabel = (airForce: AirForce, aircraft: Aircraft): string => {
  const flying = planesOf({ ...airForce, wings: flyingOf(airForce) }, aircraft);
  return `${countLabel(planesOf(airForce, aircraft))}（出撃中 ${countLabel(flying)}）`;
};

/**
 * What the nation panel says about one nation's air force: what its military
 * factories on planes are building, its planes by kind and how many of them
 * are flying, the air bases it holds and the planes they host, its fuel and
 * what it burned yesterday, and the regions whose sky it or its enemies hold.
 */
export const airSummaryOf = (hangar: Hangar): readonly Stat[] => {
  const held = basesHeldBy(hangar.airBases, hangar.owners, hangar.nation);
  return [
    { label: "航空機の生産", value: productionLabel(hangar) },
    ...AIRCRAFT.map((aircraft) => ({
      label: AIRCRAFT_NAMES[aircraft],
      value: kindLabel(hangar.airForce, aircraft),
    })),
    {
      label: "航空基地",
      value: `${held.levels}段階（${countLabel(held.capacity)}機分）`,
    },
    {
      label: "燃料（昨日の消費）",
      value: `${percentLabel(hangar.economy.fuel / FUEL_CAPACITY)}（${countLabel(hangar.economy.burned)}）`,
    },
    {
      label: "制空権を握る空域",
      value: String(
        hangar.superiority.own.filter((share) => share > HELD_ABOVE).length
      ),
    },
    {
      label: "敵に制空権を握られた空域",
      value: String(
        hangar.superiority.enemy.filter((share) => share > HELD_ABOVE).length
      ),
    },
  ];
};
