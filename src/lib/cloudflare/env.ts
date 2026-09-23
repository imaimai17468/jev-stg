import "@tanstack/react-start/server-only";
import { env as runtimeEnv } from "cloudflare:workers";

export const getCloudflareEnv = (): CloudflareEnv => runtimeEnv;
