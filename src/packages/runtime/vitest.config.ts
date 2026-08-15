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
    exclude: ["tests/support/**"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/index.ts",
        "src/admission/admittedRecord.ts",
        "src/engine/runtimeDependencies.ts",
        "src/execution/applyContext.ts",
        "src/schema/operationTemplate.ts",
        "src/ports/changeLog.ts",
        "src/ports/clock.ts",
        "src/ports/collaborationStore.ts",
        "src/ports/durableCoordinator.ts",
        "src/ports/idGenerator.ts",
        "src/ports/resourceLockTable.ts",
        "src/ports/runtimeEpochAdministration.ts",
        "src/memory/fileLock.ts",
        "src/memory/memoryChangeLog.ts",
        "src/codec/canonicalSnapshot.ts",
      ],
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
      "@cantilune/core": path.resolve(packageRoot, "../core/src/index.ts"),
      "@cantilune/runtime": path.resolve(packageRoot, "src/index.ts"),
      "@cantilune/test-fixtures": path.resolve(packageRoot, "../test-fixtures/src/index.ts"),
    },
  },
});
