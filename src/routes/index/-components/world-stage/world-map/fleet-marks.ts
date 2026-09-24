import type { World } from "@/shared/entities/world/geography/world";
import type { Navy } from "@/shared/entities/world/navy/navy";
import { UNASSIGNED } from "@/shared/entities/world/spread";
import type { CounterMark } from "../counter-mark";
import { leadingMark } from "../counter-mark";

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
): readonly CounterMark[] => {
  const squadrons = navies.flatMap((navy, nation) =>
    navy.fleets.flatMap((fleet): readonly Squadron[] => {
      if (fleet.zone === UNASSIGNED || fleet.ships.length === 0) {
        return [];
      }
      return [{ nation, ships: fleet.ships.length, zone: fleet.zone }];
    })
  );
  return world.provinces.flatMap((province) => {
    const here = squadrons.filter((squadron) => squadron.zone === province.id);
    const nations = [...new Set(here.map((squadron) => squadron.nation))];
    return leadingMark(world, {
      counts: nations.map((nation) =>
        here
          .filter((squadron) => squadron.nation === nation)
          .reduce((total, squadron) => total + squadron.ships, 0)
      ),
      nations,
      x: province.x,
      y: province.y,
    });
  });
};
