import { Option } from "effect";
import { useCallback, useEffect, useMemo, useState } from "react";
import { afterMilliseconds } from "@/lib/schedule";
import { generateWorld } from "@/shared/entities/world";
import type { Speed } from "@/shared/entities/world/clock";
import {
  advancedOneDay,
  atSpeed,
  dayDuration,
  START_CLOCK,
  togglePaused,
} from "@/shared/entities/world/clock";
import { headlineOf } from "./headline";
import { HudClockBar } from "./hud-clock-bar";
import { HudNationPanel } from "./hud-nation-panel";
import { HudTopBar } from "./hud-top-bar";
import type { NationSummary } from "./nation-summary";
import { summaryOf } from "./nation-summary";
import { WorldMap } from "./world-map";

interface WorldStageProps {
  readonly seed: number;
}

const NO_NATION = Option.none<number>();
const NO_SUMMARY = Option.none<NationSummary>();

const noCleanup = () => {
  // The clock is not running, so no timer was set.
};

export const WorldStage = ({ seed }: WorldStageProps) => {
  // Drawing the world is a pure function of the seed and takes long enough that
  // a second render must not repeat it.
  const world = useMemo(() => generateWorld(seed), [seed]);
  const [clock, setClock] = useState(START_CLOCK);
  const [selected, setSelected] = useState(NO_NATION);

  useEffect(() => {
    // Synchronise the calendar with real time. Each run waits out one in-game
    // day and hands the next one to the run that replaces it, so pausing or
    // choosing a speed drops the part of the day already waited and starts a
    // fresh one at the new duration.
    if (clock.paused) {
      return noCleanup;
    }
    return afterMilliseconds(dayDuration(clock), () => {
      setClock(advancedOneDay);
    });
  }, [clock]);

  const selection = useMemo(
    () =>
      Option.match(selected, {
        onNone: () => NO_SUMMARY,
        onSome: (nation) => Option.some(summaryOf(world, nation)),
      }),
    [selected, world]
  );

  const chooseSpeed = useCallback((speed: Speed) => {
    setClock((current) => atSpeed(current, speed));
  }, []);

  const flipPause = useCallback(() => {
    setClock(togglePaused);
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <WorldMap
        highlighted={selected}
        onSelectNation={setSelected}
        onTogglePause={flipPause}
        world={world}
      />
      <HudTopBar headline={headlineOf(world, selection)} />
      <HudNationPanel selection={selection} />
      <HudClockBar
        clock={clock}
        onChooseSpeed={chooseSpeed}
        onTogglePause={flipPause}
      />
    </main>
  );
};
