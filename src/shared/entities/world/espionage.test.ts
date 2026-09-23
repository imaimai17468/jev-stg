import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { Advancement } from "./advancement";
import { START_ADVANCEMENT } from "./advancement";
import type { Agency, AgencyUpgrade } from "./agency";
import { NO_AGENCY } from "./agency";
import { AT_WAR, LINE_GRAPH, LINE_OWNERS } from "./army-fixture";
import { noCiphers } from "./cipher";
import { startCompliance } from "./compliance";
import type { Diplomacy } from "./diplomacy";
import { INDEPENDENT, openingDiplomacy } from "./diplomacy";
import { NO_ECONOMY } from "./economy";
import type { Assignment, Plotted, Scene, Service } from "./espionage";
import {
  centerIn,
  counterIntelligenceOf,
  freeOperatives,
  heldCaptives,
  HOME,
  NO_SERVICE,
  openingServices,
  plottedOneDay,
  serviceFor,
  slotsOf,
} from "./espionage";
import { valueAt } from "./grid";
import { itemAt } from "./lookup";
import type { Operation } from "./operations";
import { operationTermsOf } from "./operations";
import type { Random } from "./random";
import { START_RESEARCH } from "./research";
import type { Unrest } from "./unrest";

const noBound = (): number => 0;

/** Draws that always come out at `unit`. */
const drawing = (unit: number): Random => ({
  below: noBound,
  unit: () => unit,
});

/** Draws that catch nobody. */
const NEVER = drawing(0.99);

/** Draws that catch every operative with any chance at all of being caught. */
const ALWAYS = drawing(0);

const PEACE: Diplomacy = openingDiplomacy(Int32Array.from(LINE_OWNERS), 2, []);

const WAR: Diplomacy = { ...PEACE, wars: AT_WAR };

/** Nation 0 against nation 1 along the line, capitals at either end, at peace. */
const SCENE: Scene = {
  capitals: [0, 3],
  compliance: startCompliance(LINE_OWNERS),
  day: 0,
  diplomacy: PEACE,
  economies: [NO_ECONOMY, NO_ECONOMY],
  graph: LINE_GRAPH,
  owners: LINE_OWNERS,
  random: NEVER,
};

/** Nation 1 holding nation 0's province 1 as well as its own two. */
const OCCUPYING_OWNERS = Int32Array.from([0, 1, 1, 1, -1]);

const agencyWith = (upgrades: readonly AgencyUpgrade[]): Agency => ({
  ...NO_AGENCY,
  standing: "founded",
  upgrades,
});

/** A founded agency with one operative slot. */
const FOUNDED = agencyWith([]);

/** A founded agency with enough upgrades for a second slot. */
const FIVE_UPGRADES = agencyWith([
  "civilian-department",
  "army-department",
  "navy-department",
  "air-department",
  "passive-defense",
]);

const CODEBREAKERS = agencyWith(["cryptology-department"]);

const service = (patch: Partial<Service>): Service => ({
  ...serviceFor(2),
  ...patch,
});

/** `operation` against nation 1, run from its capital, with `daysLeft` to go. */
const mission = (operation: Operation, daysLeft: number): Assignment => ({
  daysLeft,
  location: 3,
  operation,
  operatives: operationTermsOf(operation).operatives,
  target: 1,
});

/** A network in the line's provinces as strong as `strengths`. */
const networkOf = (strengths: readonly number[]): Float32Array =>
  Float32Array.from(strengths);

/** Nation 0's network strong enough in nation 1's capital for the operations that need 40. */
const CAPITAL_NETWORK = networkOf([0, 0, 0, 40, 0]);

/** What a day around nation 0's service reads, where it is not what `SCENE` opens with. */
interface Setting {
  readonly host?: Service;
  readonly network?: Float32Array;
  readonly unrest?: readonly Unrest[];
  readonly advancement?: Advancement;
  readonly diplomacy?: Diplomacy;
  readonly random?: Random;
  readonly owners?: Int32Array;
}

