import { Option } from "effect";
import type { Advancement } from "./advancement";
import { freeSlotsOf, START_ADVANCEMENT } from "./advancement";
import type { Decision, Ruling } from "./chronicle";
import { chronicled } from "./chronicle";
import {
  allied,
  factionOf,
  joined,
  NO_FACTION,
  sideOf,
  warDeclared,
} from "./diplomacy";
import type { NationEconomy } from "./economy";
import { NO_ECONOMY, withConscription, withPlan } from "./economy";
import { availableFocuses, focusStarted } from "./focus";
import type { World } from "./index";
import { itemAt, replacedAt } from "./lookup";
import { neighbouringNations } from "./nations";
import { availableTechs, studyStarted } from "./research";
import type { Simulation } from "./simulation";
import { fromRealm, realmOf } from "./simulation";
import { START_STANCE } from "./stance";
import { answersToItself, peaceSigned } from "./statecraft";
import { enemiesOf } from "./wars";

/**
 * Whether `nation`, which answers to itself, may still declare on `target`
 * today: it is at peace, the target is outside its side, and their land still
 * touches.
 */
const mayDeclare = (
  world: World,
  simulation: Simulation,
  nation: number,
  target: number
): boolean => {
  const { diplomacy } = simulation;
  const touching = neighbouringNations(world, simulation.owners).some(
    (pair) =>
      (pair.one === nation && pair.other === target) ||
      (pair.other === nation && pair.one === target)
  );
  return (
    enemiesOf(diplomacy.wars, nation).length === 0 &&
    !allied(diplomacy, nation, target) &&
    touching
  );
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

/** The economy under the law or the plan decided, or none where it already has it. */
const economyRuled = (
  economy: NationEconomy,
  decision: Extract<Decision, { kind: "conscription" | "plan" }>
): Option.Option<NationEconomy> => {
  if (decision.kind === "conscription") {
    if (economy.conscription === decision.law) {
      return Option.none();
    }
    return Option.some(withConscription(economy, decision.law));
  }
  if (economy.plan === decision.plan) {
    return Option.none();
  }
  return Option.some(withPlan(economy, decision.plan));
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
  decision: Exclude<Decision, { kind: "peace" }>
): Simulation => {
  const { diplomacy } = simulation;
  const economy = itemAt(simulation.economies, decision.nation, NO_ECONOMY);
  if (!answersToItself(diplomacy, decision.nation)) {
    return simulation;
  }
  if (decision.kind === "conscription" || decision.kind === "plan") {
    return replacedFor(
      simulation,
      simulation.economies,
      decision.nation,
      economyRuled(economy, decision),
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
  if (decision.kind === "declare") {
    if (!mayDeclare(world, simulation, decision.nation, decision.target)) {
      return simulation;
    }
    return {
      ...simulation,
      diplomacy: warDeclared(diplomacy, decision.nation, decision.target),
    };
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
  ruling: Ruling
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
