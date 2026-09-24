import type { NationEconomy } from "@/shared/entities/world/economy/economy";
import type { Invasion } from "@/shared/entities/world/navy/invasion";
import type { Navy } from "@/shared/entities/world/navy/navy";
import type {
  ShipClass,
  ShipDesigns,
} from "@/shared/entities/world/navy/ships";
import {
  classOf,
  orderOf,
  SHIP_CLASSES,
} from "@/shared/entities/world/navy/ships";
import { countLabel, percentLabel } from "./count-label";
import { ORDER_NAMES } from "./naval-names";
import type { Stat } from "./stat";

/** How many of `navy`'s warships are of `shipClass`, in every task force. */
const shipsOf = (navy: Navy, shipClass: ShipClass): number =>
  navy.fleets.flatMap((fleet) =>
    fleet.ships.filter((ship) => classOf(ship) === shipClass)
  ).length;

/**
 * What the nation panel says about one nation's navy: its dockyards and what
 * they are building, of the designs `designs` lays down, its warships by
 * class, its convoys and how many of them are running a lane, what share of
 * what its cut-off ground and its trade over the sea needed arrived, and the
 * crossings it is preparing.
 */
export const navySummaryOf = (
  navy: Navy,
  economy: NationEconomy,
  crossings: readonly Invasion[],
  designs: ShipDesigns
): readonly Stat[] => [
  { label: "造船所", value: String(economy.dockyards) },
  {
    label: "建造中",
    value: `${ORDER_NAMES[navy.order]}（${percentLabel(
      Math.min(1, navy.progress / orderOf(navy.order, designs).cost)
    )}）`,
  },
  ...SHIP_CLASSES.map((shipClass) => ({
    label: ORDER_NAMES[shipClass],
    value: String(shipsOf(navy, shipClass)),
  })),
  {
    label: "輸送船（航路で使用中）",
    value: `${countLabel(navy.convoys)}（${countLabel(
      navy.lanes.reduce((total, lane) => total + lane.convoys, 0)
    )}）`,
  },
  { label: "飛び地に届いた補給", value: percentLabel(navy.overseas) },
  { label: "海越しの輸入の到着", value: percentLabel(navy.traded) },
  {
    label: "準備中の海上輸送",
    value: `${crossings.length}（${crossings.reduce(
      (total, crossing) => total + crossing.divisions.length,
      0
    )}師団）`,
  },
];