/** One day of the line's intelligence work with nation 0's service as `spy`. */
const dayOf = (spy: Service, setting: Setting = {}): Plotted =>
  plottedOneDay(
    {
      networks: [setting.network ?? new Float32Array(5), new Float32Array(5)],
      services: [spy, setting.host ?? serviceFor(2)],
      unrest: setting.unrest ?? [],
    },
    {
      ...SCENE,
      diplomacy: setting.diplomacy ?? PEACE,
      owners: setting.owners ?? LINE_OWNERS,
      random: setting.random ?? NEVER,
    },
    [setting.advancement ?? START_ADVANCEMENT, START_ADVANCEMENT]
  );

/** Nation 0's service at the end of the day. */
const spyAfter = (plotted: Plotted): Service =>
  itemAt(plotted.intrigue.services, 0, NO_SERVICE);

/** Nation 0's service after a day, as its captured operatives and those it still has. */
const headcountAfter = (spy: Service, setting: Setting = {}) => {
  const { captured, operatives } = spyAfter(dayOf(spy, setting));
  return { captured, operatives };
};

/** Nation 0's operatives and the days its empty slot has waited after a day. */
const recruitingAfter = (spy: Service) => {
  const { operatives, waited } = spyAfter(dayOf(spy));
  return { operatives, waited };
};

/** A founded service of `operatives` at work in nation 1 with the network in its capital at 40. */
const inCapital = (patch: Partial<Service>): Plotted =>
  dayOf(service({ agency: FOUNDED, target: 1, ...patch }), {
    network: CAPITAL_NETWORK,
  });

/** A service with `operation` finishing today and the operatives it takes. */
const finishing = (operation: Operation, agency: Agency): Service =>
  service({
    agency,
    missions: [mission(operation, 1)],
    operatives: operationTermsOf(operation).operatives,
  });

const ANNEXED_BY_ONE = {
  by: 1,
  kind: "annexed",
} satisfies Diplomacy["standings"][number];

const ALL_INFILTRATED = Uint8Array.from([0, 0, 0, 0, 1, 1, 1, 1]);

describe(serviceFor, () => {
  it("should open every nation's service with nothing when the world begins", () => {
    expect(openingServices(2)).toStrictEqual([serviceFor(2), serviceFor(2)]);
  });
});

describe(freeOperatives, () => {
  it("should leave out the operatives on missions when counting the free ones", () => {
    expect(
      freeOperatives(
        service({ missions: [mission("rescue-operative", 5)], operatives: 3 })
      )
    ).toBe(2);
  });
});

/** Nobody in the line having finished any focus. */
const UNFOCUSED = [START_ADVANCEMENT, START_ADVANCEMENT];

describe(slotsOf, () => {
  const LINE = { ...SCENE, advancements: UNFOCUSED };

  it("should give no slots when the agency is not founded", () => {
    expect(slotsOf(0, NO_AGENCY, LINE)).toBe(0);
  });

  it("should give one slot when the agency is founded and belongs to no faction", () => {
    expect(slotsOf(0, FOUNDED, LINE)).toBe(1);
  });

  it("should give a second slot when the agency has bought five upgrades", () => {
    expect(slotsOf(0, FIVE_UPGRADES, LINE)).toBe(2);
  });

  it("should give another slot when the nation has finished the intelligence bureau", () => {
    const bureau: Advancement = {
      ...START_ADVANCEMENT,
      focuses: { current: Option.none(), done: ["intelligence-bureau"] },
    };

    expect(
      slotsOf(0, FOUNDED, {
        ...LINE,
        advancements: [bureau, START_ADVANCEMENT],
      })
    ).toBe(2);
  });

  const FACTION = {
    advancements: [0, 1, 2, 3].map(() => START_ADVANCEMENT),
    diplomacy: {
      ...openingDiplomacy(Int32Array.from([0, 1, 2, 3]), 4, [0]),
      factions: Int32Array.from([0, 0, 0, -1]),
    },
    economies: [0, 1, 2, 3].map(() => ({
      ...NO_ECONOMY,
      civilianFactories: 60,
    })),
  };

  const SPYMASTER = agencyWith([
    "civilian-department",
    "army-department",
    "navy-department",
  ]);

  it("should add half a slot for each large member when the founder's agency has three upgrades", () => {
    expect(slotsOf(0, SPYMASTER, FACTION)).toBe(2);
  });

  it("should add nothing for the members when the founder's agency has fewer than three upgrades", () => {
    expect(slotsOf(0, FOUNDED, FACTION)).toBe(1);
  });

  it("should add nothing for the members when the nation only belongs to the faction", () => {
    expect(slotsOf(1, SPYMASTER, FACTION)).toBe(1);
  });
});

