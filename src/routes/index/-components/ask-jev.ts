import { consultJevFn } from "@/shared/gateway/jev/consult.fn";
import type { Consult } from "./use-jev-council";

/** Asks the server's Jev gateway, which is what the stage consults. */
export const askJev: Consult = (consultation) =>
  consultJevFn({ data: consultation });
