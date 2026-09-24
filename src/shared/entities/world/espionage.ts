import { Option } from "effect";
import type { Agency } from "./agency";
import { agencyModifiersOf, agencyWorkedOneDay, NO_AGENCY } from "./agency";
import type { Decision } from "./chronicle";
import type { Ciphers } from "./cipher";
import {
  cipherCaptured,
  cipherStrengthOf,
  decryptedOneDay,
  decrypts,
  noCiphers,
} from "./cipher";
import { countedDown } from "./countdown";
import type { Diplomacy } from "./diplomacy";
import { factionOf, standsAlone } from "./diplomacy";
import type { Compliance } from "./economy/compliance";
import type { NationEconomy } from "./economy/economy";
import type { Build, Networks } from "./geography/networks";
import { networkBuiltOneDay } from "./geography/networks";
import { valueAt } from "./grid";
import type { IntelKind } from "./intel";
import { INTEL_KINDS } from "./intel";
import { itemAt } from "./lookup";
import { isCoastal } from "./navy/seas";
import type { Operation, Prospect } from "./operations";
import {
  BLUEPRINT_CATEGORIES,
  BLUEPRINT_THEFTS,
  operationTermsOf,
  operationWanted,
} from "./operations";
import type { ProvinceGraph } from "./provinces";
import { isLand } from "./provinces";
import type { Random } from "./random";
import type { Advancement } from "./research/advancement";
import { START_ADVANCEMENT } from "./research/advancement";
import { operativeSlotsOf } from "./research/focus";
import type { Research, Voucher } from "./research/research";
import { bonusUsable, vouchersGranted } from "./research/research";
import type { TechCategory } from "./techs";
import type { Unrest, UnrestKind } from "./unrest";
import { unrestAgainst, unrestOneDay, unrestStarted } from "./unrest";
import { atWar, enemiesOf } from "./wars";

/** The target of a nation that keeps its operatives at home on counter-intelligence. */
export const HOME = -1;

/** An operation under way, and the operatives it ties up until it is done. */
export interface Assignment {
  readonly operation: Operation;
  readonly target: number;
  /** The province it runs in. */
  readonly location: number;
  readonly daysLeft: number;
  readonly operatives: number;
}

/** One nation's intelligence service: its agency, its operatives, and what they are working on. */
export interface Service {
  readonly agency: Agency;
  /** The nation its operatives work in, or `HOME`. */
  readonly target: number;
  /** The operatives it has, the ones on a mission included. */
  readonly operatives: number;
  readonly missions: readonly Assignment[];
  /** The nation holding each of its operatives that was caught, one entry for each. */
  readonly captured: readonly number[];
  /** The days an empty operative slot has waited. */
  readonly waited: number;
  readonly ciphers: Ciphers;
  /** 1 where it has infiltrated that kind in the target, by `target * 4` and kind. */
  readonly infiltrated: Uint8Array;
}

/** A service with nothing yet, for a world of `nations`. */
export const serviceFor = (nations: number): Service => ({
  agency: NO_AGENCY,
  captured: [],
  ciphers: noCiphers(nations),
  infiltrated: new Uint8Array(nations * INTEL_KINDS.length),
  missions: [],
  operatives: 0,
  target: HOME,
  waited: 0,
});

/** The service of a nation the list does not reach, which does nothing. */
export const NO_SERVICE = serviceFor(0);

/** Every nation's service on the world's first day. */
export const openingServices = (nations: number): readonly Service[] =>
  Array.from({ length: nations }, () => serviceFor(nations));

/** The operatives a service has free of missions. */
export const freeOperatives = (service: Service): number =>
  service.operatives -
  service.missions.reduce((total, mission) => total + mission.operatives, 0);

/**
 * The operative slots a new agency opens with, the upgrades that open one
 * more, the upgrades a spymaster needs, and what each faction member adds to
 * a spymaster's slots by the factories it holds, after Hearts of Iron IV.
 * Making the faction's founder its spymaster, at no cost in the political
 * power this world does not have, is this game's own.
 */
const BASE_SLOTS = 1;
const UPGRADES_FOR_SLOT = 5;
const UPGRADES_FOR_SPYMASTER = 3;
const SMALL_MEMBER = { factories: 10, slots: 0.25 };
const LARGE_MEMBER = { factories: 50, slots: 0.5 };

