import { describe, expect, it } from "vite-plus/test";
import type { Research, Voucher } from "./research";
import {
  availableTechs,
  bonusUsable,
  costOf,
  researchBonuses,
  researchedOneDay,
  START_RESEARCH,
  studyStarted,
  TechIdSchema,
  techOf,
  voucherGranted,
} from "./research";

const INDUSTRY_VOUCHER: Voucher = { branches: ["industry"], share: 0.5 };

const ARTILLERY_VOUCHER: Voucher = {
  branches: ["infantry", "artillery"],
  share: 0.2,
};

const LATER_ARTILLERY_VOUCHER: Voucher = {
  branches: ["artillery"],
  share: 0.3,
};

describe(costOf, () => {
  it("should take the technology's own days when it is researched in its year", () => {
    expect(costOf("infantry-weapons-1", 1936)).toBe(100);
  });

  it("should take no less when it is researched after its year", () => {
    expect(costOf("infantry-weapons-1", 1940)).toBe(100);
  });

  it("should take its days once more for each year when it is researched early", () => {
    expect(costOf("infantry-weapons-2", 1937)).toBe(360);
  });
});

describe(availableTechs, () => {
  it("should offer every technology with no prerequisite when nothing is researched", () => {
    expect(availableTechs(START_RESEARCH)).toStrictEqual([
      "infantry-weapons-1",
      "artillery-1",
      "modern-tactics",
      "tools-1",
      "construction-1",
      "electronics-1",
      "logistics-1",
    ]);
  });

  it("should offer what a finished technology leads to when its prerequisite is researched", () => {
    const research: Research = { ...START_RESEARCH, researched: ["tools-1"] };

    expect(availableTechs(research)).toStrictEqual([
      "infantry-weapons-1",
      "artillery-1",
      "modern-tactics",
      "tools-2",
      "concentrated-industry-1",
      "dispersed-industry-1",
      "construction-1",
      "electronics-1",
      "logistics-1",
    ]);
  });

  it("should leave out a technology already on a slot when a slot is working on it", () => {
    const research = studyStarted(START_RESEARCH, "artillery-1");

    expect(availableTechs(research)).not.toContain("artillery-1");
  });

  it("should leave out the other of an exclusive pair when one of them is started", () => {
    const research = studyStarted(
      { ...START_RESEARCH, researched: ["modern-tactics"] },
      "superior-firepower-1"
    );

    expect(availableTechs(research)).not.toContain("mass-assault-1");
  });

  it("should leave out the other of an exclusive pair when the one naming it is started", () => {
    const research = studyStarted(
      { ...START_RESEARCH, researched: ["modern-tactics"] },
      "mass-assault-1"
    );

    expect(availableTechs(research)).not.toContain("superior-firepower-1");
  });
});

describe(techOf, () => {
  it("should name only technologies of the tree when any technology lists a prerequisite or an exclusion", () => {
    const known = new Set<string>(TechIdSchema.literals);

    expect(
      TechIdSchema.literals
        .flatMap((tech) => [...techOf(tech).requires, ...techOf(tech).excludes])
        .filter((named) => !known.has(named))
    ).toStrictEqual([]);
  });
});

describe(studyStarted, () => {
  it("should take the oldest research bonus covering the branch when several are waiting", () => {
    const research: Research = {
      ...START_RESEARCH,
      vouchers: [INDUSTRY_VOUCHER, ARTILLERY_VOUCHER, LATER_ARTILLERY_VOUCHER],
    };

    expect(studyStarted(research, "artillery-1")).toStrictEqual({
      ...START_RESEARCH,
      studies: [{ bonus: 0.2, progress: 0, tech: "artillery-1" }],
      vouchers: [INDUSTRY_VOUCHER, LATER_ARTILLERY_VOUCHER],
    });
  });

  it("should start with no bonus and keep every voucher when none covers the branch", () => {
    const research: Research = {
      ...START_RESEARCH,
      vouchers: [INDUSTRY_VOUCHER],
    };

    expect(studyStarted(research, "artillery-1")).toStrictEqual({
      ...START_RESEARCH,
      studies: [{ bonus: 0, progress: 0, tech: "artillery-1" }],
      vouchers: [INDUSTRY_VOUCHER],
    });
  });
});

