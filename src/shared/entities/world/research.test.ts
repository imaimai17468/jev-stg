import { describe, expect, it } from "vite-plus/test";
import type { Research } from "./research";
import {
  availableTechs,
  costOf,
  researchBonuses,
  researchedOneDay,
  START_RESEARCH,
  studyStarted,
  TechIdSchema,
  techOf,
} from "./research";

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
    ]);
  });

  it("should offer what a finished technology leads to when its prerequisite is researched", () => {
    const research: Research = { researched: ["tools-1"], studies: [] };

    expect(availableTechs(research)).toStrictEqual([
      "infantry-weapons-1",
      "artillery-1",
      "modern-tactics",
      "tools-2",
      "concentrated-industry-1",
      "dispersed-industry-1",
      "construction-1",
      "electronics-1",
    ]);
  });

  it("should leave out a technology already on a slot when a slot is working on it", () => {
    const research = studyStarted(START_RESEARCH, "artillery-1");

    expect(availableTechs(research)).not.toContain("artillery-1");
  });

  it("should leave out the other of an exclusive pair when one of them is started", () => {
    const research = studyStarted(
      { researched: ["modern-tactics"], studies: [] },
      "superior-firepower-1"
    );

    expect(availableTechs(research)).not.toContain("mass-assault-1");
  });

  it("should leave out the other of an exclusive pair when the one naming it is started", () => {
    const research = studyStarted(
      { researched: ["modern-tactics"], studies: [] },
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

describe(researchedOneDay, () => {
  it("should put one research-day and the bonus into every slot when the day passes", () => {
    const research = studyStarted(START_RESEARCH, "artillery-1");

    expect(researchedOneDay(research, 0.5, 1936)).toStrictEqual({
      researched: [],
      studies: [{ progress: 1.5, tech: "artillery-1" }],
    });
  });

  it("should move a technology to the researched list and free its slot when it reaches its cost", () => {
    const research: Research = {
      researched: [],
      studies: [
        { progress: 99, tech: "artillery-1" },
        { progress: 0, tech: "tools-1" },
      ],
    };

    expect(researchedOneDay(research, 0, 1936)).toStrictEqual({
      researched: ["artillery-1"],
      studies: [{ progress: 1, tech: "tools-1" }],
    });
  });
});

describe(researchBonuses, () => {
  it("should list what each researched technology adds when some are researched", () => {
    expect(
      researchBonuses({ researched: ["tools-1", "artillery-1"], studies: [] })
    ).toStrictEqual([{ production: 0.1 }, { attack: 0.1 }]);
  });
});
