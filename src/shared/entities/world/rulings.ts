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
import type { World } from "./index";
import { itemAt } from "./lookup";
import { neighbouringNations } from "./nations";
import type { Simulation } from "./simulation";
import { fromRealm, realmOf } from "./simulation";
import { START_STANCE } from "./stance";
import { answersToItself, peaceSigned } from "./statecraft";
import { enemiesOf } from "./wars";

/** The simulation with one nation's economy replaced by what `change` makes of it. */
const economyChanged = (
  simulation: Simulation,
  nation: number,
  change: (economy: NationEconomy) => NationEconomy
): Simulation => ({
  ...simulation,
  economies: simulation.economies.map((economy, other) => {
    if (other === nation) {
      return change(economy);
    }
    return economy;
  }),
});

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
  if (decision.kind === "conscription") {
    if (economy.conscription === decision.law) {
      return simulation;
    }
    return economyChanged(simulation, decision.nation, (held) =>
      withConscription(held, decision.law)
    );
  }
  if (decision.kind === "plan") {
    if (economy.plan === decision.plan) {
      return simulation;
    }
    return economyChanged(simulation, decision.nation, (held) =>
      withPlan(held, decision.plan)
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
      stances: simulation.stances.map((stance, nation) => {
        if (nation === decision.nation) {
          return decision.stance;
        }
        return stance;
      }),
    };
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
