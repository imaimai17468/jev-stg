import { Option } from "effect";
import { useCallback, useEffect, useMemo, useState } from "react";
import { afterMilliseconds } from "@/lib/schedule";
import type { Speed } from "@/shared/entities/world/clock";
import {
  atSpeed,
  dayDuration,
  togglePaused,
} from "@/shared/entities/world/clock";
import {
  ranOneDay,
  startSimulation,
  supplyOf,
  withClock,
} from "@/shared/entities/world/simulation";
import { generateWorld } from "@/shared/entities/world/world";
import { askJev } from "./ask-jev";
import { entryLine } from "./entry-line";
import { headlineOf } from "./headline";
import { HudClockBar } from "./hud-clock-bar";
import { HudDecisionFeed } from "./hud-decision-feed";
import { HudNationPanel } from "./hud-nation-panel";
import { HudTopBar } from "./hud-top-bar";
import type { MapMode } from "./map-mode";
import type { NationSummary } from "./nation-summary";
import { summaryOf } from "./nation-summary";
import { useJevCouncil } from "./use-jev-council";
import { WorldMap } from "./world-map";

interface WorldStageProps {
  readonly seed: number;
}

const NO_SELECTION = Option.none<number>();
const NO_SUMMARY = Option.none<NationSummary>();

const noCleanup = () => {
  // The clock is not running, so no timer was set.
};

export const WorldStage = ({ seed }: WorldStageProps) => {
  // Drawing the world is a pure function of the seed and takes long enough that
  // a second render must not repeat it.
  const world = useMemo(() => generateWorld(seed), [seed]);
  const [simulation, setSimulation] = useState(() => startSimulation(world));
  const [selected, setSelected] = useState(NO_SELECTION);
  const [mode, setMode] = useState<MapMode>("political");
  const { clock } = simulation;

  useEffect(() => {
    // Synchronise the calendar with real time. Each run waits out one in-game
    // day and hands the next one to the run that replaces it, so pausing or
    // choosing a speed drops the part of the day already waited and starts a
    // fresh one at the new duration.
    if (clock.paused) {
      return noCleanup;
    }
    return afterMilliseconds(dayDuration(clock), () => {
      setSimulation((current) => ranOneDay(world, current));
    });
  }, [clock, world]);

  const supply = useMemo(
    () => supplyOf(world, simulation),
    [world, simulation]
  );

  const { airPower, diplomacy } = simulation;
  const skies = useMemo(
    () => ({ diplomacy, power: airPower }),
    [airPower, diplomacy]
  );

  const selection = useMemo(
    () =>
      Option.match(selected, {
        onNone: () => NO_SUMMARY,
        onSome: (nation) =>
          Option.some(summaryOf(world, simulation, supply, nation)),
      }),
    [selected, world, simulation, supply]
  );

  const chooseSpeed = useCallback((speed: Speed) => {
    setSimulation((current) =>
      withClock(current, atSpeed(current.clock, speed))
    );
  }, []);

  const voice = useJevCouncil(world, simulation, setSimulation, askJev);
  const lines = useMemo(
    () => simulation.chronicle.map((entry) => entryLine(world, entry)),
    [world, simulation.chronicle]
  );

  const flipPause = useCallback(() => {
    setSimulation((current) => withClock(current, togglePaused(current.clock)));
  }, []);

  return (
    <main className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      <HudTopBar
        headline={headlineOf(world, simulation.diplomacy, selection)}
      />
      <div className="flex min-h-0 flex-1">
        <HudNationPanel selection={selection} />
        <WorldMap
          airForces={simulation.airForces}
          compliance={simulation.compliance}
          divisions={simulation.divisions}
          highlighted={selected}
          mode={mode}
          navies={simulation.navies}
          networks={simulation.networks}
          onSelectNation={setSelected}
          onTogglePause={flipPause}
          owners={simulation.owners}
          skies={skies}
          supply={supply}
          wars={diplomacy.wars}
          world={world}
        />
        <HudDecisionFeed lines={lines} voice={voice} />
      </div>
      <HudClockBar
        clock={clock}
        mode={mode}
        onChooseMode={setMode}
        onChooseSpeed={chooseSpeed}
        onTogglePause={flipPause}
      />
    </main>
  );
};
