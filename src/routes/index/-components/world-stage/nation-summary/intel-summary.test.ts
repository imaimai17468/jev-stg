import { describe, expect, it } from "vite-plus/test";
import type { Agency } from "@/shared/entities/world/intelligence/agency";
import { NO_AGENCY } from "@/shared/entities/world/intelligence/agency";
import type { Service } from "@/shared/entities/world/intelligence/espionage";
import { serviceFor } from "@/shared/entities/world/intelligence/espionage";
import type { IntelTable } from "@/shared/entities/world/intelligence/intel";
import type { Bureau } from "./intel-summary";
import { intelSummaryOf } from "./intel-summary";

/** Three nations, none of which knows anything of another. */
const BLIND: IntelTable = { levels: new Float32Array(36), nations: 3 };

/** Nation 0's bureau in a world of three with a fresh service, with whatever a test needs changed. */
const bureauOf = (patch: Partial<Bureau>): Bureau => ({
  agencies: [NO_AGENCY, NO_AGENCY, NO_AGENCY],
  counterIntelligence: 1.25,
  intel: BLIND,
  nameOf: (nation) => `国${nation}`,
  nation: 0,
  service: serviceFor(3),
  slots: 2,
  ...patch,
});

/** The value of the row the panel labels `label`, where it has one. */
const rowOf = (bureau: Bureau, label: string): readonly string[] =>
  intelSummaryOf(bureau).flatMap((row) => {
    if (row.label !== label) {
      return [];
    }
    return [row.value];
  });

/** Nation 0's service with `agency`. */
const runBy = (agency: Agency): Service => ({ ...serviceFor(3), agency });

describe(intelSummaryOf, () => {
  it("should list the agency, the operatives, where they are, the operations, the counter-intelligence and the codebreakers when the nation has done nothing yet", () => {
    expect(intelSummaryOf(bureauOf({}))).toStrictEqual([
      { label: "諜報機関", value: "未設立" },
      { label: "工作員", value: "0/2人（作戦中 0、捕まっている 0）" },
      { label: "工作員の置き場所", value: "自国で防諜" },
      { label: "作戦", value: "なし" },
      { label: "防諜", value: "1.3" },
      { label: "暗号解読", value: "なし" },
    ]);
  });

  it("should count the days left of the founding when the agency is being founded", () => {
    expect(
      rowOf(
        bureauOf({
          service: runBy({
            ...NO_AGENCY,
            work: { daysLeft: 12, kind: "working", project: "found" },
          }),
        }),
        "諜報機関"
      )
    ).toStrictEqual(["設立中（残り12日）"]);
  });

  it("should count the levels bought and name the upgrade under way when a founded agency is buying one", () => {
    expect(
      rowOf(
        bureauOf({
          service: runBy({
            standing: "founded",
            upgrades: ["army-department"],
            work: { daysLeft: 3, kind: "working", project: "navy-department" },
          }),
        }),
        "諜報機関"
      )
    ).toStrictEqual(["強化 1段階（海軍部を強化中、残り3日）"]);
  });

  it("should count the levels bought when a founded agency is idle", () => {
    expect(
      rowOf(
        bureauOf({
          service: runBy({
            ...NO_AGENCY,
            standing: "founded",
            upgrades: ["army-department", "passive-defense"],
          }),
        }),
        "諜報機関"
      )
    ).toStrictEqual(["強化 2段階"]);
  });

  it("should list each operation with its nation and days left and count the operatives on them when missions are under way", () => {
    const service: Service = {
      ...serviceFor(3),
      captured: [1],
      missions: [
        {
          daysLeft: 20,
          location: 4,
          operatives: 1,
          operation: "infiltrate-army",
          target: 1,
        },
        {
          daysLeft: 5,
          location: 7,
          operatives: 1,
          operation: "capture-cipher",
          target: 2,
        },
      ],
      operatives: 3,
      target: 1,
    };

    expect(intelSummaryOf(bureauOf({ service })).slice(1, 4)).toStrictEqual([
      { label: "工作員", value: "3/2人（作戦中 2、捕まっている 1）" },
      { label: "工作員の置き場所", value: "国1" },
      {
        label: "作戦",
        value: "国1で陸軍への潜入（残り20日）、国2で暗号の奪取（残り5日）",
      },
    ]);
  });

  it("should name every nation whose cipher is broken when the codebreakers have broken some", () => {
    const service: Service = {
      ...serviceFor(3),
      ciphers: {
        progress: Float64Array.from([0, 12_000, 12_000]),
        revealed: new Uint8Array(3),
      },
    };

    expect(rowOf(bureauOf({ service }), "暗号解読")).toStrictEqual([
      "国1・国2を解読済み",
    ]);
  });

  it("should name the cipher the codebreakers are furthest into when none is broken yet", () => {
    const service: Service = {
      ...serviceFor(3),
      ciphers: {
        progress: Float64Array.from([0, 3000, 6000]),
        revealed: new Uint8Array(3),
      },
    };

    expect(rowOf(bureauOf({ service }), "暗号解読")).toStrictEqual([
      "国2を解読中（50%）",
    ]);
  });

  it("should list what the nation knows of each other nation, the best known first, when it knows something of them", () => {
    const intel: IntelTable = {
      levels: Float32Array.from({ length: 36 }, (_, slot) => {
        if (slot >= 4 && slot < 8) {
          return 0.1;
        }
        if (slot >= 8 && slot < 12) {
          return 0.2 * Number(slot !== 10);
        }
        return 0;
      }),
      nations: 3,
    };

    expect(intelSummaryOf(bureauOf({ intel })).slice(6)).toStrictEqual([
      { label: "国2の諜報", value: "経済20%・陸軍20%・海軍0%・空軍20%" },
      { label: "国1の諜報", value: "経済10%・陸軍10%・海軍10%・空軍10%" },
    ]);
  });
});
