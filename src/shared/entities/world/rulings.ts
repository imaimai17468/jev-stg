import { Option } from "effect";
import type { AirForce } from "./air/air-force";
import { airForceUnder, NO_AIR_FORCE } from "./air/air-force";
import { START_STANCE } from "./army/stance";
import type { Decision, Order, Ruling } from "./chronicle";
import { chronicled } from "./chronicle";
import type { Diplomacy } from "./diplomacy/diplomacy";
import {
  allied,
  answersToItself,
  factionOf,
  joined,
  justificationStarted,
  NO_FACTION,
  sideOf,
  standsAlone,
  warDeclared,
} from "./diplomacy/diplomacy";
import { mayStartJustifying, peaceSigned } from "./diplomacy/statecraft";
import { justifiedTarget } from "./diplomacy/war-goals";
import type { NationEconomy } from "./economy/economy";
import {
  NO_ECONOMY,
  withBuildSite,
  withConscription,
  withPlan,
  withRaising,
  withTradeLaw,
} from "./economy/economy";
import { neighbouringNations } from "./geography/nations";
import type { World } from "./geography/world";
import { valueAt } from "./grid";
import { agencyStarted } from "./intelligence/agency";
import type { Service } from "./intelligence/espionage";
import { HOME, NO_SERVICE } from "./intelligence/espionage";
import { itemAt, replacedAt } from "./lookup";
import { overseasRivals } from "./navy/maritime";
import type { Navy } from "./navy/navy";
import { NO_NAVY, withOrder } from "./navy/navy";
import type { Advancement } from "./research/advancement";
import { freeSlotsOf, START_ADVANCEMENT } from "./research/advancement";
import { availableFocuses, focusStarted } from "./research/focus";
import { availableTechs, studyStarted } from "./research/research";
import type { Simulation } from "./simulation";
import { fromRealm, realmOf } from "./simulation";
import { enemiesOf } from "./wars";

/** A decision that turns one nation on another. */
type Hostility = Extract<Order, { kind: "justify" | "declare" }>;

/**
 * Whether the nation that took `hostility` is ready for it today: at peace
 * with a justified war goal on the target for a declaration, and free to
 * start justifying for a justification.
 */
const readyFor = (simulation: Simulation, hostility: Hostility): boolean => {
  const { diplomacy } = simulation;
  if (hostility.kind === "justify") {
    return mayStartJustifying(
      diplomacy,
      itemAt(simulation.advancements, hostility.nation, START_ADVANCEMENT)
        .focuses,
      hostility.nation
    );
  }
  return (
    enemiesOf(diplomacy.wars, hostility.nation).length === 0 &&
    Option.contains(
      justifiedTarget(
        diplomacy.warGoals,
        hostility.nation,
        simulation.clock.days
      ),
      hostility.target
    )
  );
};

/**
 * Whether `hostility`, taken by a nation that answers to itself, still holds
 * today: its nation is ready for it, the target is outside its side, and its
 * land still touches the target's or its fleet can still carry a war across
 * the sea to it.
 */
const stillHolds = (
  world: World,
  simulation: Simulation,
  hostility: Hostility
): boolean => {
  const { nation, target } = hostility;
  const touching = neighbouringNations(world, simulation.owners).some(
    (pair) =>
      (pair.one === nation && pair.other === target) ||
      (pair.other === nation && pair.one === target)
  );
  const overseas = overseasRivals(world, simulation).some(
    (pair) => pair.one === nation && pair.other === target
  );
  return (
    readyFor(simulation, hostility) &&
    !allied(simulation.diplomacy, nation, target) &&
    (touching || overseas)
  );
};

/** The diplomacy once `hostility` has been carried out on the day `simulation` reads. */
const hostilityCarried = (
  simulation: Simulation,
  hostility: Hostility
): Diplomacy => {
  if (hostility.kind === "justify") {
    return justificationStarted(
      simulation.diplomacy,
      hostility,
      simulation.clock.days
    );
  }
  return warDeclared(simulation.diplomacy, hostility.nation, hostility.target);
};

/** Whether `nation`, which answers to itself, may still join `faction` today. */
const mayJoin = (
  simulation: Simulation,
  nation: number,
  faction: number
): boolean => {
  const { diplomacy } = simulation;
  const members = diplomacy.standings.flatMap((_, member) => {
    if (factionOf(diplomacy, member) !== faction) {
      return [];
    }
    return sideOf(diplomacy, member);
  });
  const enemies = new Set(enemiesOf(diplomacy.wars, nation));
  return (
    factionOf(diplomacy, nation) === NO_FACTION &&
    members.length > 0 &&
    !members.some((member) => enemies.has(member))
  );
};

