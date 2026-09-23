import { dateLabel } from "@/shared/entities/world/calendar";
import type { Clock, Speed } from "@/shared/entities/world/clock";
import { dateOf, SPEEDS } from "@/shared/entities/world/clock";
import { Button } from "@/shared/ui/button";
import { ChoiceButton } from "./choice-button";
import type { MapMode } from "./map-mode";
import { MAP_MODES } from "./map-mode";
import { SupplyLegend } from "./supply-legend";

interface HudClockBarProps {
  readonly clock: Clock;
  readonly mode: MapMode;
  readonly onChooseMode: (mode: MapMode) => void;
  readonly onChooseSpeed: (speed: Speed) => void;
  readonly onTogglePause: () => void;
}

const MODE_LABELS = {
  political: "政治",
  supply: "補給",
} satisfies Record<MapMode, string>;

const PAUSE_LABEL = {
  false: "一時停止",
  true: "再開",
} satisfies Record<`${boolean}`, string>;

export const HudClockBar = ({
  clock,
  mode,
  onChooseMode,
  onChooseSpeed,
  onTogglePause,
}: HudClockBarProps) => (
  <footer className="absolute inset-x-0 bottom-0 flex h-16 items-center justify-end gap-4 border-t border-border bg-card px-4">
    <div className="mr-auto flex items-center gap-4">
      <fieldset className="flex items-center gap-2">
        <legend className="sr-only">地図の表示</legend>
        {MAP_MODES.map((option) => (
          <ChoiceButton
            active={option === mode}
            key={option}
            onChoose={onChooseMode}
            value={option}
          >
            {MODE_LABELS[option]}
          </ChoiceButton>
        ))}
      </fieldset>
      <SupplyLegend hidden={mode !== "supply"} />
    </div>
    <p className="font-mono text-lg tabular-nums">{dateLabel(dateOf(clock))}</p>
    <Button onClick={onTogglePause} size="tap" type="button" variant="outline">
      {PAUSE_LABEL[`${clock.paused}`]}
    </Button>
    <div className="flex items-center gap-2">
      {SPEEDS.map((speed) => (
        <ChoiceButton
          active={!clock.paused && speed === clock.speed}
          key={speed}
          onChoose={onChooseSpeed}
          value={speed}
        >
          {speed}
        </ChoiceButton>
      ))}
    </div>
  </footer>
);
