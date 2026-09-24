import { useMutation } from "@tanstack/react-query";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { World } from "@/shared/entities/world";
import type { Negotiation } from "@/shared/entities/world/chronicle";
import type {
  Consultation,
  JevReply,
} from "@/shared/entities/world/consultation";
import {
  afterCouncil,
  afterTalks,
  councilDayOf,
  councilOf,
  peaceTalksOf,
} from "@/shared/entities/world/council";
import type { Simulation } from "@/shared/entities/world/simulation";

/** Asks Jev about one consultation. */
export type Consult = (consultation: Consultation) => Promise<JevReply>;

/**
 * Who is deciding the governments' months: waiting on Jev, Jev, Jev with the
 * rules standing in for the governments it left unanswered, or the rules.
 */
export type CouncilVoice = "consulting" | "jev" | "mixed" | "rules";

/** Who decided the latest month a reply came in for, and which month it was. */
export interface Heard {
  readonly councilDay: number;
  readonly voice: Exclude<CouncilVoice, "consulting">;
}

/** No month has been decided yet. */
const NOTHING_HEARD: Heard = { councilDay: -1, voice: "rules" };

/** What a consultation that threw counts as, so the month still gets decided. */
const UNREACHED: JevReply = { _tag: "unavailable" };

/**
 * What a council counts as when the one before it is still waiting on Jev. It
 * is not sent, because Jev refuses more of its requests the more of them are
 * in flight, and the rules decide its month at once.
 */
const STILL_CONSULTING: JevReply = { _tag: "busy" };

/**
 * What has been heard once the reply for the month the council met on
 * `councilDay` is in. A reply for an earlier month than the latest heard lands
 * late and says nothing about who is deciding now, so it leaves `previous`.
 */
export const latestHeard = (
  previous: Heard,
  councilDay: number,
  reply: JevReply
): Heard => {
  if (councilDay < previous.councilDay) {
    return previous;
  }
  if (reply._tag !== "answered") {
    return { councilDay, voice: "rules" };
  }
  if (reply.unanswered.length > 0) {
    return { councilDay, voice: "mixed" };
  }
  return { councilDay, voice: "jev" };
};

/**
 * Who is deciding the month the council met on `councilDay`: still waiting
 * until that month's reply is in, and whoever answered it after.
 */
const voiceOn = (heard: Heard, councilDay: number): CouncilVoice => {
  if (heard.councilDay !== councilDay) {
    return "consulting";
  }
  return heard.voice;
};

/** Names one set of talks: the loser and the day it surrendered. */
const talkKey = (negotiation: Negotiation): string =>
  `${negotiation.loser}@${negotiation.openedOn}`;

/**
 * Synchronises Jev with the month the simulation has reached and the talks it
 * holds open: each first of the month asks what every government decides, and
 * each surrender asks what terms the victor dictates, once per set of talks.
 * Each reply is carried out on whatever day it
 * lands, and one that lands after the stage has gone sets state nobody renders.
 */
export const useJevCouncil = (
  world: World,
  simulation: Simulation,
  setSimulation: Dispatch<SetStateAction<Simulation>>,
  consult: Consult
): CouncilVoice => {
  const [heard, setHeard] = useState(NOTHING_HEARD);
  const asked = useRef(new Set<string>());
  const councilOut = useRef(false);
  const consulting = useMutation({ mutationFn: consult });

  const convene = useEffectEvent((councilDay: number) => {
    const convened = { council: councilOf(world, simulation), day: councilDay };
    const settle = (reply: JevReply) => {
      setHeard((previous) => latestHeard(previous, councilDay, reply));
      setSimulation((current) => afterCouncil(world, current, convened, reply));
    };
    if (councilOut.current) {
      settle(STILL_CONSULTING);
      return;
    }
    councilOut.current = true;
    void consulting
      .mutateAsync(convened.council)
      .catch(() => UNREACHED)
      .then((reply) => {
        councilOut.current = false;
        settle(reply);
      });
  });

  const negotiate = useEffectEvent((open: readonly Negotiation[]) => {
    const unasked = open.filter(
      (negotiation) => !asked.current.has(talkKey(negotiation))
    );
    for (const negotiation of unasked) {
      asked.current.add(talkKey(negotiation));
      void consulting
        .mutateAsync(peaceTalksOf(world, simulation, negotiation))
        .catch(() => UNREACHED)
        .then((reply) => {
          setSimulation((current) =>
            afterTalks(world, current, negotiation, reply)
          );
        });
    }
  });

  const councilDay = councilDayOf(simulation.clock);

  useEffect(() => {
    convene(councilDay);
  }, [councilDay]);

  useEffect(() => {
    negotiate(simulation.negotiations);
  }, [simulation.negotiations]);

  return voiceOn(heard, councilDay);
};
