import { createFileRoute } from "@tanstack/react-router";
import { WorldShell } from "./-components/world-shell";

export const Route = createFileRoute("/")({
  component: WorldShell,
});
