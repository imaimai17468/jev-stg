import type { AirframeModels } from "./aircraft";
import { airframeModelsOf } from "./aircraft";
import type { InfantryEquipment } from "./divisions";
import { infantryEquipmentOf } from "./divisions";
import type { Research } from "./research";
import { shipUpgradesOf, START_RESEARCH } from "./research";
import type { ShipClass, ShipDesigns } from "./ships";
import { shipDesignsOf } from "./ships";
import type { ShipWeapon } from "./techs";

/** The share a nation's technologies add to each weapon of one class of warship. */
export interface WeaponShares {
  readonly light: number;
  readonly heavy: number;
  readonly torpedo: number;
}

/** The shares for every class of warship. */
export interface FleetShares {
  readonly destroyer: WeaponShares;
  readonly cruiser: WeaponShares;
  readonly battleship: WeaponShares;
  readonly carrier: WeaponShares;
  readonly submarine: WeaponShares;
}

/**
 * What a nation's research arms it with: the infantry equipment its divisions
 * fight with, the design its dockyards lay down for each class and its
 * factories build for each kind of plane, and what its warships' weapons
 * gain.
 */
export interface Armoury {
  readonly infantry: InfantryEquipment;
  readonly ships: ShipDesigns;
  readonly planes: AirframeModels;
  readonly weapons: FleetShares;
}

/** What `research` arms a nation with. */
export const armouryOf = (research: Research): Armoury => {
  const researched = new Set<string>(research.researched);
  const upgrades = shipUpgradesOf(research);
  const shareOf = (shipClass: ShipClass, weapon: ShipWeapon): number =>
    upgrades
      .filter(
        (upgrade) =>
          upgrade.shipClass === shipClass && upgrade.weapon === weapon
      )
      .reduce((total, upgrade) => total + upgrade.share, 0);
  const sharesOf = (shipClass: ShipClass): WeaponShares => ({
    heavy: shareOf(shipClass, "heavy"),
    light: shareOf(shipClass, "light"),
    torpedo: shareOf(shipClass, "torpedo"),
  });
  return {
    infantry: infantryEquipmentOf(researched),
    planes: airframeModelsOf(researched),
    ships: shipDesignsOf(researched),
    weapons: {
      battleship: sharesOf("battleship"),
      carrier: sharesOf("carrier"),
      cruiser: sharesOf("cruiser"),
      destroyer: sharesOf("destroyer"),
      submarine: sharesOf("submarine"),
    },
  };
};

/** What a nation opens the world armed with, which a nation the world does not hold keeps. */
export const OPENING_ARMOURY: Armoury = armouryOf(START_RESEARCH);
