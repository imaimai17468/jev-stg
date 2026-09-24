import { describe, expect, it } from "vite-plus/test";
import { daysFromCivil } from "../calendar";
import type { Leaning } from "../geography/leaning";
import type { TechId } from "../techs";
import { techOf } from "../techs";
import type { Research, Study, Voucher } from "./research";
import {
  AHEAD_OF_TIME_PER_YEAR,
  availableTechs,
  bonusUsable,
  daysOf,
  leadingTechs,
  openingResearchOf,
  researchBonuses,
  researchedOneDay,
  shipUpgradesOf,
  START_RESEARCH,
  studyStarted,
  techStandingsOf,
  vouchersGranted,
} from "./research";
import type { TreeStanding } from "./tree-standing";

const NAVAL_VOUCHER: Voucher = { ahead: 1, categories: ["naval"], share: 0.5 };

const INDUSTRY_VOUCHER: Voucher = {
  ahead: 0,
  categories: ["industry"],
  share: 0.3,
};

const LATER_NAVAL_VOUCHER: Voucher = {
  ahead: 2,
  categories: ["naval", "air"],
  share: 0.2,
};

const JANUARY_1936 = daysFromCivil({ day: 1, month: 1, year: 1936 });
const JANUARY_1938 = daysFromCivil({ day: 1, month: 1, year: 1938 });
const JANUARY_1939 = daysFromCivil({ day: 1, month: 1, year: 1939 });

/** A study of `tech` with nothing put into it and no bonus. */
const studyOf = (tech: TechId): Study => ({
  ahead: 0,
  bonus: 0,
  progress: 0,
  saved: 0,
  tech,
});

/** The opening research with the basic machine tools researched as well. */
const MACHINE_TOOLS: Research = {
  ...START_RESEARCH,
  researched: [...START_RESEARCH.researched, "basic-machine-tools"],
};

describe(daysOf, () => {
  it.each([
    { cost: "1", days: 110, tech: "fuel-storage" },
    { cost: "1.5", days: 165, tech: "basic-machine-tools" },
    { cost: "0.5", days: 55, tech: "armor-piercing-capped-shell" },
    { cost: "5", days: 550, tech: "atomic-research" },
  ] satisfies readonly { cost: string; days: number; tech: TechId }[])(
    "should take $days days when the technology costs $cost",
    ({ days, tech }) => {
      expect(daysOf(tech)).toBe(days);
    }
  );
});

describe("the ahead-of-time penalty", () => {
  it("should add a 200% penalty for each year early when a technology is researched ahead of time", () => {
    expect(AHEAD_OF_TIME_PER_YEAR).toBe(2);
  });
});

describe("the opening research", () => {
  it("should hold every technology before 1936 and the 1936 opening models when the world opens", () => {
    expect(START_RESEARCH).toStrictEqual({
      researched: [
        "basic-infantry-equipment",
        "infantry-equipment-1",
        "destroyer-1",
        "destroyer-2",
        "light-cruiser-1",
        "light-cruiser-2",
        "battleship-1",
        "battleship-2",
        "carrier-1",
        "carrier-2",
        "submarine-1",
        "submarine-2",
        "naval-gunnery",
        "basic-torpedo",
        "bracket-shooting",
        "ladder-shooting",
        "shell-dyes",
        "interwar-fighter",
        "fighter-1",
        "close-air-support-1",
        "naval-bomber-1",
      ],
      saved: [],
      studies: [],
      vouchers: [],
    });
  });
});

describe(openingResearchOf, () => {
  it.each([
    [
      "army",
      [
        "improved-infantry-equipment-1",
        "great-war-tank",
        "light-tank-1",
        "light-tank-2",
        "heavy-tank-1",
        "early-truck",
        "truck",
        "mountain-infantry-1",
      ],
    ],
    [
      "industry",
      [
        "basic-machine-tools",
        "construction-1",
        "excavation-1",
        "great-war-tank",
        "light-tank-1",
        "light-tank-2",
        "heavy-tank-1",
        "early-truck",
        "truck",
      ],
    ],
    [
      "navy",
      [
        "basic-light-battery",
        "basic-medium-battery",
        "basic-heavy-battery",
        "magnetic-detonator",
        "great-war-tank",
        "light-tank-1",
        "heavy-tank-1",
        "early-truck",
        "truck",
        "marines-1",
      ],
    ],
  ] satisfies readonly (readonly [Leaning, readonly TechId[]])[])(
    "should add the %s leaning's head start to the opening research when the world opens",
    (leaning, headStart) => {
      expect(openingResearchOf(leaning)).toStrictEqual({
        ...START_RESEARCH,
        researched: [...START_RESEARCH.researched, ...headStart],
      });
    }
  );
});

