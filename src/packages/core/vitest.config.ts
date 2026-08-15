import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: [
      "tests/types/**/*.test.ts",
      "tests/types/**/*.test-d.ts",
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "tests/contract/**/*.test.ts",
      "tests/system/**/*.test.ts",
    ],
    exclude: ["tests/support/**"],
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
        find: "@cantilune/runtime/memory",
        replacement: path.resolve(packageRoot, "../runtime/src/memory/index.ts"),
      },
      {
        find: "@cantilune/runtime",
        replacement: path.resolve(packageRoot, "../runtime/src/index.ts"),
      },
      {
        find: "@cantilune/core",
        replacement: path.resolve(packageRoot, "src/index.ts"),
      },
      {
        find: "@cantilune/test-fixtures",
        replacement: path.resolve(packageRoot, "../test-fixtures/src/index.ts"),
      },
    ],
  },
});
