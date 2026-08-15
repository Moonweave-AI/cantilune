import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    root: pkgRoot,
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
    alias: {
      "@cantilune/core": path.resolve(pkgRoot, "../core/src"),
      "@cantilune/conformance": path.resolve(pkgRoot, "../conformance/src"),
      "@cantilune/runtime": path.resolve(pkgRoot, "../runtime/src"),
      "@cantilune/observability": path.resolve(pkgRoot, "../observability/src"),
    },
  },
});