describe("the opening research of each leaning", () => {
  it.each(["army", "navy", "industry"] satisfies readonly Leaning[])(
    "should reach every technology from one it also holds when a %s nation opens",
    (leaning) => {
      const { researched } = openingResearchOf(leaning);

      expect(
        researched.filter(
          (tech) =>
            techOf(tech).from.length > 0 &&
            !techOf(tech).from.some((from) => researched.includes(from))
        )
      ).toStrictEqual([]);
    }
  );
});

/** The world's opening research with machine tools done and concentrated industry on a slot. */
const CONCENTRATING = studyStarted(
  {
    ...START_RESEARCH,
    researched: [...START_RESEARCH.researched, "basic-machine-tools"],
  },
  "concentrated-industry-1"
);

describe(techStandingsOf, () => {
  it.each<{ tech: TechId; standing: TreeStanding }>([
    { standing: "done", tech: "basic-machine-tools" },
    { standing: "underway", tech: "concentrated-industry-1" },
    { standing: "excluded", tech: "dispersed-industry-1" },
    { standing: "open", tech: "construction-1" },
    { standing: "locked", tech: "destroyer-4" },
  ])(
    "should place $tech as $standing when machine tools are done and concentrated industry is on a slot",
    ({ standing, tech }) => {
      expect(techStandingsOf(CONCENTRATING)(tech)).toBe(standing);
    }
  );
});

describe(availableTechs, () => {
  it("should offer each root and each technology a researched one leads to when the world opens", () => {
    expect(availableTechs(START_RESEARCH)).toStrictEqual([
      "improved-infantry-equipment-1",
      "great-war-tank",
      "early-truck",
      "mountain-infantry-1",
      "marines-1",
      "paratroopers-1",
      "destroyer-3",
      "light-cruiser-3",
      "battleship-3",
      "carrier-3",
      "submarine-3",
      "basic-light-battery",
      "basic-medium-battery",
      "basic-heavy-battery",
      "magnetic-detonator",
      "fighter-2",
      "close-air-support-2",
      "naval-bomber-2",
      "basic-machine-tools",
      "construction-1",
      "fuel-storage",
      "electronic-mechanical-engineering",
      "atomic-research",
    ]);
  });

  it("should offer what a technology leads to only once it is researched when it is still on a slot", () => {
    const research = studyStarted(START_RESEARCH, "construction-1");

    expect(availableTechs(research)).toStrictEqual([
      "improved-infantry-equipment-1",
      "great-war-tank",
      "early-truck",
      "mountain-infantry-1",
      "marines-1",
      "paratroopers-1",
      "destroyer-3",
      "light-cruiser-3",
      "battleship-3",
      "carrier-3",
      "submarine-3",
      "basic-light-battery",
      "basic-medium-battery",
      "basic-heavy-battery",
      "magnetic-detonator",
      "fighter-2",
      "close-air-support-2",
      "naval-bomber-2",
      "basic-machine-tools",
      "fuel-storage",
      "electronic-mechanical-engineering",
      "atomic-research",
    ]);
  });

  it("should offer both paths a technology opens when it is researched", () => {
    expect(availableTechs(MACHINE_TOOLS)).toStrictEqual([
      "improved-infantry-equipment-1",
      "great-war-tank",
      "early-truck",
      "mountain-infantry-1",
      "marines-1",
      "paratroopers-1",
      "destroyer-3",
      "light-cruiser-3",
      "battleship-3",
      "carrier-3",
      "submarine-3",
      "basic-light-battery",
      "basic-medium-battery",
      "basic-heavy-battery",
      "magnetic-detonator",
      "fighter-2",
      "close-air-support-2",
      "naval-bomber-2",
      "concentrated-industry-1",
      "dispersed-industry-1",
      "construction-1",
      "fuel-storage",
      "electronic-mechanical-engineering",
      "atomic-research",
    ]);
  });

  it.each([
    { excluded: "dispersed-industry-1", started: "concentrated-industry-1" },
    { excluded: "concentrated-industry-1", started: "dispersed-industry-1" },
  ] satisfies readonly { excluded: TechId; started: TechId }[])(
    "should leave out $excluded when $started is started",
    ({ excluded, started }) => {
      const research = studyStarted(MACHINE_TOOLS, started);

      expect(availableTechs(research)).not.toContain(excluded);
    }
  );
});

