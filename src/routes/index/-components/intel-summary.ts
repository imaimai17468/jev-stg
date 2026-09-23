import { Option } from "effect";
import type { Agency } from "@/shared/entities/world/agency";
import { NO_AGENCY } from "@/shared/entities/world/agency";
import { cipherStrengthOf } from "@/shared/entities/world/cipher";
import type { Assignment, Service } from "@/shared/entities/world/espionage";
import { freeOperatives } from "@/shared/entities/world/espionage";
import { valueAt } from "@/shared/entities/world/grid";
import type { IntelTable } from "@/shared/entities/world/intel";
import { INTEL_KINDS, intelOn } from "@/shared/entities/world/intel";
import { itemAt } from "@/shared/entities/world/lookup";
import { percentLabel } from "./count-label";
import {
  destinationName,
  INTEL_KIND_NAMES,
  OPERATION_NAMES,
  projectName,
} from "./intel-names";
import type { Stat } from "./stat";

/** What the nation panel reads about one nation's intelligence work. */
export interface Bureau {
  readonly nation: number;
  readonly service: Service;
  /** The operative slots its agency has. */
  readonly slots: number;
  /** The counter-intelligence it fields at home. */
  readonly counterIntelligence: number;
  /** What every nation knows of every other. */
  readonly intel: IntelTable;
  /** Every nation's agency, by nation id, whose cryptology sets its cipher's strength. */
  readonly agencies: readonly Agency[];
  readonly nameOf: (nation: number) => string;
}

/** How many nations the panel lists what the nation knows of, the best known first. */
const MOST_LISTED = 5;

/** What the agency is, and what it is working on, in the panel's words. */
const agencyLabel = (agency: Agency): string => {
  const { work } = agency;
  const bought = `強化 ${agency.upgrades.length}段階`;
  if (work.kind === "working" && work.project === "found") {
    return `設立中（残り${work.daysLeft}日）`;
  }
  if (agency.standing === "none") {
    return "未設立";
  }
  if (work.kind === "working") {
    return `${bought}（${projectName(work.project)}を強化中、残り${work.daysLeft}日）`;
  }
  return bought;
};

/** One mission, in the panel's words. */
const missionLabel = (
  mission: Assignment,
  nameOf: (nation: number) => string
): string =>
  `${nameOf(mission.target)}で${OPERATION_NAMES[mission.operation]}（残り${mission.daysLeft}日）`;

/**
 * How far the codebreakers have got, in the panel's words: every nation whose
 * cipher they have broken, and otherwise the one they are furthest into.
 */
const cipherLabel = (bureau: Bureau): string => {
  const { ciphers } = bureau.service;
  const shares = [...ciphers.progress.keys()].map((target) => ({
    share:
      valueAt(ciphers.progress, target) /
      cipherStrengthOf(itemAt(bureau.agencies, target, NO_AGENCY)),
    target,
  }));
  const broken = shares.filter((entry) => entry.share >= 1);
  if (broken.length > 0) {
    return `${broken.map((entry) => bureau.nameOf(entry.target)).join("・")}を解読済み`;
  }
  return Option.match(
    Option.fromUndefinedOr(
      shares
        .filter((entry) => entry.share > 0)
        .toSorted((one, other) => other.share - one.share)
        .at(0)
    ),
    {
      onNone: () => "なし",
      onSome: (furthest) =>
        `${bureau.nameOf(furthest.target)}を解読中（${percentLabel(furthest.share)}）`,
    }
  );
};

/** What the nation knows of each nation it knows anything of, the best known first. */
const knownOf = (bureau: Bureau): readonly Stat[] =>
  Array.from({ length: bureau.intel.nations }, (_, target) => {
    const known = intelOn(bureau.intel, bureau.nation, target);
    return {
      known,
      target,
      total: INTEL_KINDS.reduce((sum, kind) => sum + known[kind], 0),
    };
  })
    .filter((entry) => entry.total > 0)
    .toSorted((one, other) => other.total - one.total)
    .slice(0, MOST_LISTED)
    .map((entry) => ({
      label: `${bureau.nameOf(entry.target)}の諜報`,
      value: INTEL_KINDS.map(
        (kind) => `${INTEL_KIND_NAMES[kind]}${percentLabel(entry.known[kind])}`
      ).join("・"),
    }));

/**
 * What the nation panel says about one nation's intelligence work: its
 * agency, its operatives and where they are, the operations under way, its
 * counter-intelligence and its codebreakers, and what it knows of the nations
 * it knows the most of.
 */
export const intelSummaryOf = (bureau: Bureau): readonly Stat[] => {
  const { service } = bureau;
  const missions = service.missions.map((mission) =>
    missionLabel(mission, bureau.nameOf)
  );
  return [
    { label: "諜報機関", value: agencyLabel(service.agency) },
    {
      label: "工作員",
      value: `${service.operatives}/${bureau.slots}人（作戦中 ${service.operatives - freeOperatives(service)}、捕まっている ${service.captured.length}）`,
    },
    {
      label: "工作員の置き場所",
      value: destinationName(service.target, bureau.nameOf),
    },
    { label: "作戦", value: missions.join("、") || "なし" },
    {
      label: "防諜",
      value: bureau.counterIntelligence.toFixed(1),
    },
    { label: "暗号解読", value: cipherLabel(bureau) },
    ...knownOf(bureau),
  ];
};
