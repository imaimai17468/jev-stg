import type { World } from "@/shared/entities/world";
import { itemAt } from "@/shared/entities/world/lookup";
import type { Colour } from "@/shared/entities/world/nations";
import { NO_NATION } from "@/shared/entities/world/nations";
import type { Navy } from "@/shared/entities/world/navy";
import { UNASSIGNED } from "@/shared/entities/world/spread";

/** One counter the map draws over a sea zone for the warships in it. */
export interface FleetMark {
  readonly zone: number;
  /** Where the counter sits, in cell coordinates. */
  readonly x: number;
  readonly y: number;
  /** The warships it stands for. */
  readonly count: number;
  readonly colour: Colour;
}

/** One nation's warships in one zone. */
interface Squadron {
  readonly nation: number;
  readonly zone: number;
  readonly ships: number;
}

/**
 * A counter per sea zone that holds warships, in the colour of whoever has the
 * most of them there, which is the one a battle there is being fought for.
 */
export const fleetMarks = (
  world: World,
  navies: readonly Navy[]
): readonly FleetMark[] => {
  const squadrons = navies.flatMap((navy, nation) =>
    navy.fleets.flatMap((fleet): readonly Squadron[] => {
      if (fleet.zone === UNASSIGNED || fleet.ships.length === 0) {
        return [];
      }
      return [{ nation, ships: fleet.ships.length, zone: fleet.zone }];
    })
  );
  return world.provinces.flatMap((province): readonly FleetMark[] => {
    const here = squadrons.filter((squadron) => squadron.zone === province.id);
    const nations = [...new Set(here.map((squadron) => squadron.nation))];
    const counts = nations.map((nation) =>
      here
        .filter((squadron) => squadron.nation === nation)
        .reduce((total, squadron) => total + squadron.ships, 0)
    );
    const most = Math.max(0, ...counts);
    if (most === 0) {
      return [];
    }
    const nation = itemAt(nations, counts.indexOf(most), NO_NATION.id);
    return [
      {
        colour: itemAt(world.nations, nation, NO_NATION).colour,
        count: most,
        x: province.x,
        y: province.y,
        zone: province.id,
      },
    ];
  });
};