describe(leadingTechs, () => {
  it("should offer one technology per line when the world opens", () => {
    expect(leadingTechs(START_RESEARCH)).toStrictEqual([
      "improved-infantry-equipment-1",
      "great-war-tank",
      "early-truck",
      "mountain-infantry-1",
      "destroyer-3",
      "light-cruiser-3",
      "battleship-3",
      "carrier-3",
      "submarine-3",
      "basic-light-battery",
      "fighter-2",
      "close-air-support-2",
      "naval-bomber-2",
      "basic-machine-tools",
      "construction-1",
      "fuel-storage",
      "electronic-mechanical-engineering",
    ]);
  });

  it("should offer the line's technology for the earliest year when a later one comes first in the tree", () => {
    const research: Research = {
      ...START_RESEARCH,
      researched: [...START_RESEARCH.researched, "construction-1"],
    };

    expect(leadingTechs(research)).toContain("excavation-1");
  });

  it("should offer dispersed industry beside concentrated industry when the machine tools that open both are researched", () => {
    const research: Research = {
      ...START_RESEARCH,
      researched: [...START_RESEARCH.researched, "basic-machine-tools"],
    };

    expect(
      leadingTechs(research).filter((tech) => techOf(tech).line === "industry")
    ).toStrictEqual(["concentrated-industry-1", "dispersed-industry-1"]);
  });

  it("should offer nothing from a line when every technology on it is taken", () => {
    const research: Research = {
      ...START_RESEARCH,
      researched: [
        ...START_RESEARCH.researched,
        "improved-infantry-equipment-1",
        "infantry-equipment-2",
        "improved-infantry-equipment-2",
        "infantry-equipment-3",
        "improved-infantry-equipment-3",
      ],
    };

    expect(leadingTechs(research)).toStrictEqual([
      "great-war-tank",
      "early-truck",
      "mountain-infantry-1",
      "destroyer-3",
      "light-cruiser-3",
      "battleship-3",
      "carrier-3",
      "submarine-3",
      "basic-light-battery",
      "fighter-2",
      "close-air-support-2",
      "naval-bomber-2",
      "basic-machine-tools",
      "construction-1",
      "fuel-storage",
      "electronic-mechanical-engineering",
    ]);
  });
});

describe(studyStarted, () => {
  it("should take the oldest research bonus covering the category when several are waiting", () => {
    const research: Research = {
      ...START_RESEARCH,
      vouchers: [INDUSTRY_VOUCHER, NAVAL_VOUCHER, LATER_NAVAL_VOUCHER],
    };

    expect(studyStarted(research, "destroyer-3")).toStrictEqual({
      ...START_RESEARCH,
      studies: [
        { ahead: 1, bonus: 0.5, progress: 0, saved: 0, tech: "destroyer-3" },
      ],
      vouchers: [INDUSTRY_VOUCHER, LATER_NAVAL_VOUCHER],
    });
  });

  it("should start with no bonus and keep every voucher when none covers the category", () => {
    const research: Research = {
      ...START_RESEARCH,
      vouchers: [INDUSTRY_VOUCHER],
    };

    expect(studyStarted(research, "fighter-2")).toStrictEqual({
      ...START_RESEARCH,
      studies: [studyOf("fighter-2")],
      vouchers: [INDUSTRY_VOUCHER],
    });
  });

  it("should take the days saved by the slot idle longest when slots have saved days", () => {
    const research: Research = { ...START_RESEARCH, saved: [30, 4] };

    expect(studyStarted(research, "fuel-storage")).toStrictEqual({
      ...START_RESEARCH,
      saved: [4],
      studies: [{ ...studyOf("fuel-storage"), saved: 30 }],
    });
  });
});

