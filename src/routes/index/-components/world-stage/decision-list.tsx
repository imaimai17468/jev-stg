import type { EntryLine } from "./entry-line";

interface DecisionListProps {
  readonly lines: readonly EntryLine[];
}

export const DecisionList = ({ lines }: DecisionListProps) => {
  if (lines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">まだ判断はありません</p>
    );
  }
  return (
    <ol className="flex flex-col gap-3">
      {lines.map((line) => (
        <li className="flex min-w-0 flex-col gap-0.5" key={line.key}>
          <p className="flex justify-between gap-2 text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">{line.date}</span>
            <span>{line.source}</span>
          </p>
          <p className="text-sm wrap-break-word">
            <span className="font-medium">{line.actor}</span> {line.action}
          </p>
        </li>
      ))}
    </ol>
  );
};