/**
 * The advancement with the research or the focus started on it, or none where
 * no slot is free any more, or the technology or the focus is no longer on
 * offer because it was started or ruled out since.
 */
const advancementRuled = (
  advancement: Advancement,
  decision: Extract<Decision, { kind: "research" | "focus" }>
): Option.Option<Advancement> => {
  if (decision.kind === "research") {
    if (
      freeSlotsOf(advancement) === 0 ||
      !availableTechs(advancement.research).includes(decision.tech)
    ) {
      return Option.none();
    }
    return Option.some({
      ...advancement,
      research: studyStarted(advancement.research, decision.tech),
    });
  }
  if (!availableFocuses(advancement.focuses).includes(decision.focus)) {
    return Option.none();
  }
  return Option.some({
    ...advancement,
    focuses: focusStarted(advancement.focuses, decision.focus),
  });
};

/** `apply` carried out on what was `decided`, or none where `current` already is it. */
const changedTo = <T, V>(
  current: V,
  decided: V,
  apply: (value: V) => T
): Option.Option<T> => {
  if (current === decided) {
    return Option.none();
  }
  return Option.some(apply(decided));
};

/**
 * The economy under the law or the plan decided, building in the province
 * decided, or raising the kind of division decided, or none where it already
 * has it or no longer holds that province.
 */
const economyRuled = (
  simulation: Simulation,
  economy: NationEconomy,
  decision: Extract<
    Decision,
    {
      kind: "conscription" | "plan" | "trade" | "build-site" | "division-kind";
    }
  >
): Option.Option<NationEconomy> => {
  if (decision.kind === "division-kind") {
    return changedTo(economy.raising, decision.division, (raising) =>
      withRaising(economy, raising)
    );
  }
  if (decision.kind === "build-site") {
    if (valueAt(simulation.owners, decision.province) !== decision.nation) {
      return Option.none();
    }
    return changedTo(economy.buildSite, decision.province, (province) =>
      withBuildSite(economy, province)
    );
  }
  if (decision.kind === "conscription") {
    return changedTo(economy.conscription, decision.law, (law) =>
      withConscription(economy, law)
    );
  }
  if (decision.kind === "trade") {
    return changedTo(economy.tradeLaw, decision.law, (law) =>
      withTradeLaw(economy, law)
    );
  }
  return changedTo(economy.plan, decision.plan, (plan) =>
    withPlan(economy, plan)
  );
};

/** The navy with its dockyards on the order decided, or none where they already are. */
const navyRuled = (
  navy: Navy,
  decision: Extract<Decision, { kind: "shipbuilding" }>
): Option.Option<Navy> =>
  changedTo(navy.order, decision.order, (order) => withOrder(navy, order));

/**
 * The air force with its factories on the plane or at the weight decided, or
 * none where they already are.
 */
const airForceRuled = (
  airForce: AirForce,
  decision: Extract<Decision, { kind: "aircraft" | "aviation" }>
): Option.Option<AirForce> => {
  if (decision.kind === "aircraft") {
    return changedTo(airForce.order, decision.aircraft, (order) =>
      airForceUnder(airForce, { order })
    );
  }
  return changedTo(airForce.aviation, decision.aviation, (aviation) =>
    airForceUnder(airForce, { aviation })
  );
};

/**
 * The service with its agency set to work on the project decided, or its
 * operatives sent where it was decided, or none where the project is no longer
 * on offer, the target is the nation itself or one no longer standing, or
 * nothing changes.
 */
const serviceRuled = (
  simulation: Simulation,
  service: Service,
  decision: Extract<Decision, { kind: "agency" | "espionage" }>
): Option.Option<Service> => {
  if (decision.kind === "agency") {
    return Option.map(
      agencyStarted(
        service.agency,
        decision.project,
        itemAt(simulation.advancements, decision.nation, START_ADVANCEMENT)
          .research.researched
      ),
      (agency) => ({ ...service, agency })
    );
  }
  const { target } = decision;
  const reachable =
    target === HOME ||
    (target !== decision.nation && standsAlone(simulation.diplomacy, target));
  if (!reachable) {
    return Option.none();
  }
  return changedTo(service.target, target, (to) => ({
    ...service,
    target: to,
  }));
};

/**
 * The simulation with `ruled` in place of the nation's entry in `items`, put
 * back by `into`, or `simulation` itself where the ruling changed nothing.
 */