describe(bonusUsable, () => {
  it.each<{
    condition: string;
    research: Research;
    categories: readonly ("naval" | "industry" | "electronics")[];
    wanted: number;
    usable: boolean;
  }>([
    {
      categories: ["naval"],
      condition: "the world opens and two naval bonuses are wanted",
      research: START_RESEARCH,
      usable: true,
      wanted: 2,
    },
    {
      categories: ["naval"],
      condition: "a bonus covering naval is already waiting",
      research: { ...START_RESEARCH, vouchers: [LATER_NAVAL_VOUCHER] },
      usable: false,
      wanted: 1,
    },
    {
      categories: ["naval"],
      condition: "only a bonus for another category is waiting",
      research: { ...START_RESEARCH, vouchers: [INDUSTRY_VOUCHER] },
      usable: true,
      wanted: 1,
    },
    {
      categories: ["electronics"],
      condition: "as many electronics technologies as wanted could be started",
      research: START_RESEARCH,
      usable: true,
      wanted: 6,
    },
    {
      categories: ["electronics"],
      condition: "one more is wanted than electronics technologies remain",
      research: START_RESEARCH,
      usable: false,
      wanted: 7,
    },
    {
      categories: ["industry"],
      condition: "both industry paths are still open",
      research: MACHINE_TOOLS,
      usable: true,
      wanted: 26,
    },
    {
      categories: ["industry"],
      condition:
        "the path a started technology rules out no longer counts, though the one it leads to does",
      research: studyStarted(MACHINE_TOOLS, "concentrated-industry-1"),
      usable: true,
      wanted: 20,
    },
    {
      categories: ["industry"],
      condition: "one more is wanted than remain once a path is ruled out",
      research: studyStarted(MACHINE_TOOLS, "concentrated-industry-1"),
      usable: false,
      wanted: 21,
    },
  ])(
    "should tell whether $wanted bonuses find a use when $condition",
    ({ categories, research, usable, wanted }) => {
      expect(bonusUsable(research, categories, wanted)).toBe(usable);
    }
  );
});

describe(vouchersGranted, () => {
  it("should put the vouchers after those already waiting when some are granted", () => {
    const research: Research = {
      ...START_RESEARCH,
      vouchers: [INDUSTRY_VOUCHER],
    };

    expect(
      vouchersGranted(research, [NAVAL_VOUCHER, LATER_NAVAL_VOUCHER])
    ).toStrictEqual({
      ...START_RESEARCH,
      vouchers: [INDUSTRY_VOUCHER, NAVAL_VOUCHER, LATER_NAVAL_VOUCHER],
    });
  });
});