describe(counterIntelligenceOf, () => {
  it("should add a point and then half as much again when two free operatives stay at home", () => {
    expect(counterIntelligenceOf(service({ operatives: 2 }))).toBe(1.5);
  });

  it("should add nothing for the operatives when they work in another nation", () => {
    expect(counterIntelligenceOf(service({ operatives: 2, target: 1 }))).toBe(
      0
    );
  });

  it("should add the agency's points when it has bought passive defense", () => {
    expect(
      counterIntelligenceOf(
        service({ agency: agencyWith(["passive-defense"]) })
      )
    ).toBe(1.5);
  });
});

describe(centerIn, () => {
  it("should pick the target's land where the network is strongest when the target also holds a sea zone", () => {
    expect(
      centerIn(
        { ...SCENE, owners: Int32Array.from([0, 0, 1, 1, 1]) },
        networkOf([0, 0, 5, 2, 9]),
        0,
        1
      )
    ).toBe(2);
  });

  it("should pick the target's capital when the network is as strong everywhere", () => {
    expect(centerIn(SCENE, new Float32Array(5), 0, 1)).toBe(3);
  });

  it("should pick the target's capital when the target holds no land", () => {
    expect(
      centerIn(
        { ...SCENE, owners: Int32Array.from([0, 0, 0, 0, -1]) },
        new Float32Array(5),
        0,
        1
      )
    ).toBe(3);
  });

  it("should pick among the ground the target occupies when the two are at war", () => {
    expect(
      centerIn(
        { ...SCENE, diplomacy: WAR, owners: OCCUPYING_OWNERS },
        networkOf([0, 0, 0, 9, 0]),
        0,
        1
      )
    ).toBe(1);
  });

  it("should pick among all the target's land when the two are at war and it occupies nothing", () => {
    expect(
      centerIn({ ...SCENE, diplomacy: WAR }, networkOf([0, 0, 9, 0, 0]), 0, 1)
    ).toBe(2);
  });

  it("should pick among all the target's land when it occupies ground at peace", () => {
    expect(
      centerIn(
        { ...SCENE, owners: OCCUPYING_OWNERS },
        networkOf([0, 0, 0, 9, 0]),
        0,
        1
      )
    ).toBe(3);
  });
});

describe(heldCaptives, () => {
  it("should count each nation's operatives by the captor holding them when some are caught", () => {
    expect(
      heldCaptives([service({ captured: [1, 1] }), service({ captured: [0] })])
    ).toStrictEqual(Uint8Array.from([0, 1, 2, 0]));
  });
});

