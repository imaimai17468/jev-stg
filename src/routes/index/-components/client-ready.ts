import { useSyncExternalStore } from "react";

/** Nothing here ever changes after the first render, so nobody is notified. */
const neverChanges = () => () => {
  // No subscription: the answer goes from false to true once, at hydration.
};

const onClient = () => true;
const onServer = () => false;

/**
 * Whether the browser is running this render.
 *
 * The world is drawn from the seed in the browser, because generating it takes
 * long enough that a Worker would pay for it on every request, and a canvas has
 * nothing to render into on the server. Reading that through an external store
 * rather than a mounted flag is what keeps the server's markup and the first
 * client render identical.
 */
export const useClientReady = (): boolean =>
  useSyncExternalStore(neverChanges, onClient, onServer);
