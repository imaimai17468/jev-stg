import type { AgencyProject } from "@/shared/entities/world/agency";
import { upgradeTermsOf } from "@/shared/entities/world/agency";
import { HOME } from "@/shared/entities/world/espionage";
import type { IntelKind } from "@/shared/entities/world/intel";
import type { Operation } from "@/shared/entities/world/operations";

/** What the feed and the nation panel call each operation. */
export const OPERATION_NAMES = {
  "capture-cipher": "暗号の奪取",
  "infiltrate-air": "空軍への潜入",
  "infiltrate-army": "陸軍への潜入",
  "infiltrate-civilian": "行政への潜入",
  "infiltrate-navy": "海軍への潜入",
  "rescue-operative": "工作員の救出",
  "resistance-contacts": "抵抗運動との接触",
  "sabotage-industry": "工場の破壊工作",
  "steal-aviation-blueprints": "航空の設計図の窃取",
  "steal-industrial-blueprints": "工業の設計図の窃取",
  "steal-military-blueprints": "陸軍の設計図の窃取",
  "steal-naval-blueprints": "海軍の設計図の窃取",
  "strengthen-resistance": "抵抗運動の強化",
} satisfies Readonly<Record<Operation, string>>;

/** What the feed and the nation panel call each kind of intelligence. */
export const INTEL_KIND_NAMES = {
  air: "空軍",
  army: "陸軍",
  civilian: "経済",
  navy: "海軍",
} satisfies Readonly<Record<IntelKind, string>>;

/** Where a nation keeps its operatives, in the feed's and the nation panel's words. */
export const destinationName = (
  target: number,
  nameOf: (nation: number) => string
): string => {
  if (target === HOME) {
    return "自国で防諜";
  }
  return nameOf(target);
};

/** What the feed and the nation panel call founding the agency or one of its upgrades. */
export const projectName = (project: AgencyProject): string => {
  if (project === "found") {
    return "設立";
  }
  return upgradeTermsOf(project).name;
};
