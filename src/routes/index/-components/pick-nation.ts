import { Option } from "effect";
import { valueAt } from "@/shared/entities/world/grid";
import { UNASSIGNED } from "@/shared/entities/world/spread";
import type { World } from "@/shared/entities/world/world";
import type { Viewport } from "./viewport";

/**
 * The nation holding the ground under a point on the drawing surface.
 *
 * Water and the margin around the world answer with nothing, which is what
 * clears a selection: clicking away from every country is how someone says they
 * are done looking at one.
 */
export const nationAt = (
  world: World,
  owners: Int32Array,
  view: Viewport,
  atX: number,
  atY: number
): Option.Option<number> => {
  const x = Math.floor(view.x + atX / view.scale);
  const y = Math.floor(view.y + atY / view.scale);
  if (x < 0 || x >= world.grid.width) {
    return Option.none();
  }
  if (y < 0 || y >= world.grid.height) {
    return Option.none();
  }
  const province = valueAt(world.cellProvince, y * world.grid.width + x);
  const owner = valueAt(owners, province);
  if (owner === UNASSIGNED) {
    return Option.none();
  }
  return Option.some(owner);
};
