import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: [
      "tests/types/**/*.test.ts",
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "tests/contract/**/*.test.ts",
      "tests/system/**/*.test.ts",
    ],
    // L7 suites in this package spawn real child processes; two sequential
    // spawns already exceed Vitest's 5s default, and coverage instrumentation
    // plus workspace-parallel load pushes them further. Matching the timeout to
    // what the suites actually do is what keeps them from being flaky.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/index.ts"],
      thresholds: {
        statements: 90,
        branches: 88,
        functions: 90,
        lines: 90,
      },
    },
  },
  resolve: {
    alias: [
      {
        find: "@cantilune/core",
        replacement: path.resolve(packageRoot, "../core/src/index.ts"),
      },
      {
        find: "@cantilune/content/memory",
        replacement: path.resolve(packageRoot, "../content/src/adapters/memory/index.ts"),
      },
      {
        find: "@cantilune/content",
        replacement: path.resolve(packageRoot, "../content/src/index.ts"),
      },
    ],
  },
});
