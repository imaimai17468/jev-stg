import { useMemo } from "react";
import { generateWorld } from "@/shared/entities/world";
import { WorldMap } from "./world-map";
import { WorldReadout } from "./world-readout";

interface WorldStageProps {
  readonly seed: number;
}

export const WorldStage = ({ seed }: WorldStageProps) => {
  // Drawing the world is a pure function of the seed and takes long enough that
  // a second render must not repeat it.
  const world = useMemo(() => generateWorld(seed), [seed]);
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <WorldMap world={world} />
      <WorldReadout world={world} />
    </main>
  );
};