/** Every technology the industry branch holds, researched. */
const INDUSTRY_DONE: Research = {
  ...START_RESEARCH,
  researched: [
    "tools-1",
    "tools-2",
    "tools-3",
    "tools-4",
    "concentrated-industry-1",
    "concentrated-industry-2",
  ],
};

describe(bonusUsable, () => {
  it.each<{ condition: string; research: Research; usable: boolean }>([
    {
      condition: "nothing is researched yet",
      research: START_RESEARCH,
      usable: true,
    },
    {
      condition: "a bonus for one of the branches is already waiting",
      research: { ...START_RESEARCH, vouchers: [INDUSTRY_VOUCHER] },
      usable: false,
    },
    {
      condition:
        "every technology left in the branch needs one that an earlier pick ruled out",
      research: INDUSTRY_DONE,
      usable: false,
    },
    {
      condition: "the one technology left waits on another that is on a slot",
      research: {
        ...INDUSTRY_DONE,
        researched: INDUSTRY_DONE.researched.filter(
          (tech) =>
            tech !== "concentrated-industry-1" &&
            tech !== "concentrated-industry-2"
        ),
        studies: [{ bonus: 0, progress: 0, tech: "concentrated-industry-1" }],
      },
      usable: true,
    },
  ])(
    "should tell whether a bonus for industry finds a use when $condition",
    ({ research, usable }) => {
      expect(bonusUsable(research, ["industry"])).toBe(usable);
    }
  );
});

describe(voucherGranted, () => {
  it("should put the voucher after those already waiting when one is granted", () => {
    const research: Research = {
      ...START_RESEARCH,
      vouchers: [INDUSTRY_VOUCHER],
    };

    expect(voucherGranted(research, ARTILLERY_VOUCHER)).toStrictEqual({
      ...START_RESEARCH,
      vouchers: [INDUSTRY_VOUCHER, ARTILLERY_VOUCHER],
    });
  });
});

describe(researchedOneDay, () => {
  it("should put one research-day and the bonus into every slot when the day passes", () => {
    const research = studyStarted(START_RESEARCH, "artillery-1");

    expect(researchedOneDay(research, 0.5, 1936)).toStrictEqual({
      ...START_RESEARCH,
      studies: [{ bonus: 0, progress: 1.5, tech: "artillery-1" }],
    });
  });

  it("should move a technology to the researched list and free its slot when it reaches its cost", () => {
    const research: Research = {
      ...START_RESEARCH,
      studies: [
        { bonus: 0, progress: 99, tech: "artillery-1" },
        { bonus: 0, progress: 0, tech: "tools-1" },
      ],
    };

    expect(researchedOneDay(research, 0, 1936)).toStrictEqual({
      ...START_RESEARCH,
      researched: ["artillery-1"],
      studies: [{ bonus: 0, progress: 1, tech: "tools-1" }],
    });
  });

  it("should put the study's research bonus on top of every day when the study was started on a voucher", () => {
    const research: Research = {
      ...START_RESEARCH,
      studies: [{ bonus: 0.25, progress: 0, tech: "artillery-1" }],
    };

    expect(researchedOneDay(research, 0.5, 1936)).toStrictEqual({
      ...START_RESEARCH,
      studies: [{ bonus: 0.25, progress: 1.75, tech: "artillery-1" }],
    });
  });
});

describe(researchBonuses, () => {
  it("should list what each researched technology adds when some are researched", () => {
    expect(
      researchBonuses({
        ...START_RESEARCH,
        researched: ["tools-1", "artillery-1"],
      })
    ).toStrictEqual([{ production: 0.1 }, { attack: 0.1 }]);
  });
});
