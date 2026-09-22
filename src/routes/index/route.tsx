import { createFileRoute } from "@tanstack/react-router";
import { parseWorldSearch } from "./-components/world-search";
import { WorldShell } from "./-components/world-shell";

export const Route = createFileRoute("/")({
  component: WorldShell,
  validateSearch: parseWorldSearch,
});
