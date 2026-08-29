import { defineConfig } from "vitest/config";

// Deliberately its own config, not an extension of vite.config.mjs — these
// are plain unit tests over framework-agnostic logic (src/lib/*.test.ts),
// they don't need the app's TanStack Router / PWA / Sentry Vite plugins.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
