import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ["tests/system/l7/raft-live-*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@cantilune/core": path.resolve(packageRoot, "../core/src"),
    },
  },
});