describe(plottedOneDay, () => {
  it("should leave a service as it was when its nation has been annexed", () => {
    const spy = service({ agency: FOUNDED, operatives: 2, target: 1 });

    const plotted = dayOf(spy, {
      diplomacy: { ...PEACE, standings: [ANNEXED_BY_ONE, INDEPENDENT] },
    });

    expect(spyAfter(plotted)).toBe(spy);
  });

  it("should call the operatives home when the service targets its own nation", () => {
    expect(spyAfter(dayOf(service({ target: 0 }))).target).toBe(HOME);
  });

  it("should call the operatives home when the target has been annexed", () => {
    const plotted = dayOf(service({ target: 1 }), {
      diplomacy: { ...PEACE, standings: [INDEPENDENT, ANNEXED_BY_ONE] },
    });

    expect(spyAfter(plotted).target).toBe(HOME);
  });

  it("should call the operatives home when the target holds no land", () => {
    const plotted = dayOf(service({ target: 1 }), {
      owners: Int32Array.from([0, 0, 0, 0, -1]),
    });

    expect(spyAfter(plotted).target).toBe(HOME);
  });

  it("should start a different operation the next day when one is already under way in the target", () => {
    const first = dayOf(
      service({ agency: FOUNDED, operatives: 4, target: 1 }),
      {
        network: networkOf([0, 0, 0, 100, 0]),
      }
    );

    const second = plottedOneDay(first.intrigue, SCENE, first.advancements);

    expect(
      spyAfter(second).missions.map((started) => started.operation)
    ).toStrictEqual(["infiltrate-civilian", "infiltrate-army"]);
  });

  it("should bring a mission a day nearer done when it has days left", () => {
    const spy = service({
      agency: FOUNDED,
      missions: [mission("infiltrate-army", 5)],
      operatives: 2,
    });

    expect(spyAfter(dayOf(spy)).missions).toStrictEqual([
      mission("infiltrate-army", 4),
    ]);
  });

  it("should open the kind in the target when an infiltration is done", () => {
    const plotted = dayOf(finishing("infiltrate-army", FOUNDED));

    expect(spyAfter(plotted).infiltrated).toStrictEqual(
      Uint8Array.from([0, 0, 0, 0, 0, 1, 0, 0])
    );
  });

  it("should lose the mission's operatives to the target when the draws catch them as it ends", () => {
    expect(
      headcountAfter(finishing("infiltrate-army", FOUNDED), { random: ALWAYS })
    ).toStrictEqual({ captured: [1, 1], operatives: 0 });
  });

  it("should record the operation and how many were caught when a mission ends", () => {
    const plotted = dayOf(finishing("infiltrate-army", FOUNDED), {
      random: ALWAYS,
    });

    expect(plotted.events).toStrictEqual([
      {
        captured: 2,
        kind: "operation",
        nation: 0,
        operation: "infiltrate-army",
        target: 1,
      },
    ]);
  });

  it("should set contacts running against the target when that operation is done", () => {
    const plotted = dayOf(finishing("resistance-contacts", FOUNDED));

    expect(plotted.intrigue.unrest).toStrictEqual([
      { daysLeft: 60, kind: "contacts", occupier: 1, share: 0.1, spy: 0 },
    ]);
  });

  it("should start sabotage the same day when contacts just done in an infiltrated target leave three operatives free", () => {
    const plotted = dayOf(
      {
        ...finishing("resistance-contacts", FOUNDED),
        infiltrated: Uint8Array.from([0, 0, 0, 0, 1, 1, 1, 1]),
        operatives: 3,
        target: 1,
      },
      {
        diplomacy: WAR,
        network: networkOf([0, 100, 0, 0, 0]),
        owners: OCCUPYING_OWNERS,
      }
    );

    expect(
      spyAfter(plotted).missions.map((started) => started.operation)
    ).toStrictEqual(["sabotage-industry"]);
  });

  it("should raise the sabotage by the agency's explosives when sabotage is done", () => {
    const plotted = dayOf(
      finishing("sabotage-industry", agencyWith(["plastic-explosives"]))
    );

    expect(plotted.intrigue.unrest).toStrictEqual([
      { daysLeft: 90, kind: "sabotage", occupier: 1, share: 0.625, spy: 0 },
    ]);
  });

  it("should set strengthening running after the work already running when that operation is done", () => {
    const running: Unrest = {
      daysLeft: 5,
      kind: "contacts",
      occupier: 1,
      share: 0.1,
      spy: 0,
    };

    const plotted = dayOf(finishing("strengthen-resistance", FOUNDED), {
      unrest: [running],
    });

    expect(plotted.intrigue.unrest).toStrictEqual([
      { ...running, daysLeft: 4 },
      { daysLeft: 60, kind: "strengthened", occupier: 1, share: 0.1, spy: 0 },
    ]);
  });

  it("should grant a voucher for the army's equipment when military blueprints are stolen", () => {
    const plotted = dayOf(finishing("steal-military-blueprints", FOUNDED));

    expect(
      itemAt(plotted.advancements, 0, START_ADVANCEMENT).research.vouchers
    ).toStrictEqual([
      { branches: ["infantry", "artillery", "logistics"], share: 3 },
    ]);
  });

  it("should raise the voucher for industry by the agency's blueprint stealing when industrial blueprints are stolen", () => {
    const plotted = dayOf(
      finishing(
        "steal-industrial-blueprints",
        agencyWith(["blueprint-stealing"])
      )
    );

    expect(
      itemAt(plotted.advancements, 0, START_ADVANCEMENT).research.vouchers
    ).toStrictEqual([{ branches: ["industry", "construction"], share: 3.75 }]);
  });

  it("should put three tenths of the target's strength into its cipher when a cipher is captured", () => {
    const plotted = dayOf(finishing("capture-cipher", FOUNDED));

    expect(valueAt(spyAfter(plotted).ciphers.progress, 1)).toBeCloseTo(3600);
  });

  it("should send the rescued operatives home when the slots have no room for them", () => {
    const spy = service({
      agency: FOUNDED,
      captured: [1, 1],
      missions: [mission("rescue-operative", 1)],
      operatives: 1,
    });

    expect(headcountAfter(spy)).toStrictEqual({ captured: [], operatives: 1 });
  });

  it("should bring back as many rescued operatives as the slots have room for when a rescue is done", () => {
    const spy = service({
      agency: FIVE_UPGRADES,
      captured: [1, 1],
      missions: [mission("rescue-operative", 1)],
      operatives: 1,
    });

    expect(headcountAfter(spy)).toStrictEqual({ captured: [], operatives: 2 });
  });

  it("should record each free operative the host catches when its counter-intelligence and the draws catch them", () => {
    const plotted = dayOf(
      service({ agency: FOUNDED, operatives: 2, target: 1 }),
      { host: service({ operatives: 2 }), random: ALWAYS }
    );

    expect(plotted.events).toStrictEqual([
      { kind: "captured", nation: 1, spy: 0 },
      { kind: "captured", nation: 1, spy: 0 },
    ]);
  });

  it("should build no network when every operative in the target is caught", () => {
    const plotted = dayOf(
      service({ agency: FOUNDED, operatives: 2, target: 1 }),
      { host: service({ operatives: 2 }), random: ALWAYS }
    );

    expect(plotted.intrigue.networks[0]).toStrictEqual(new Float32Array(5));
  });

  it("should build the network out from the target's capital when the free operatives start nothing", () => {
    const plotted = dayOf(
      service({ agency: FOUNDED, operatives: 2, target: 1 })
    );

    expect(plotted.intrigue.networks[0]).toStrictEqual(
      networkOf([0, 0, 0.4, 0.8, 0])
    );
  });

  it("should start an infiltration of the economy from the strongest province when the network there carries one", () => {
    expect(spyAfter(inCapital({ operatives: 2 })).missions).toStrictEqual([
      mission("infiltrate-civilian", 90),
    ]);
  });

  it("should start a rescue when the target holds an operative and a slot has room", () => {
    const plotted = inCapital({
      agency: FIVE_UPGRADES,
      captured: [1],
      operatives: 1,
    });

    expect(spyAfter(plotted).missions).toStrictEqual([
      mission("rescue-operative", 35),
    ]);
  });

  it("should start capturing the cipher when every kind is infiltrated and the codebreakers have computing", () => {
    const spy = service({
      agency: CODEBREAKERS,
      infiltrated: ALL_INFILTRATED,
      operatives: 2,
      target: 1,
    });

    const plotted = dayOf(spy, {
      advancement: {
        ...START_ADVANCEMENT,
        research: { ...START_RESEARCH, researched: ["computing-1"] },
      },
      network: CAPITAL_NETWORK,
    });

    expect(spyAfter(plotted).missions).toStrictEqual([
      mission("capture-cipher", 75),
    ]);
  });

  it("should steal industrial blueprints rather than capture the cipher when the codebreakers lack computing", () => {
    const plotted = inCapital({
      agency: CODEBREAKERS,
      infiltrated: ALL_INFILTRATED,
      operatives: 3,
    });

    expect(spyAfter(plotted).missions).toStrictEqual([
      mission("steal-industrial-blueprints", 120),
    ]);
  });

  it("should steal no industrial blueprints when a bonus for industry is still waiting unused", () => {
    const plotted = dayOf(
      service({
        agency: CODEBREAKERS,
        infiltrated: ALL_INFILTRATED,
        operatives: 3,
        target: 1,
      }),
      {
        advancement: {
          ...START_ADVANCEMENT,
          research: {
            ...START_RESEARCH,
            vouchers: [{ branches: ["industry", "construction"], share: 3 }],
          },
        },
        network: CAPITAL_NETWORK,
      }
    );

    expect(spyAfter(plotted).missions).toStrictEqual([]);
  });

  it("should steal no second industrial blueprint when one is already under way against another nation", () => {
    const plotted = dayOf(
      service({
        agency: CODEBREAKERS,
        infiltrated: ALL_INFILTRATED,
        missions: [
          { ...mission("steal-industrial-blueprints", 60), target: 0 },
        ],
        operatives: 6,
        target: 1,
      }),
      { network: CAPITAL_NETWORK }
    );

    expect(
      spyAfter(plotted).missions.map((started) => started.operation)
    ).toStrictEqual(["steal-industrial-blueprints"]);
  });

  it("should grant no second bonus when a blueprint lands while a bonus for industry already waits unused", () => {
    const exhausted: Advancement = {
      ...START_ADVANCEMENT,
      research: {
        ...START_RESEARCH,
        vouchers: [{ branches: ["industry"], share: 1 }],
      },
    };

    const plotted = dayOf(finishing("steal-industrial-blueprints", FOUNDED), {
      advancement: exhausted,
    });

    expect(itemAt(plotted.advancements, 0, START_ADVANCEMENT)).toStrictEqual(
      exhausted
    );
  });

  it("should recruit an operative into the empty slot when it has waited thirty days", () => {
    expect(
      recruitingAfter(service({ agency: FOUNDED, waited: 29 }))
    ).toStrictEqual({ operatives: 1, waited: 0 });
  });

  it("should count one more day of waiting when the empty slot has waited less than thirty", () => {
    expect(
      recruitingAfter(service({ agency: FOUNDED, waited: 3 }))
    ).toStrictEqual({ operatives: 0, waited: 4 });
  });

  it("should stop the wait when every slot is filled", () => {
    expect(
      recruitingAfter(service({ agency: FOUNDED, operatives: 1, waited: 7 }))
    ).toStrictEqual({ operatives: 1, waited: 0 });
  });

  it("should record the target's cipher broken when the codebreakers finish it at peace", () => {
    const plotted = dayOf(
      service({
        agency: CODEBREAKERS,
        ciphers: { ...noCiphers(2), progress: Float64Array.from([0, 11_990]) },
        target: 1,
      })
    );

    expect(plotted.events).toStrictEqual([
      { kind: "cipher", nation: 0, target: 1 },
    ]);
  });

  it("should record an enemy's cipher broken when the operatives stay at home at war", () => {
    const plotted = dayOf(
      service({
        agency: CODEBREAKERS,
        ciphers: { ...noCiphers(2), progress: Float64Array.from([0, 11_990]) },
      }),
      { diplomacy: WAR }
    );

    expect(plotted.events).toStrictEqual([
      { kind: "cipher", nation: 0, target: 1 },
    ]);
  });
});
