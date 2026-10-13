// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = dirname(fileURLToPath(import.meta.url));

const SERVER_ENV_KEYS = [
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "OPENROUTER_REASONING_MAX_TOKENS",
  "OPENROUTER_SITE_URL",
  "OPENROUTER_APP_NAME",
] as const;

export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, frontendDir, "");
  for (const key of SERVER_ENV_KEYS) {
    if (!process.env[key] && serverEnv[key]) process.env[key] = serverEnv[key];
  }

  return {
    tanstackStart: {
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      // nitro/vite builds from this
      server: { entry: "server" },
    },
  };
});