/** Who stands with whom, and what each nation's industry comes to, which a spymaster's slots are counted from. */
interface Membership {
  readonly diplomacy: Diplomacy;
  readonly economies: readonly NationEconomy[];
  /** Each nation's research and focus tree, by nation id, whose finished focuses may add slots. */
  readonly advancements: readonly Advancement[];
}

/** The slots the other members of the faction `nation` founded give it as spymaster. */
const spymasterSlots = (nation: number, standing: Membership): number => {
  let slots = 0;
  for (const [member, economy] of standing.economies.entries()) {
    if (member === nation || factionOf(standing.diplomacy, member) !== nation) {
      continue;
    }
    const factories =
      economy.civilianFactories + economy.militaryFactories + economy.dockyards;
    slots +=
      SMALL_MEMBER.slots * Number(factories >= SMALL_MEMBER.factories) +
      (LARGE_MEMBER.slots - SMALL_MEMBER.slots) *
        Number(factories >= LARGE_MEMBER.factories);
  }
  return slots;
};

/** The operative slots `nation`'s agency has, none before it is founded. */
export const slotsOf = (
  nation: number,
  agency: Agency,
  standing: Membership
): number => {
  if (agency.standing === "none") {
    return 0;
  }
  const spymaster =
    factionOf(standing.diplomacy, nation) === nation &&
    agency.upgrades.length >= UPGRADES_FOR_SPYMASTER;
  return Math.floor(
    BASE_SLOTS +
      Number(agency.upgrades.length >= UPGRADES_FOR_SLOT) +
      operativeSlotsOf(
        itemAt(standing.advancements, nation, START_ADVANCEMENT).focuses
      ) +
      spymasterSlots(nation, standing) * Number(spymaster)
  );
};

/**
 * The days an empty slot waits before an operative is recruited into it,
 * after Hearts of Iron IV.
 */
const RECRUIT_DAYS = 30;

/** The service with a day of recruiting behind it. */
const recruited = (service: Service, slots: number): Service => {
  if (service.operatives >= slots) {
    return { ...service, waited: 0 };
  }
  if (service.waited + 1 >= RECRUIT_DAYS) {
    return { ...service, operatives: service.operatives + 1, waited: 0 };
  }
  return { ...service, waited: service.waited + 1 };
};

/**
 * The counter-intelligence each operative kept at home adds, the first one
 * whole and every one after it half the one before, after Hearts of Iron IV's
 * 0.5 stacking. The wiki does not say what one operative adds, so the one
 * point is this game's own.
 */
const COUNTER_INTELLIGENCE_PER_OPERATIVE = 1;
const STACKING = 0.5;

/** The counter-intelligence `service` fields at home. */
export const counterIntelligenceOf = (service: Service): number => {
  const home = freeOperatives(service) * Number(service.target === HOME);
  return (
    agencyModifiersOf(service.agency).counterIntelligence +
    (COUNTER_INTELLIGENCE_PER_OPERATIVE * (1 - STACKING ** home)) /
      (1 - STACKING)
  );
};

/**
 * The chance a day that one operative building a network is caught for each
 * point of its host's counter-intelligence. The wiki gives the risk an
 * operation ends on and no daily chance of capture, so this is this game's
 * own.
 */
const CAPTURE_PER_POINT = 0.0001;

/**
 * What a stolen blueprint gives, after Hearts of Iron IV: two research
 * bonuses of 300%, the second of them also an ahead-of-time bonus of two
 * years one time in three and of one year otherwise.
 */
const BLUEPRINT_BONUS = 3;
const BLUEPRINT_VOUCHERS = 2;
const TWO_YEARS_AHEAD_CHANCE = 1 / 3;

/** The share of the target's cipher strength a captured cipher gives, after Hearts of Iron IV's 30%. */
const CAPTURED_CIPHER = 0.3;

/** Everything one day of the world's intelligence work reads. */
export interface Scene {
  readonly graph: ProvinceGraph;
  /** Who holds each province, by province id. */
  readonly owners: Int32Array;
  readonly compliance: Compliance;
  readonly diplomacy: Diplomacy;
  readonly economies: readonly NationEconomy[];
  /** Each nation's capital, by nation id. */
  readonly capitals: readonly number[];
  /** Days since the start date. */
  readonly day: number;
  readonly random: Random;
}

