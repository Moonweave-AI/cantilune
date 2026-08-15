import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.fuzz.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    globalSetup: [path.resolve(packageRoot, "tests/support/globalSetup.ts")],
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/testing/**",
        "src/adapters/lean/leanAttestationFixture.ts",
        "src/evidence/evidenceFamilies.ts",
        "src/evidence/fourViewEvidence.ts",
        "src/subject/admissionSubject.ts",
        "src/subject/ruleOccurrenceSubject.ts",
        "src/manifest/conformanceTargetManifest.ts",
        "src/foundation/conformanceId.ts",
        "src/foundation/versionedEvidenceEnvelope.ts",
        "src/certificate/packageConformanceCertificate.ts",
        "src/cli/**",
        "src/subject/artifactSubject.ts",
        "src/adapters/runtime/**",
        "src/adapters/file/**",
        "src/ports/**",
        "src/adapters/memory/testReviewerTrustStore.ts",
        "src/**/index.ts",
      ],
      thresholds: {
        statements: 94,
        branches: 92,
        functions: 95,
        lines: 94,
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
        find: "@cantilune/test-fixtures",
        replacement: path.resolve(packageRoot, "../test-fixtures/src/index.ts"),
      },
      {
        find: "@cantilune/conformance/testing",
        replacement: path.resolve(packageRoot, "src/testing/index.ts"),
      },
    ],
  },
});
