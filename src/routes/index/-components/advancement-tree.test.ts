import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { Advancement } from "@/shared/entities/world/research/advancement";
import { START_ADVANCEMENT } from "@/shared/entities/world/research/advancement";
import { START_RESEARCH } from "@/shared/entities/world/research/research";
import { advancementTreeOf } from "./advancement-tree";

/** Political effort finished, militarism ten days in, fuel refining half researched. */
const MILITARIST: Advancement = {
  focuses: {
    current: Option.some({ focus: "militarism", progress: 10 }),
    done: ["political-effort"],
  },
  research: {
    ...START_RESEARCH,
    researched: [...START_RESEARCH.researched, "fuel-storage"],
    studies: [
      { ahead: 0, bonus: 0, progress: 165, saved: 0, tech: "fuel-refining-1" },
    ],
  },
};

const NONE = Option.none();

describe(advancementTreeOf, () => {
  it("should set each branch's focuses in tiers by their chain of prerequisites and show the days left on the pursued one when one is pursued", () => {
    expect(advancementTreeOf(MILITARIST).focuses).toStrictEqual([
      {
        tiers: [
          {
            nodes: [
              {
                id: "industrialisation",
                name: "工業化",
                progress: NONE,
                standing: "open",
              },
            ],
          },
          {
            nodes: [
              {
                id: "construction-effort",
                name: "建設振興",
                progress: NONE,
                standing: "locked",
              },
              {
                id: "production-effort",
                name: "生産振興",
                progress: NONE,
                standing: "locked",
              },
            ],
          },
          {
            nodes: [
              {
                id: "total-mobilisation",
                name: "総力動員",
                progress: NONE,
                standing: "locked",
              },
            ],
          },
        ],
        title: "工業",
      },
      {
        tiers: [
          {
            nodes: [
              {
                id: "research-bureau",
                name: "研究局",
                progress: NONE,
                standing: "open",
              },
            ],
          },
          {
            nodes: [
              {
                id: "technical-schools",
                name: "技術学校",
                progress: NONE,
                standing: "locked",
              },
            ],
          },
          {
            nodes: [
              {
                id: "secret-projects",
                name: "秘密研究",
                progress: NONE,
                standing: "locked",
              },
            ],
          },
        ],
        title: "研究",
      },
      {
        tiers: [
          {
            nodes: [
              {
                id: "army-effort",
                name: "陸軍拡張",
                progress: NONE,
                standing: "open",
              },
            ],
          },
          {
            nodes: [
              {
                id: "equipment-effort",
                name: "装備増産",
                progress: NONE,
                standing: "locked",
              },
              {
                id: "doctrine-effort",
                name: "戦術研究",
                progress: NONE,
                standing: "locked",
              },
            ],
          },
        ],
        title: "陸軍",
      },
      {
        tiers: [
          {
            nodes: [
              {
                id: "political-effort",
                name: "政治運動",
                progress: NONE,
                standing: "done",
              },
            ],
          },
          {
            nodes: [
              {
                id: "national-unity",
                name: "国民統合",
                progress: NONE,
                standing: "open",
              },
              {
                id: "neutrality",
                name: "中立",
                progress: NONE,
                standing: "excluded",
              },
              {
                id: "militarism",
                name: "軍国主義",
                progress: Option.some("あと60日"),
                standing: "underway",
              },
              {
                id: "intelligence-bureau",
                name: "諜報局",
                progress: NONE,
                standing: "open",
              },
            ],
          },
          {
            nodes: [
              {
                id: "war-propaganda",
                name: "戦時宣伝",
                progress: NONE,
                standing: "locked",
              },
            ],
          },
        ],
        title: "政治",
      },
    ]);
  });

  it("should set a line's technologies in tiers by year and show the share done of the one on a slot when one is on a slot", () => {
    expect(
      advancementTreeOf(MILITARIST).techs.find(
        (group) => group.title === "燃料"
      )
    ).toStrictEqual({
      tiers: [
        {
          nodes: [
            {
              id: "fuel-storage",
              name: "燃料貯蔵",
              progress: NONE,
              standing: "done",
            },
            {
              id: "fuel-refining-1",
              name: "燃料精製I",
              progress: Option.some("50%"),
              standing: "underway",
            },
          ],
          year: 1936,
        },
        ...[
          { id: "fuel-refining-2", name: "燃料精製II", year: 1937 },
          { id: "fuel-refining-3", name: "燃料精製III", year: 1939 },
          { id: "fuel-refining-4", name: "燃料精製IV", year: 1941 },
          { id: "fuel-refining-5", name: "燃料精製V", year: 1943 },
        ].map(({ id, name, year }) => ({
          nodes: [{ id, name, progress: NONE, standing: "locked" }],
          year,
        })),
      ],
      title: "燃料",
    });
  });

  it("should give the research tree one group per line when nothing is researched past the opening", () => {
    expect(
      advancementTreeOf(START_ADVANCEMENT).techs.map((group) => group.title)
    ).toStrictEqual([
      "歩兵装備",
      "戦車",
      "自動車化と機械化",
      "特殊部隊",
      "駆逐艦",
      "巡洋艦",
      "戦艦",
      "空母",
      "潜水艦",
      "艦砲と魚雷",
      "戦闘機",
      "近接航空支援機",
      "雷撃機",
      "工業",
      "建設",
      "燃料",
      "電子工学",
    ]);
  });
});
