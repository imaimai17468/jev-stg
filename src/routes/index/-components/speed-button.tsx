import type { Speed } from "@/shared/entities/world/clock";
import { Button } from "@/shared/ui/button";

interface SpeedButtonProps {
  readonly speed: Speed;
  readonly active: boolean;
  readonly onChoose: (speed: Speed) => void;
}

// Reading the variant out of a table keeps the choice out of a ternary, which
// `effect/noTernary` forbids, and names what each state looks like.
const VARIANT_FOR_ACTIVE = {
  false: "ghost",
  true: "secondary",
} satisfies Record<`${boolean}`, "ghost" | "secondary">;

export const SpeedButton = ({ active, onChoose, speed }: SpeedButtonProps) => (
  <Button
    aria-pressed={active}
    onClick={() => {
      onChoose(speed);
    }}
    size="tap"
    type="button"
    variant={VARIANT_FOR_ACTIVE[`${active}`]}
  >
    {speed}
  </Button>
);
