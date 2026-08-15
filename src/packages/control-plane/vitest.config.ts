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
        find: "@cantilune/runtime/memory",
        replacement: path.resolve(packageRoot, "../runtime/src/memory/index.ts"),
      },
      {
        find: "@cantilune/runtime",
        replacement: path.resolve(packageRoot, "../runtime/src/index.ts"),
      },
      {
        find: "@cantilune/conformance/admission",
        replacement: path.resolve(packageRoot, "../conformance/src/admission/index.ts"),
      },
      {
        find: "@cantilune/conformance/testing",
        replacement: path.resolve(packageRoot, "../conformance/src/testing/index.ts"),
      },
      {
        find: "@cantilune/conformance",
        replacement: path.resolve(packageRoot, "../conformance/src/index.ts"),
      },
      {
        find: "@cantilune/comms",
        replacement: path.resolve(packageRoot, "../comms/src/index.ts"),
      },
      {
        find: "@cantilune/test-fixtures",
        replacement: path.resolve(packageRoot, "../test-fixtures/src/index.ts"),
      },
    ],
  },
});
