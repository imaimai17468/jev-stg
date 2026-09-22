import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { ThemeProvider } from "@/shared/components/theme-provider/theme-provider";
import { Toaster } from "@/shared/ui/sonner";
import { TooltipProvider } from "@/shared/ui/tooltip";

export const RootLayout = () => (
  // The class is on the element the server renders, so the first paint takes
  // `.dark`'s `color-scheme: dark` rather than waiting for hydration.
  <html className="dark" lang="ja" suppressHydrationWarning>
    <head>
      <HeadContent />
    </head>
    <body className="h-dvh overflow-hidden antialiased">
      <ThemeProvider
        attribute="class"
        disableTransitionOnChange
        enableSystem={false}
        forcedTheme="dark"
      >
        <TooltipProvider>
          <Outlet />
          <Toaster position="top-center" richColors />
        </TooltipProvider>
      </ThemeProvider>
      <TanStackDevtools
        plugins={[
          {
            name: "TanStack Router",
            render: <TanStackRouterDevtoolsPanel />,
          },
          {
            name: "TanStack Query",
            render: <ReactQueryDevtoolsPanel />,
          },
        ]}
      />
      <Scripts />
    </body>
  </html>
);
