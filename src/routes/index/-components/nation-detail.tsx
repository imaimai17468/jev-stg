import type { Terrain } from "@/shared/entities/world/terrain";
import type { NationSummary } from "./nation-summary";

interface NationDetailProps {
  readonly summary: NationSummary;
}

const TERRAIN_LABELS = {
  desert: "砂漠",
  forest: "森林",
  hills: "丘陵",
  mountains: "山岳",
  plains: "平野",
  tundra: "ツンドラ",
} satisfies Readonly<Record<Terrain, string>>;

export const NationDetail = ({ summary }: NationDetailProps) => (
  <div className="flex flex-col gap-6">
    <section className="flex flex-col gap-2">
      <h2 className="text-xs text-muted-foreground">地形</h2>
      <dl className="flex flex-col gap-1">
        {summary.terrain.map((share) => (
          <div
            className="flex items-baseline justify-between"
            key={share.terrain}
          >
            <dt className="text-sm">{TERRAIN_LABELS[share.terrain]}</dt>
            <dd className="font-mono text-sm tabular-nums">
              {share.provinces}
            </dd>
          </div>
        ))}
      </dl>
    </section>
    <section className="flex flex-col gap-2">
      <h2 className="text-xs text-muted-foreground">隣接する国</h2>
      <ul className="flex flex-col gap-1">
        {summary.neighbours.map((name) => (
          <li className="text-sm" key={name}>
            {name}
          </li>
        ))}
      </ul>
    </section>
  </div>
);
