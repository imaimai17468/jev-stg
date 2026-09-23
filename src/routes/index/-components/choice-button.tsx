import type { ReactNode } from "react";
import { Button } from "@/shared/ui/button";

interface ChoiceButtonProps<T> {
  readonly value: T;
  readonly active: boolean;
  readonly onChoose: (value: T) => void;
  readonly children: ReactNode;
}

// Reading the variant out of a table keeps the choice out of a ternary, which
// `effect/noTernary` forbids, and names what each state looks like.
const VARIANT_FOR_ACTIVE = {
  false: "ghost",
  true: "secondary",
} satisfies Record<`${boolean}`, "ghost" | "secondary">;

/** One option of a row the viewer picks one of, pressed while it is the one chosen. */
export const ChoiceButton = <T,>({
  active,
  children,
  onChoose,
  value,
}: ChoiceButtonProps<T>) => (
  <Button
    aria-pressed={active}
    onClick={() => {
      onChoose(value);
    }}
    size="tap"
    type="button"
    variant={VARIANT_FOR_ACTIVE[`${active}`]}
  >
    {children}
  </Button>
);