const replacedFor = <T>(
  simulation: Simulation,
  items: readonly T[],
  nation: number,
  ruled: Option.Option<T>,
  into: (replaced: readonly T[]) => Simulation
): Simulation =>
  Option.match(ruled, {
    onNone: () => simulation,
    onSome: (next) => into(replacedAt(items, nation, next)),
  });

/**
 * The simulation once `decision` is carried out, or the same simulation where
 * the world has moved on since it was decided and it no longer applies, or
 * where it changes nothing. A nation that has become a puppet or been annexed
 * since no longer decides anything for itself.
 */
const carriedOut = (
  world: World,
  simulation: Simulation,
  decision: Exclude<Order, { kind: "peace" }>
): Simulation => {
  const { diplomacy } = simulation;
  const economy = itemAt(simulation.economies, decision.nation, NO_ECONOMY);
  if (!answersToItself(diplomacy, decision.nation)) {
    return simulation;
  }
  if (decision.kind === "shipbuilding") {
    return replacedFor(
      simulation,
      simulation.navies,
      decision.nation,
      navyRuled(itemAt(simulation.navies, decision.nation, NO_NAVY), decision),
      (navies) => ({ ...simulation, navies })
    );
  }
  if (decision.kind === "aircraft" || decision.kind === "aviation") {
    return replacedFor(
      simulation,
      simulation.airForces,
      decision.nation,
      airForceRuled(
        itemAt(simulation.airForces, decision.nation, NO_AIR_FORCE),
        decision
      ),
      (airForces) => ({ ...simulation, airForces })
    );
  }
  if (
    decision.kind === "conscription" ||
    decision.kind === "plan" ||
    decision.kind === "trade" ||
    decision.kind === "build-site" ||
    decision.kind === "division-kind"
  ) {
    return replacedFor(
      simulation,
      simulation.economies,
      decision.nation,
      economyRuled(simulation, economy, decision),
      (economies) => ({ ...simulation, economies })
    );
  }
  if (decision.kind === "stance") {
    if (
      itemAt(simulation.stances, decision.nation, START_STANCE) ===
      decision.stance
    ) {
      return simulation;
    }
    return {
      ...simulation,
      stances: replacedAt(simulation.stances, decision.nation, decision.stance),
    };
  }
  if (decision.kind === "agency" || decision.kind === "espionage") {
    return replacedFor(
      simulation,
      simulation.services,
      decision.nation,
      serviceRuled(
        simulation,
        itemAt(simulation.services, decision.nation, NO_SERVICE),
        decision
      ),
      (services) => ({ ...simulation, services })
    );
  }
  if (decision.kind === "research" || decision.kind === "focus") {
    return replacedFor(
      simulation,
      simulation.advancements,
      decision.nation,
      advancementRuled(
        itemAt(simulation.advancements, decision.nation, START_ADVANCEMENT),
        decision
      ),
      (advancements) => ({ ...simulation, advancements })
    );
  }
  if (decision.kind === "justify" || decision.kind === "declare") {
    if (!stillHolds(world, simulation, decision)) {
      return simulation;
    }
    return { ...simulation, diplomacy: hostilityCarried(simulation, decision) };
  }
  if (!mayJoin(simulation, decision.nation, decision.faction)) {
    return simulation;
  }
  return {
    ...simulation,
    diplomacy: joined(diplomacy, decision.nation, decision.faction),
  };
};

/**
 * The simulation once `ruling` has been carried out on the day it reads, with
 * the ruling in the chronicle where it changed something.
 *
 * A ruling arrives some time after it was asked for, so each one is checked
 * against the world as it stands when it lands: a war declared on a nation
 * that has since joined the declarer's faction, or terms for a nation whose
 * talks already closed, are dropped.
 */
export const ruled = (
  world: World,
  simulation: Simulation,
  ruling: Ruling<Order>
): Simulation => {
  const day = simulation.clock.days;
  const { decision } = ruling;
  if (decision.kind === "peace") {
    const open = simulation.negotiations.some(
      (negotiation) => negotiation.loser === decision.loser
    );
    if (!open) {
      return simulation;
    }
    return {
      ...simulation,
      ...fromRealm(
        peaceSigned(
          world,
          realmOf(simulation),
          decision.settlement,
          decision.loser,
          { day, source: ruling.source }
        )
      ),
    };
  }
  const after = carriedOut(world, simulation, decision);
  if (after === simulation) {
    return simulation;
  }
  return {
    ...after,
    chronicle: chronicled(after.chronicle, { day, ruling }),
  };
};
