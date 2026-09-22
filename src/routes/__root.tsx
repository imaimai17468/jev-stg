import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext } from "@tanstack/react-router";
import { DOCUMENT_HEADERS } from "@/lib/response-headers";
import { NotFound } from "./-components/not-found";
import { RootLayout } from "./-components/root-layout";
import "@/styles.css";

if (import.meta.env.DEV && !import.meta.env.SSR) {
  void import("react-grab");
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Jev STG" },
    ],
    links: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
  }),
  headers: () => DOCUMENT_HEADERS,
  component: RootLayout,
  notFoundComponent: NotFound,
});