/** The world's intelligence work: every service, network, and piece of resistance work. */
export interface Intrigue {
  readonly services: readonly Service[];
  readonly networks: Networks;
  readonly unrest: readonly Unrest[];
}

/**
 * The province a nation's operatives work from in `target`: among the
 * target's land, or, while the two are at war and the target occupies
 * ground, among that occupied ground, the one where the nation's network is
 * strongest, the target's capital first and then the lowest province where
 * two tie, and the target's capital where it holds no land at all. This
 * game's own, since the wiki leaves the choice to the player.
 */
export const centerIn = (
  scene: Scene,
  network: Float32Array,
  spy: number,
  target: number
): number => {
  const held: number[] = [];
  const occupied: number[] = [];
  for (const [province, holder] of scene.owners.entries()) {
    if (holder !== target || !isLand(scene.graph, province)) {
      continue;
    }
    held.push(province);
    if (valueAt(scene.compliance.natives, province) !== target) {
      occupied.push(province);
    }
  }
  const onFront =
    atWar(scene.diplomacy.wars, spy, target) && occupied.length > 0;
  const candidates = itemAt([held, occupied], Number(onFront), held);
  const capital = itemAt(scene.capitals, target, HOME);
  let best = itemAt(candidates, 0, capital);
  for (const province of candidates) {
    const strength = valueAt(network, province);
    const bestStrength = valueAt(network, best);
    if (
      strength > bestStrength ||
      (strength === bestStrength && province === capital)
    ) {
      best = province;
    }
  }
  return best;
};

/** The network of a nation the list does not reach, which is strong nowhere. */
const NO_NETWORK = new Float32Array(0);

/** What a service reads about the nation its operatives work in. */
interface Host {
  readonly nation: number;
  readonly agency: Agency;
  readonly counterIntelligence: number;
}

/** How many of `count` operatives, each caught with `chance`, the draws catch. */
const caughtOf = (count: number, chance: number, random: Random): number => {
  let caught = 0;
  for (let operative = 0; operative < count; operative += 1) {
    caught += Number(random.unit() < chance);
  }
  return caught;
};

/** The chance an operative is caught by `host` at the end of an operation carrying `risk`. */
const catchChance = (host: Host, risk: number): number =>
  risk * (1 + agencyModifiersOf(host.agency).capture);

/** The chance an operative building a network is caught by `host` in a day. */
const dailyCatchChance = (host: Host): number =>
  CAPTURE_PER_POINT *
  host.counterIntelligence *
  (1 + agencyModifiersOf(host.agency).capture);

/** The service with `count` of its operatives caught by `host`. */
const caughtBy = (service: Service, host: number, count: number): Service => ({
  ...service,
  captured: [...service.captured, ...Array.from({ length: count }, () => host)],
  operatives: service.operatives - count,
});

/** One nation's day of intelligence work, and what it did beyond its service. */
interface Served {
  readonly service: Service;
  readonly advancement: Advancement;
  readonly started: readonly Unrest[];
  readonly events: readonly Decision[];
  readonly build: readonly Build[];
}

/** What a nation's day of intelligence work reads beyond its own service. */
interface Surroundings {
  readonly scene: Scene;
  readonly intrigue: Intrigue;
  /** The counter-intelligence each nation fields at home, by nation id. */
  readonly counterIntelligence: readonly number[];
  /** The operative slots each nation's agency has, by nation id. */
  readonly slots: readonly number[];
  /** The decryption it takes to break each nation's cipher, by nation id. */
  readonly strengths: readonly number[];
  /** 1 where the nation holds a coastal province, by nation id. */
  readonly coastal: Uint8Array;
  /** 1 where the nation holds ground that is not its own, by nation id. */
  readonly occupying: Uint8Array;
  /** 1 where the nation holds any land at all, by nation id. */
  readonly landed: Uint8Array;
  readonly researched: ReadonlySet<string>;
}

