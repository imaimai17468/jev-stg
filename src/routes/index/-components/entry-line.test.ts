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

  it("should name the target when a nation starts justifying a war goal", () => {
    expect(lineOf({ kind: "justify", nation: 0, target: 1 }).action).toBe(
      "国1への戦争目標の正当化を開始"
    );
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

  it("should name the technology when a nation starts researching one", () => {
    expect(
      lineOf({ kind: "research", nation: 0, tech: "basic-machine-tools" })
        .action
    ).toBe("研究開始 → 基本工作機械");
  });

  it("should name the focus when a nation picks a national focus", () => {
    expect(
      lineOf({ focus: "research-bureau", kind: "focus", nation: 0 }).action
    ).toBe("国家方針 → 研究局");
  });

  it.each([
    {
      action: "交易法 → 輸出制限",
      decision: { kind: "trade", law: "limited-exports", nation: 0 },
      what: "a nation changes its trade law",
    },
    {
      action: "造船 → 潜水艦",
      decision: { kind: "shipbuilding", nation: 0, order: "submarine" },
      what: "a nation sets its dockyards to a new order",
    },
    {
      action: "造船 → 空母",
      decision: { kind: "shipbuilding", nation: 0, order: "carrier" },
      what: "a nation sets its dockyards to carriers",
    },
    {
      action: "建設地 → 州12",
      decision: { kind: "build-site", nation: 0, province: 12 },
      what: "a nation picks the province its factories go up in",
    },
    {
      action: "師団の編成 → 中戦車",
      decision: { division: "medium-armour", kind: "division-kind", nation: 0 },
      what: "a nation picks the kind of division its depots raise",
    },
    {
      action: "師団の編成 → 編成比率どおり",
      decision: { division: "mix", kind: "division-kind", nation: 0 },
      what: "a nation leaves its depots to its leaning's mix",
    },
    {
      action: "航空機 → 雷撃機",
      decision: { aircraft: "naval-bomber", kind: "aircraft", nation: 0 },
      what: "a nation turns its aircraft factories to a new plane",
    },
    {
      action: "航空機の生産 → 軍需工場の40%",
      decision: { aviation: "heavy", kind: "aviation", nation: 0 },
      what: "a nation changes how much of its military factories builds planes",
    },
    {
      action: "国1の海岸に上陸",
      decision: { defender: 1, kind: "landing", nation: 0, target: 1 },
      what: "a nation's divisions go ashore on an enemy coast",
    },
    {
      action: "国1の州3に空挺降下",
      decision: { defender: 1, kind: "paradrop", nation: 0, target: 3 },
      what: "a nation's paratroopers drop onto an enemy province",
    },
    {
      action: "国1と白紙講和",
      decision: { kind: "white-peace", one: 0, other: 1 },
      what: "two nations that no longer touch sign a white peace",
    },
    {
      action: "諜報機関 → 設立",
      decision: { kind: "agency", nation: 0, project: "found" },
      what: "a nation sets out to found its intelligence agency",
    },
    {
      action: "諜報機関 → 暗号部",
      decision: {
        kind: "agency",
        nation: 0,
        project: "cryptology-department",
      },
      what: "a nation's agency buys an upgrade",
    },
    {
      action: "工作員 → 国1",
      decision: { kind: "espionage", nation: 0, target: 1 },
      what: "a nation sends its operatives abroad",
    },
    {
      action: "工作員 → 自国で防諜",
      decision: { kind: "espionage", nation: 0, target: -1 },
      what: "a nation keeps its operatives home",
    },
    {
      action: "国1で陸軍への潜入",
      decision: {
        captured: 0,
        kind: "operation",
        nation: 0,
        operation: "infiltrate-army",
        target: 1,
      },
      what: "an operation ends with nobody caught",
    },
    {
      action: "国1で暗号の奪取（2人が捕まった）",
      decision: {
        captured: 2,
        kind: "operation",
        nation: 0,
        operation: "capture-cipher",
        target: 1,
      },
      what: "an operation ends with operatives caught",
    },
    {
      action: "国1の工作員を捕らえた",
      decision: { kind: "captured", nation: 0, spy: 1 },
      what: "a nation catches another's operative",
    },
    {
      action: "国1の暗号を解読",
      decision: { kind: "cipher", nation: 0, target: 1 },
      what: "a nation's codebreakers break another's cipher",
    },
  ] satisfies readonly { action: string; decision: Decision; what: string }[])(
    "should word it as $action when $what",
    ({ action, decision }) => {
      expect(lineOf(decision)).toStrictEqual({
        action,
        actor: "国0",
        date: "1936-02-29",
        key: "7",
        source: "Jev 62%",
      });
    }
  );
});