describe(researchedOneDay, () => {
  it("should put one research-day and the research speed into a study when its technology is current", () => {
    const research: Research = {
      ...START_RESEARCH,
      studies: [studyOf("fuel-storage")],
    };

    expect(researchedOneDay(research, 1, 0.5, JANUARY_1936)).toStrictEqual({
      ...START_RESEARCH,
      studies: [{ ...studyOf("fuel-storage"), progress: 1.5 }],
    });
  });

  it("should research at a third of the speed when the technology is a year ahead of time", () => {
    const research: Research = {
      ...START_RESEARCH,
      studies: [studyOf("fighter-2")],
    };

    expect(researchedOneDay(research, 1, 0, JANUARY_1939)).toStrictEqual({
      ...START_RESEARCH,
      studies: [{ ...studyOf("fighter-2"), progress: 1 / 3 }],
    });
  });

  it("should research at a fifth of the speed when the technology is two years ahead of time", () => {
    const research: Research = {
      ...START_RESEARCH,
      studies: [studyOf("fighter-2")],
    };

    expect(researchedOneDay(research, 1, 0, JANUARY_1938)).toStrictEqual({
      ...START_RESEARCH,
      studies: [{ ...studyOf("fighter-2"), progress: 1 / 5 }],
    });
  });

  it("should research at a third of the speed when a one-year bonus leaves the technology a year of its two ahead of time", () => {
    const research: Research = {
      ...START_RESEARCH,
      studies: [{ ...studyOf("fighter-2"), ahead: 1 }],
    };

    expect(researchedOneDay(research, 1, 0, JANUARY_1938)).toStrictEqual({
      ...START_RESEARCH,
      studies: [{ ...studyOf("fighter-2"), ahead: 1, progress: 1 / 3 }],
    });
  });

  it.each([
    { ahead: 1, progress: 1 },
    { ahead: 2, progress: 1 },
    { ahead: 3, progress: 1 },
  ])(
    "should put $progress research-days in a year early when the bonus takes $ahead years off",
    ({ ahead, progress }) => {
      const research: Research = {
        ...START_RESEARCH,
        studies: [{ ...studyOf("fighter-2"), ahead }],
      };

      expect(researchedOneDay(research, 1, 0, JANUARY_1939)).toStrictEqual({
        ...START_RESEARCH,
        studies: [{ ...studyOf("fighter-2"), ahead, progress }],
      });
    }
  );

  it("should put the study's research bonus on top of every day when the study was started on a voucher", () => {
    const research: Research = {
      ...START_RESEARCH,
      studies: [{ ...studyOf("fuel-storage"), bonus: 0.25 }],
    };

    expect(researchedOneDay(research, 1, 0.5, JANUARY_1936)).toStrictEqual({
      ...START_RESEARCH,
      studies: [{ ...studyOf("fuel-storage"), bonus: 0.25, progress: 1.75 }],
    });
  });

  it("should spend the days its slot saved on the study's first day when the slot had saved some", () => {
    const research: Research = {
      ...START_RESEARCH,
      studies: [{ ...studyOf("fuel-storage"), saved: 29 }],
    };

    expect(researchedOneDay(research, 1, 0, JANUARY_1936)).toStrictEqual({
      ...START_RESEARCH,
      studies: [{ ...studyOf("fuel-storage"), progress: 30 }],
    });
  });

  it("should move a technology to the researched list and free its slot with nothing saved when it reaches its days", () => {
    const research: Research = {
      ...START_RESEARCH,
      studies: [
        { ...studyOf("fuel-storage"), progress: 109 },
        studyOf("construction-1"),
      ],
    };

    expect(researchedOneDay(research, 2, 0, JANUARY_1936)).toStrictEqual({
      ...START_RESEARCH,
      researched: [...START_RESEARCH.researched, "fuel-storage"],
      saved: [0],
      studies: [{ ...studyOf("construction-1"), progress: 1 }],
    });
  });

  it("should save a day on each idle slot when slots are free", () => {
    const research: Research = { ...START_RESEARCH, saved: [5] };

    expect(researchedOneDay(research, 2, 0, JANUARY_1936)).toStrictEqual({
      ...START_RESEARCH,
      saved: [6, 1],
    });
  });

  it("should save no more than 30 days on a slot when it has been idle a month", () => {
    const research: Research = { ...START_RESEARCH, saved: [30] };

    expect(researchedOneDay(research, 1, 0, JANUARY_1936)).toStrictEqual({
      ...START_RESEARCH,
      saved: [30],
    });
  });

  it("should save nothing when more studies run than there are slots", () => {
    const research: Research = {
      ...START_RESEARCH,
      studies: [studyOf("fuel-storage"), studyOf("construction-1")],
    };

    expect(researchedOneDay(research, 1, 0, JANUARY_1936)).toStrictEqual({
      ...START_RESEARCH,
      studies: [
        { ...studyOf("fuel-storage"), progress: 1 },
        { ...studyOf("construction-1"), progress: 1 },
      ],
    });
  });
});

describe(researchBonuses, () => {
  it("should list what each researched technology adds when some are researched", () => {
    expect(
      researchBonuses({
        ...START_RESEARCH,
        researched: ["construction-1", "fuel-refining-1"],
      })
    ).toStrictEqual([{ construction: 0.1 }, { refining: 0.2 }]);
  });
});

describe(shipUpgradesOf, () => {
  it("should list what each researched technology adds to warships' weapons when some are researched", () => {
    expect(
      shipUpgradesOf({
        ...START_RESEARCH,
        researched: ["fuel-storage", "armor-piercing-capped-shell"],
      })
    ).toStrictEqual([
      { share: 0.05, shipClass: "battleship", weapon: "heavy" },
    ]);
  });
});
