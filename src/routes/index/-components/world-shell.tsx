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
  return <WorldStage seed={seed ?? DEFAULT_SEED} />;
};