/** The host `target` is to a nation's operatives. */
const hostOf = (surroundings: Surroundings, target: number): Host => ({
  agency: itemAt(surroundings.intrigue.services, target, NO_SERVICE).agency,
  counterIntelligence: itemAt(surroundings.counterIntelligence, target, 0),
  nation: target,
});

/** Which nations hold land, a coast, and ground not their own, by nation id. */
const holdingsOf = (
  scene: Scene,
  nations: number
): Pick<Surroundings, "coastal" | "occupying" | "landed"> => {
  const coastal = new Uint8Array(nations);
  const occupying = new Uint8Array(nations);
  const landed = new Uint8Array(nations);
  for (const [province, holder] of scene.owners.entries()) {
    if (holder < 0) {
      continue;
    }
    landed[holder] = Math.max(
      valueAt(landed, holder),
      Number(isLand(scene.graph, province))
    );
    coastal[holder] = Math.max(
      valueAt(coastal, holder),
      Number(isCoastal(scene.graph, province))
    );
    occupying[holder] = Math.max(
      valueAt(occupying, holder),
      Number(valueAt(scene.compliance.natives, province) !== holder)
    );
  }
  return { coastal, landed, occupying };
};

/** No operation, where a mission runs in some other nation. */
const NO_OPERATIONS: readonly Operation[] = [];

/** A nation's service and the nation it has its operatives in. */
interface Posting {
  readonly spy: number;
  readonly service: Service;
  readonly target: number;
  /** The resistance work its missions done today set running, which the day's state does not hold yet. */
  readonly started: readonly Unrest[];
  /** The nation's research as today's missions left it. */
  readonly research: Research;
}

/** What `spy`'s operatives find in `target`. */
const prospectOf = (
  { research, service, spy, started, target }: Posting,
  surroundings: Surroundings
): Prospect => {
  const { intrigue, scene } = surroundings;
  return {
    atWar: enemiesOf(scene.diplomacy.wars, spy).length > 0,
    captives: service.captured.filter((captor) => captor === target).length,
    cipherBroken:
      valueAt(service.ciphers.progress, target) >=
      itemAt(surroundings.strengths, target, Number.POSITIVE_INFINITY),
    coastal: valueAt(surroundings.coastal, target) === 1,
    codebreakers:
      decrypts(service.agency) &&
      surroundings.researched.has("mechanical-computing"),
    infiltrated: new Set(
      INTEL_KINDS.filter(
        (_, slot) =>
          valueAt(service.infiltrated, target * INTEL_KINDS.length + slot) === 1
      )
    ),
    occupies: valueAt(surroundings.occupying, target) === 1,
    room: service.operatives < itemAt(surroundings.slots, spy, 0),
    underway: new Set(
      service.missions.flatMap((mission) =>
        itemAt(
          [NO_OPERATIONS, [mission.operation]],
          Number(mission.target === target),
          NO_OPERATIONS
        )
      )
    ),
    unrest: unrestAgainst([...intrigue.unrest, ...started], spy, target),
    usableBlueprints: new Set(
      BLUEPRINT_THEFTS.filter(
        (theft) =>
          !service.missions.some((mission) => mission.operation === theft) &&
          bonusUsable(research, BLUEPRINT_CATEGORIES[theft], BLUEPRINT_VOUCHERS)
      )
    ),
  };
};

/** What an operation changes once it is done: the spy's service and research, and the resistance work it sets running. */
type Accomplished = Pick<Served, "service" | "advancement" | "started">;

/** What one operation does once it is done. */
type Effect = (
  spy: number,
  worked: Pick<Served, "service" | "advancement">,
  mission: Assignment,
  surroundings: Surroundings
) => Accomplished;

/** An infiltration, which opens `kind` in the target for good. */
const infiltration =
  (kind: IntelKind): Effect =>
  (_, worked, mission) => {
    const infiltrated = Uint8Array.from(worked.service.infiltrated);
    infiltrated[
      mission.target * INTEL_KINDS.length + INTEL_KINDS.indexOf(kind)
    ] = 1;
    return {
      ...worked,
      service: { ...worked.service, infiltrated },
      started: [],
    };
  };

/** Resistance work of `kind` set running against the target, as the spy's agency raises it. */
const resistanceWork =
  (kind: UnrestKind): Effect =>
  (spy, worked, mission) => ({
    ...worked,
    started: [
      unrestStarted(
        kind,
        { occupier: mission.target, spy },
        agencyModifiersOf(worked.service.agency).resistance
      ),
    ],
  });

