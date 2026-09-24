import type { AirForce } from "@/shared/entities/world/air-force";
import type { World } from "@/shared/entities/world/geography/world";
import type { CounterMark } from "./counter-mark";
import { leadingMark } from "./counter-mark";

/**
 * A counter over every region that planes fly a mission over, in the colour
 * of the nation flying the most of them there, which is the one holding or
 * fighting for its sky.
 */
export const wingMarks = (
  world: World,
  airForces: readonly AirForce[]
): readonly CounterMark[] =>
  world.airspace.regions.flatMap((region) =>
    leadingMark(world, {
      counts: airForces.map((airForce) =>
        airForce.wings
          .filter((wing) => wing.region === region.id)
          .reduce((total, wing) => total + wing.planes, 0)
      ),
      nations: airForces.map((_, nation) => nation),
      x: region.x,
      y: region.y,
    })
  );
