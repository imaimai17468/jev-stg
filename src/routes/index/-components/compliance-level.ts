import type { Occupancy } from "@/shared/entities/world/compliance";

/**
 * How a province reads on the compliance map, from its holder's side: the
 * holder's own ground, or occupied ground that goes along with it, wavers, or
 * defies it.
 */
export type ComplianceLevel = "home" | "complying" | "wavering" | "defiant";

/** Every level, from the most compliant to the least, in the order the legend lists them. */
export const COMPLIANCE_LEVELS: readonly ComplianceLevel[] = [
  "home",
  "complying",
  "wavering",
  "defiant",
];

/** The least compliance occupied ground goes along at, and the least it wavers at. */
const COMPLYING_FROM = 0.6;
const WAVERING_FROM = 0.3;

/** The level a province held as `occupancy` reads at. */
export const complianceLevelOf = (occupancy: Occupancy): ComplianceLevel => {
  if (occupancy.kind === "home") {
    return "home";
  }
  const { level } = occupancy;
  if (level >= COMPLYING_FROM) {
    return "complying";
  }
  if (level >= WAVERING_FROM) {
    return "wavering";
  }
  return "defiant";
};
