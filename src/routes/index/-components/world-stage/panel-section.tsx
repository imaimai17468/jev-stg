import type { ReactNode } from "react";

interface PanelSectionProps {
  readonly title: string;
  readonly children: ReactNode;
}

export const PanelSection = ({ children, title }: PanelSectionProps) => (
  <section className="flex flex-col gap-2">
    <h2 className="text-xs text-muted-foreground">{title}</h2>
    {children}
  </section>
);
