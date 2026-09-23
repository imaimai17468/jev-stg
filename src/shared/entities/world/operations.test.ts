import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { IntelKind } from "./intel";
import type { Operation, Prospect } from "./operations";
import { operationTermsOf, operationWanted } from "./operations";

/** A coastal target with nothing captive, nothing infiltrated, and no resistance work, at peace. */
const OPEN_TARGET: Prospect = {
  atWar: false,
  captives: 0,
  cipherBroken: false,
  coastal: true,
  codebreakers: false,
  infiltrated: new Set(),
  occupies: false,
  room: false,
  underway: new Set(),
  unrest: new Set(),
  usableBlueprints: new Set([
    "steal-military-blueprints",
    "steal-industrial-blueprints",
  ]),
};

const EVERY_KIND: ReadonlySet<IntelKind> = new Set([
  "civilian",
  "army",
  "navy",
  "air",
]);

/** A target every kind of intelligence is already in, with whatever a row needs changed. */
const infiltratedTarget = (patch: Partial<Prospect>): Prospect => ({
  ...OPEN_TARGET,
  infiltrated: EVERY_KIND,
  ...patch,
});

describe(operationTermsOf, () => {
  it("should read Hearts of Iron IV's terms when an operation is named", () => {
    expect(operationTermsOf("sabotage-industry")).toStrictEqual({
      days: 90,
      network: 35,
      operatives: 3,
      risk: 0.2,
    });
  });
});

describe(operationWanted, () => {
  it.each<{
    condition: string;
    prospect: Prospect;
    free: number;
    strength: number;
    wanted: Option.Option<Operation>;
  }>([
    {
      condition: "an operative is held captive and the agency has room",
      free: 3,
      prospect: { ...OPEN_TARGET, captives: 1, room: true },
      strength: 100,
      wanted: Option.some("rescue-operative"),
    },
    {
      condition: "an operative is held captive but the agency has no room",
      free: 3,
      prospect: { ...OPEN_TARGET, captives: 1 },
      strength: 100,
      wanted: Option.some("infiltrate-civilian"),
    },
    {
      condition: "only the economy is infiltrated",
      free: 3,
      prospect: { ...OPEN_TARGET, infiltrated: new Set(["civilian"]) },
      strength: 100,
      wanted: Option.some("infiltrate-army"),
    },
    {
      condition: "the economy and the army are infiltrated on a coast",
      free: 3,
      prospect: { ...OPEN_TARGET, infiltrated: new Set(["civilian", "army"]) },
      strength: 100,
      wanted: Option.some("infiltrate-navy"),
    },
    {
      condition: "the economy and the army are infiltrated inland",
      free: 3,
      prospect: {
        ...OPEN_TARGET,
        coastal: false,
        infiltrated: new Set(["civilian", "army"]),
      },
      strength: 100,
      wanted: Option.some("infiltrate-air"),
    },
    {
      condition:
        "everything is infiltrated, the codebreakers have an unbroken cipher to take, and two operatives are too few for blueprints",
      free: 2,
      prospect: infiltratedTarget({ codebreakers: true }),
      strength: 100,
      wanted: Option.some("capture-cipher"),
    },
    {
      condition: "the cipher is already broken and the target occupies ground",
      free: 3,
      prospect: infiltratedTarget({
        cipherBroken: true,
        codebreakers: true,
        occupies: true,
      }),
      strength: 100,
      wanted: Option.some("resistance-contacts"),
    },
    {
      condition:
        "resistance contacts are running against an occupier and two operatives are too few for sabotage",
      free: 2,
      prospect: infiltratedTarget({
        occupies: true,
        unrest: new Set(["contacts"]),
      }),
      strength: 100,
      wanted: Option.some("strengthen-resistance"),
    },
    {
      condition: "the resistance is contacted and strengthened",
      free: 3,
      prospect: infiltratedTarget({
        unrest: new Set(["contacts", "strengthened"]),
      }),
      strength: 100,
      wanted: Option.some("sabotage-industry"),
    },
    {
      condition:
        "every piece of resistance work is running and the nation is at war",
      free: 3,
      prospect: infiltratedTarget({
        atWar: true,
        unrest: new Set(["contacts", "strengthened", "sabotage"]),
      }),
      strength: 100,
      wanted: Option.some("steal-military-blueprints"),
    },
    {
      condition: "everything is infiltrated and the nation is at peace",
      free: 3,
      prospect: infiltratedTarget({}),
      strength: 100,
      wanted: Option.some("steal-industrial-blueprints"),
    },
    {
      condition: "the free operatives are too few for the one operation open",
      free: 2,
      prospect: infiltratedTarget({}),
      strength: 100,
      wanted: Option.none(),
    },
    {
      condition: "the network is too weak for every operation open",
      free: 3,
      prospect: infiltratedTarget({ captives: 1, room: true }),
      strength: 29,
      wanted: Option.none(),
    },
  ])(
    "should pick the first operation the rules weigh that is open when $condition",
    ({ free, prospect, strength, wanted }) => {
      expect(
        operationWanted(prospect, { fielded: free, free }, strength)
      ).toStrictEqual(wanted);
    }
  );
});

describe("operationWanted with operations under way", () => {
  it("should pass over an operation already under way in the target when the rules pick the next", () => {
    const busy: Prospect = {
      ...OPEN_TARGET,
      underway: new Set<Operation>(["infiltrate-civilian"]),
    };

    expect(operationWanted(busy, { fielded: 4, free: 4 }, 100)).toStrictEqual(
      Option.some("infiltrate-army")
    );
  });
});

describe("operationWanted with blueprints open", () => {
  it("should capture the cipher before stealing the army's blueprints again when the codebreakers can and the crew is three", () => {
    expect(
      operationWanted(
        infiltratedTarget({ atWar: true, codebreakers: true }),
        { fielded: 3, free: 3 },
        100
      )
    ).toStrictEqual(Option.some("capture-cipher"));
  });
});

describe("operationWanted with a blueprint's bonus unusable", () => {
  it.each<{ atWar: boolean }>([{ atWar: true }, { atWar: false }])(
    "should steal no blueprints when the research has no use for their bonus and at war is $atWar",
    ({ atWar }) => {
      expect(
        operationWanted(
          infiltratedTarget({ atWar, usableBlueprints: new Set() }),
          { fielded: 3, free: 3 },
          100
        )
      ).toStrictEqual(Option.none());
    }
  );
});

describe("operationWanted with operatives away on missions", () => {
  it("should wait for the rest to come back when all of them together are enough for the first operation open", () => {
    expect(
      operationWanted(infiltratedTarget({}), { fielded: 3, free: 2 }, 100)
    ).toStrictEqual(Option.none());
  });
});