/**
 * A stolen blueprint, whose two bonuses wait for the next technologies in
 * `categories`, or which comes to nothing where the nation's research has run
 * out of use for them while the theft was under way.
 */
const blueprint =
  (categories: readonly TechCategory[]): Effect =>
  (_, worked, _mission, surroundings) => {
    const { research } = worked.advancement;
    const share =
      BLUEPRINT_BONUS *
      (1 + agencyModifiersOf(worked.service.agency).blueprints);
    const vouchers: readonly Voucher[] = [
      { ahead: 0, categories, share },
      {
        ahead:
          1 + Number(surroundings.scene.random.unit() < TWO_YEARS_AHEAD_CHANCE),
        categories,
        share,
      },
    ];
    return {
      ...worked,
      advancement: {
        ...worked.advancement,
        research: itemAt(
          [research, vouchersGranted(research, vouchers)],
          Number(bonusUsable(research, categories, BLUEPRINT_VOUCHERS)),
          research
        ),
      },
      started: [],
    };
  };

/** A captured cipher, which puts a share of the target's strength into breaking it. */
const capturedCipher: Effect = (_, worked, mission, surroundings) => ({
  ...worked,
  service: {
    ...worked.service,
    ciphers: cipherCaptured(
      worked.service.ciphers,
      mission.target,
      hostOf(surroundings, mission.target).agency,
      CAPTURED_CIPHER
    ),
  },
  started: [],
});

/**
 * A rescue, which frees every operative the target holds: as many as the
 * spy's slots have room for come back to work, and the rest go home.
 */
const rescue: Effect = (spy, worked, mission, surroundings) => {
  const { service } = worked;
  const held = service.captured.filter(
    (captor) => captor === mission.target
  ).length;
  const room = Math.max(
    0,
    itemAt(surroundings.slots, spy, 0) - service.operatives
  );
  return {
    ...worked,
    service: {
      ...service,
      captured: service.captured.filter((captor) => captor !== mission.target),
      operatives: service.operatives + Math.min(held, room),
    },
    started: [],
  };
};

/**
 * What each operation does once it is done, after Hearts of Iron IV: an
 * infiltration opens 10% of its kind, contacts and strengthening raise the
 * resistance target, sabotage turns the resistance on the occupier's
 * factories, a blueprint gives two 300% bonuses to the next technologies in
 * its categories, a captured cipher gives 30% of its strength, and a rescue
 * frees the operatives caught there. The other bonus results the wiki lists
 * come at chances it does not give, so no other operation rolls for one.
 */
const EFFECTS = {
  "capture-cipher": capturedCipher,
  "infiltrate-air": infiltration("air"),
  "infiltrate-army": infiltration("army"),
  "infiltrate-civilian": infiltration("civilian"),
  "infiltrate-navy": infiltration("navy"),
  "rescue-operative": rescue,
  "resistance-contacts": resistanceWork("contacts"),
  "sabotage-industry": resistanceWork("sabotage"),
  "steal-aviation-blueprints": blueprint(
    BLUEPRINT_CATEGORIES["steal-aviation-blueprints"]
  ),
  "steal-industrial-blueprints": blueprint(
    BLUEPRINT_CATEGORIES["steal-industrial-blueprints"]
  ),
  "steal-military-blueprints": blueprint(
    BLUEPRINT_CATEGORIES["steal-military-blueprints"]
  ),
  "steal-naval-blueprints": blueprint(
    BLUEPRINT_CATEGORIES["steal-naval-blueprints"]
  ),
  "strengthen-resistance": resistanceWork("strengthened"),
} satisfies Readonly<Record<Operation, Effect>>;

/** The operations whose risk the agency's invisible ink lowers. */
const BLUEPRINT_OPERATIONS: ReadonlySet<Operation> = new Set(BLUEPRINT_THEFTS);

/** The risk `operation` ends on for a spy whose agency is `agency`. */
const riskOf = (operation: Operation, agency: Agency): number =>
  operationTermsOf(operation).risk *
  (1 +
    agencyModifiersOf(agency).blueprintRisk *
      Number(BLUEPRINT_OPERATIONS.has(operation)));

