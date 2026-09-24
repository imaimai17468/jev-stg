interface NationListProps {
  readonly names: readonly string[];
  /** What the panel says where the list is empty. */
  readonly empty: string;
}

export const NationList = ({ empty, names }: NationListProps) => {
  if (names.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {names.map((name) => (
        <li className="text-sm" key={name}>
          {name}
        </li>
      ))}
    </ul>
  );
};
