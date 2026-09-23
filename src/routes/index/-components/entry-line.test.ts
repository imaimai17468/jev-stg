import { describe, expect, it } from "vite-plus/test";
import type { Decision, Source } from "@/shared/entities/world/chronicle";
import { entryLine } from "./entry-line";
import { FIXTURE_WORLD } from "./world-fixture";

const JEV: Source = { kind: "jev", probability: 0.624 };

const lineOf = (decision: Decision, source: Source = JEV) =>
  entryLine(FIXTURE_WORLD, { day: 59, ruling: { decision, source }, seq: 7 });

describe(entryLine, () => {
  it("should date the entry, name the decider and word the law when a nation changes its conscription", () => {
    expect(
      lineOf({ kind: "conscription", law: "extensive", nation: 1 })
    ).toStrictEqual({
      action: "徴兵法 → 拡大徴兵",
      actor: "国1",
      date: "1936-02-29",
      key: "7",
      source: "Jev 62%",
    });
  });

  it("should credit the rules when the rules decided", () => {
    expect(
      lineOf({ kind: "plan", nation: 0, plan: "total-war" }, { kind: "rules" })
        .source
    ).toBe("規則");
  });

  it("should word the plan when a nation changes its industry plan", () => {
    expect(lineOf({ kind: "plan", nation: 0, plan: "total-war" }).action).toBe(
      "工業方針 → 総力戦"
    );
  });

  it("should word the stance when a nation's army changes its stance", () => {
    expect(
      lineOf({ kind: "stance", nation: 0, stance: "defensive" }).action
    ).toBe("攻撃姿勢 → 守勢");
  });

  it("should name the target when a nation declares war", () => {
    expect(lineOf({ kind: "declare", nation: 0, target: 1 }).action).toBe(
      "国1に宣戦布告"
    );
  });

  it("should name the faction after its founder when a nation joins one", () => {
    expect(lineOf({ faction: 1, kind: "join", nation: 0 }).action).toBe(
      "国1陣営に加盟"
    );
  });

  it("should credit the victor and name the loser when a peace is signed", () => {
    const line = lineOf({
      kind: "peace",
      loser: 1,
      settlement: { terms: "puppet", victor: 0 },
    });

    expect({ action: line.action, actor: line.actor }).toStrictEqual({
      action: "国1を傀儡国にした",
      actor: "国0",
    });
  });
});