/**
 * The nation a service may work in today: its target while that is another
 * nation still standing with land to work in, and `HOME` otherwise.
 */
const workingIn = (
  spy: number,
  target: number,
  surroundings: Surroundings
): number => {
  if (
    target === spy ||
    !standsAlone(surroundings.scene.diplomacy, target) ||
    valueAt(surroundings.landed, target) === 0
  ) {
    return HOME;
  }
  return target;
};

/** The service with `operation` started against `target`, tying up the operatives it takes. */
const missionStarted = (
  service: Service,
  operation: Operation,
  where: Pick<Assignment, "location" | "target">
): Service => {
  const terms = operationTermsOf(operation);
  return {
    ...service,
    missions: [
      ...service.missions,
      {
        ...where,
        daysLeft: terms.days,
        operation,
        operatives: terms.operatives,
      },
    ],
  };
};

/** A service's missions split into the ones done today and the rest, a day nearer done. */
interface AssignmentsDue {
  readonly due: readonly Assignment[];
  readonly ongoing: readonly Assignment[];
}

/** The missions of `service` split into the ones done today and the ones a day nearer done. */
const missionsDue = (missions: readonly Assignment[]): AssignmentsDue => ({
  due: missions.filter((mission) => mission.daysLeft <= 1),
  ongoing: countedDown(missions),
});

/**
 * What a nation's operatives in `target` do today: each one free is caught
 * with the day's chance, the rules settle on the first operation the target
 * leaves open, the network can carry and all the nation's operatives
 * together could field, and start it once enough of them are free, starting
 * nothing while they wait for the rest to come back; and the operatives
 * still free build the network from where they work.
 */
const workedIn = (
  posting: Posting,
  surroundings: Surroundings
): Pick<Served, "service" | "events" | "build"> => {
  const { service, spy, target } = posting;
  const { scene } = surroundings;
  const host = hostOf(surroundings, target);
  const caught = caughtOf(
    freeOperatives(service),
    dailyCatchChance(host),
    scene.random
  );
  const events: Decision[] = Array.from({ length: caught }, () => ({
    kind: "captured",
    nation: target,
    spy,
  }));
  const left = caughtBy(service, target, caught);
  const network = itemAt(surroundings.intrigue.networks, spy, NO_NETWORK);
  const center = centerIn(scene, network, spy, target);
  const working = Option.match(
    operationWanted(
      prospectOf({ ...posting, service: left }, surroundings),
      { fielded: left.operatives, free: freeOperatives(left) },
      valueAt(network, center)
    ),
    {
      onNone: () => left,
      onSome: (operation) =>
        missionStarted(left, operation, { location: center, target }),
    }
  );
  const builders = freeOperatives(working);
  const build: Build[] = [];
  if (builders > 0) {
    build.push({
      center,
      counterIntelligence: host.counterIntelligence,
      host: target,
      operatives: builders,
    });
  }
  return { build, events, service: working };
};

/**
 * One nation's day of intelligence work: its agency a day further into what
 * it is founding or buying; every mission a day nearer done, and every one
 * done today doing what it came for and its operatives caught at its risk;
 * its operatives at work in their target; an empty slot a day nearer filled;
 * and its codebreakers a day further into the ciphers of its enemies, or of
 * its target at peace.
 */
