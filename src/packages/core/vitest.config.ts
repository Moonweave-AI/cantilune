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
      // `index.ts` is re-export surface. `schemaAdmissionReceipt.ts` declares
      // only interfaces — it emits no runtime statements, so it can never be
      // covered and only distorts the denominator.
      exclude: ["src/**/index.ts", "src/coordination/schemaAdmissionReceipt.ts"],
      thresholds: {
        statements: 90,
        branches: 88,
        functions: 90,
        lines: 90,
      },
    },
  },
  // core sits at the bottom of the workspace graph: it resolves only itself.
  // Aliasing a dependent package here would require a dev-dependency edge back
  // into that package, closing a cycle that defeats pnpm's topological build
  // ordering. Cross-package cases live in the dependent package's suite.
  resolve: {
    alias: [
      {
        find: "@cantilune/core",
        replacement: path.resolve(packageRoot, "src/index.ts"),
      },
    ],
  },
});
