import { LEGEND_ORDER, STANDING_MARKS } from "./standing-marks";

export const StandingLegend = () => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
    {LEGEND_ORDER.map((standing) => {
      const { icon: Icon, label } = STANDING_MARKS[standing];
      return (
        <li className="flex items-center gap-1" key={standing}>
          <Icon aria-hidden className="size-3.5" />
          {label}
        </li>
      );
    })}
  </ul>
);
