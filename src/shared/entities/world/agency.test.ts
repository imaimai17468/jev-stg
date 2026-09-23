import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { Agency, AgencyProject, AgencyUpgrade } from "./agency";
import {
  AGENCY_DAYS,
  agencyModifiersOf,
  agencyOptions,
  agencyStarted,
  agencyWorkedOneDay,
  factoriesFor,
  factoriesTiedUp,
  levelsOf,
  NO_AGENCY,
  NO_AGENCY_MODIFIERS,
} from "./agency";

/** A founded agency with `upgrades` bought, idle. */
const foundedWith = (upgrades: readonly AgencyUpgrade[]): Agency => ({
  ...NO_AGENCY,
  standing: "founded",
  upgrades,
});

/** A founded agency with nothing bought, `daysLeft` into `project`. */
const workingOn = (project: AgencyProject, daysLeft: number): Agency => ({
  ...foundedWith([]),
  work: { daysLeft, kind: "working", project },
});

/** Every upgrade that waits on nothing, in the order the screen lists them. */
const UNGATED: readonly AgencyUpgrade[] = [
  "civilian-department",
  "army-department",
  "navy-department",
  "air-department",
  "passive-defense",
  "blueprint-stealing",
  "invisible-ink",
  "plastic-explosives",
  "interrogation-techniques",
];

const CRYPTOLOGY_BRANCH: readonly AgencyUpgrade[] = [
  "radio-interception",
  "cypher-school",
  "machine-encryption",
];

describe(levelsOf, () => {
  it("should count each level bought when an upgrade is bought more than once", () => {
    const agency = foundedWith([
      "passive-defense",
      "air-department",
      "passive-defense",
    ]);

    expect(levelsOf(agency, "passive-defense")).toBe(2);
  });
});

describe(agencyOptions, () => {
  it("should offer nothing when the agency is already at work", () => {
    expect(agencyOptions(workingOn("found", 3), [])).toStrictEqual([]);
  });

  it("should offer only founding when the nation has no agency", () => {
    expect(agencyOptions(NO_AGENCY, [])).toStrictEqual(["found"]);
  });

  it("should offer every upgrade that waits on nothing when the agency has bought nothing", () => {
    expect(agencyOptions(foundedWith([]), [])).toStrictEqual([
      ...UNGATED,
      "cryptology-department",
    ]);
  });

  it("should open the cryptology branch but hold back machine decryption when computing is not researched", () => {
    expect(
      agencyOptions(foundedWith(["cryptology-department"]), [])
    ).toStrictEqual([...UNGATED, ...CRYPTOLOGY_BRANCH]);
  });

  it("should offer machine decryption when the department is bought and computing is researched", () => {
    expect(
      agencyOptions(foundedWith(["cryptology-department"]), [
        "mechanical-computing",
      ])
    ).toStrictEqual([
      ...UNGATED,
      "radio-interception",
      "machine-decryption",
      "cypher-school",
      "machine-encryption",
    ]);
  });
});

describe(agencyStarted, () => {
  it("should start nothing when the project is not on offer", () => {
    expect(agencyStarted(NO_AGENCY, "air-department", [])).toStrictEqual(
      Option.none()
    );
  });

  it("should set the agency to work for a month when the project is on offer", () => {
    expect(agencyStarted(NO_AGENCY, "found", [])).toStrictEqual(
      Option.some({
        ...NO_AGENCY,
        work: { daysLeft: AGENCY_DAYS, kind: "working", project: "found" },
      })
    );
  });
});

describe(agencyWorkedOneDay, () => {
  it("should leave an idle agency as it was when a day passes", () => {
    expect(agencyWorkedOneDay(NO_AGENCY)).toBe(NO_AGENCY);
  });

  it("should take a day off the project when it has more than one left", () => {
    expect(agencyWorkedOneDay(workingOn("air-department", 5))).toStrictEqual(
      workingOn("air-department", 4)
    );
  });

  it("should found the agency when founding it has its last day", () => {
    expect(
      agencyWorkedOneDay({
        ...NO_AGENCY,
        work: { daysLeft: 1, kind: "working", project: "found" },
      })
    ).toStrictEqual(foundedWith([]));
  });

  it("should add the upgrade's level when buying it has its last day", () => {
    expect(agencyWorkedOneDay(workingOn("air-department", 1))).toStrictEqual(
      foundedWith(["air-department"])
    );
  });
});

describe(factoriesFor, () => {
  it("should tie up five factories when the project founds the agency", () => {
    expect(factoriesFor("found")).toBe(5);
  });

  it("should tie up the upgrade's own factories when the project is an upgrade", () => {
    expect(factoriesFor("machine-encryption")).toBe(15);
  });
});

describe(factoriesTiedUp, () => {
  it("should tie up nothing when the agency is idle", () => {
    expect(factoriesTiedUp(NO_AGENCY)).toBe(0);
  });

  it("should tie up what the project takes when the agency is at work", () => {
    expect(factoriesTiedUp(workingOn("cryptology-department", 10))).toBe(8);
  });
});

describe(agencyModifiersOf, () => {
  it("should add nothing when the agency has bought nothing", () => {
    expect(agencyModifiersOf(foundedWith([]))).toStrictEqual(
      NO_AGENCY_MODIFIERS
    );
  });

  it("should add what each level adds when an upgrade is bought at several levels", () => {
    expect(
      agencyModifiersOf(
        foundedWith([
          "passive-defense",
          "cryptology-department",
          "passive-defense",
        ])
      )
    ).toStrictEqual({
      ...NO_AGENCY_MODIFIERS,
      counterIntelligence: 2.75,
      cryptology: 1,
      decryption: 25,
    });
  });
});
