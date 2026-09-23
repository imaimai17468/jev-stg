import { dateLabel } from "@/shared/entities/world/calendar";
import type { Clock, Speed } from "@/shared/entities/world/clock";
import { dateOf, SPEEDS } from "@/shared/entities/world/clock";
import { Button } from "@/shared/ui/button";
import { ChoiceButton } from "./choice-button";

interface HudClockBarProps {
  readonly clock: Clock;
  readonly onChooseSpeed: (speed: Speed) => void;
  readonly onTogglePause: () => void;
}

const PAUSE_LABEL = {
  false: "一時停止",
  true: "再開",
} satisfies Record<`${boolean}`, string>;

export const HudClockBar = ({
  clock,
  onChooseSpeed,
  onTogglePause,
}: HudClockBarProps) => (
  <footer className="absolute inset-x-0 bottom-0 flex h-16 items-center justify-end gap-4 border-t border-border bg-card px-4">
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
