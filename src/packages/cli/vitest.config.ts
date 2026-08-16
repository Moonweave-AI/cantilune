import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    setupFiles: ["tests/setup/inkSetup.ts"],
    include: [
      "tests/types/**/*.test.{ts,tsx}",
      "tests/unit/**/*.test.{ts,tsx}",
      "tests/integration/**/*.test.{ts,tsx}",
      "tests/contract/**/*.test.{ts,tsx}",
      "tests/system/**/*.test.{ts,tsx}",
    ],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/index.ts", "src/app.tsx"],
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
      { find: "@cantilune/core", replacement: path.resolve(packageRoot, "../core/src/index.ts") },
      {
        find: "@cantilune/runtime/memory",
        replacement: path.resolve(packageRoot, "../runtime/src/memory/index.ts"),
      },
      {
        find: "@cantilune/runtime",
        replacement: path.resolve(packageRoot, "../runtime/src/index.ts"),
      },
      {
        find: "@cantilune/content/memory",
        replacement: path.resolve(packageRoot, "../content/src/adapters/memory/index.ts"),
      },
      {
        find: "@cantilune/content/file",
        replacement: path.resolve(packageRoot, "../content/src/adapters/file/index.ts"),
      },
      {
        find: "@cantilune/content",
        replacement: path.resolve(packageRoot, "../content/src/index.ts"),
      },
      {
        find: "@cantilune/syscall",
        replacement: path.resolve(packageRoot, "../syscall/src/index.ts"),
      },
      { find: "@cantilune/boot", replacement: path.resolve(packageRoot, "../boot/src/index.ts") },
      {
        find: "@cantilune/adapter",
        replacement: path.resolve(packageRoot, "../adapter/src/index.ts"),
      },
      { find: "@cantilune/tools", replacement: path.resolve(packageRoot, "../tools/src/index.ts") },
      {
        find: "@cantilune/evaluation/benchmarks",
        replacement: path.resolve(packageRoot, "../evaluation/src/benchmarks/index.ts"),
      },
      {
        find: "@cantilune/evaluation/execution",
        replacement: path.resolve(packageRoot, "../evaluation/src/execution/index.ts"),
      },
      {
        find: "@cantilune/evaluation",
        replacement: path.resolve(packageRoot, "../evaluation/src/index.ts"),
      },
      { find: "@cantilune/petri", replacement: path.resolve(packageRoot, "../petri/src/index.ts") },
    ],
  },
});