const servedOneDay = (
  spy: number,
  advancement: Advancement,
  surroundings: Surroundings
): Served => {
  const { intrigue, scene } = surroundings;
  const before = itemAt(intrigue.services, spy, NO_SERVICE);
  const target = workingIn(spy, before.target, surroundings);
  const { due, ongoing } = missionsDue(before.missions);
  let worked: Pick<Served, "service" | "advancement"> = {
    advancement,
    service: {
      ...before,
      agency: agencyWorkedOneDay(before.agency),
      missions: ongoing,
      target,
    },
  };
  const events: Decision[] = [];
  const started: Unrest[] = [];
  for (const mission of due) {
    const done = EFFECTS[mission.operation](spy, worked, mission, surroundings);
    const caught = caughtOf(
      mission.operatives,
      catchChance(
        hostOf(surroundings, mission.target),
        riskOf(mission.operation, done.service.agency)
      ),
      scene.random
    );
    worked = {
      advancement: done.advancement,
      service: caughtBy(done.service, mission.target, caught),
    };
    started.push(...done.started);
    events.push({
      captured: caught,
      kind: "operation",
      nation: spy,
      operation: mission.operation,
      target: mission.target,
    });
  }
  let { service } = worked;
  const build: Build[] = [];
  if (target !== HOME) {
    const inTarget = workedIn(
      {
        research: worked.advancement.research,
        service,
        spy,
        started,
        target,
      },
      surroundings
    );
    ({ service } = inTarget);
    events.push(...inTarget.events);
    build.push(...inTarget.build);
  }
  service = recruited(service, itemAt(surroundings.slots, spy, 0));
  const enemies = enemiesOf(scene.diplomacy.wars, spy);
  const decrypted = decryptedOneDay(service.ciphers, {
    agency: service.agency,
    atWar: enemies.length > 0,
    enemies,
    strengths: surroundings.strengths,
    targets:
      [enemies, [target].filter((nation) => nation !== HOME)].find(
        (list) => list.length > 0
      ) ?? [],
  });
  for (const cracked of decrypted.cracked) {
    events.push({ kind: "cipher", nation: spy, target: cracked });
  }
  return {
    advancement: worked.advancement,
    build,
    events,
    service: { ...service, ciphers: decrypted.ciphers },
    started,
  };
};

/** The day of a nation the list does not reach, which builds nothing. */
const NO_SERVED: Served = {
  advancement: START_ADVANCEMENT,
  build: [],
  events: [],
  service: NO_SERVICE,
  started: [],
};

/** One day of the world's intelligence work, the research it gave, and what it did that the chronicle records. */
export interface Plotted {
  readonly intrigue: Intrigue;
  readonly advancements: readonly Advancement[];
  readonly events: readonly Decision[];
}

/**
 * One day of every standing nation's intelligence work, each reading the
 * services, the networks and the counter-intelligence as the day began, then
 * every network built or faded, and every piece of resistance work a day
 * nearer its end with the new ones added.
 */
export const plottedOneDay = (
  intrigue: Intrigue,
  scene: Scene,
  advancements: readonly Advancement[]
): Plotted => {
  const counterIntelligence = intrigue.services.map(counterIntelligenceOf);
  const slots = intrigue.services.map((service, nation) =>
    slotsOf(nation, service.agency, { ...scene, advancements })
  );
  const holdings = holdingsOf(scene, intrigue.services.length);
  const strengths = intrigue.services.map((service) =>
    cipherStrengthOf(service.agency)
  );
  const surroundingsFor = (spy: number): Surroundings => ({
    ...holdings,
    counterIntelligence,
    intrigue,
    researched: new Set(
      itemAt(advancements, spy, START_ADVANCEMENT).research.researched
    ),
    scene,
    slots,
    strengths,
  });
  const days = intrigue.services.map((service, spy): Served => {
    const advancement = itemAt(advancements, spy, START_ADVANCEMENT);
    if (!standsAlone(scene.diplomacy, spy)) {
      return { advancement, build: [], events: [], service, started: [] };
    }
    return servedOneDay(spy, advancement, surroundingsFor(spy));
  });
  return {
    advancements: days.map((day) => day.advancement),
    events: days.flatMap((day) => day.events),
    intrigue: {
      networks: intrigue.networks.map((network, spy) =>
        networkBuiltOneDay(
          network,
          itemAt(days, spy, NO_SERVED).build,
          scene.graph,
          scene.owners
        )
      ),
      services: days.map((day) => day.service),
      unrest: [
        ...unrestOneDay(intrigue.unrest),
        ...days.flatMap((day) => day.started),
      ],
    },
  };
};

/** How many of each nation's operatives each nation holds, by `captor * nations + spy`. */
export const heldCaptives = (services: readonly Service[]): Uint8Array => {
  const nations = services.length;
  const held = new Uint8Array(nations * nations);
  for (const [spy, service] of services.entries()) {
    for (const captor of service.captured) {
      const pair = captor * nations + spy;
      held[pair] = valueAt(held, pair) + 1;
    }
  }
  return held;
};
