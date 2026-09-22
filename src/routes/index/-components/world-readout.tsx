import type { World } from "@/shared/entities/world";

interface WorldReadoutProps {
  readonly world: World;
}

export const WorldReadout = ({ world }: WorldReadoutProps) => (
  <dl className="absolute bottom-4 left-4 flex gap-6 rounded-md border border-border bg-card px-4 py-3 text-xs backdrop-blur-sm">
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground">seed</dt>
      <dd className="font-mono tabular-nums">{world.seed}</dd>
    </div>
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground">国</dt>
      <dd className="font-mono tabular-nums">{world.nations.length}</dd>
    </div>
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground">州</dt>
      <dd className="font-mono tabular-nums">{world.provinces.length}</dd>
    </div>
  </dl>
);
