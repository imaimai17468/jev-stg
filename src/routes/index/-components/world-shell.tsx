import { getRouteApi } from "@tanstack/react-router";
import { useClientReady } from "./client-ready";
import { WorldPending } from "./world-pending";
import { DEFAULT_SEED } from "./world-search";
import { WorldStage } from "./world-stage";

const route = getRouteApi("/");

export const WorldShell = () => {
  const { seed } = route.useSearch();
  const ready = useClientReady();
  if (!ready) {
    return <WorldPending />;
  }
  const chosen = seed ?? DEFAULT_SEED;
  // Keyed on the seed so a new world starts on its own first day rather than
  // inheriting the calendar and the economies the previous one had reached.
  return <WorldStage key={chosen} seed={chosen} />;
};
