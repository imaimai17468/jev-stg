import type {
  Resource,
  ResourceNeed,
} from "@/shared/entities/world/economy/resources";
import { RESOURCES } from "@/shared/entities/world/economy/resources";
import { itemAt } from "@/shared/entities/world/lookup";

/** What the resource map paints a province: its richest resource, or none. */
export type ResourceLevel = Resource | "none";

/** Every level, in the order the legend lists them. */
export const RESOURCE_LEVELS: readonly ResourceLevel[] = [...RESOURCES, "none"];

/**
 * The resource a province holds the largest share of the world's supply of,
 * which is how a province rich in the scarce ore reads as such beside one with
 * more of the common one, or none where it yields nothing.
 */
export const richestResourceOf = (
  deposit: ResourceNeed,
  world: ResourceNeed
): ResourceLevel => {
  const shares = RESOURCES.map(
    (resource) => deposit[resource] / Math.max(1, world[resource])
  );
  const best = Math.max(...shares);
  if (best === 0) {
    return "none";
  }
  return itemAt<ResourceLevel>(RESOURCES, shares.indexOf(best), "none");
};
