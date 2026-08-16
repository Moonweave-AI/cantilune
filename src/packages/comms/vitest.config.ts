import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // L7 suites in this package spawn real child processes; two sequential
    // spawns already exceed Vitest's 5s default, and coverage instrumentation
    // plus workspace-parallel load pushes them further. Matching the timeout to
    // what the suites actually do is what keeps them from being flaky.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      all: false,
      reportsDirectory: "./coverage",
      reporter: ["text", "json-summary"],
      include: [
        "src/index.ts",
        "src/codec/**/*.ts",
        "src/close/closeCoordinator.ts",
        "src/conformance/**/*.ts",
        "src/delivery/**/*.ts",
        "src/engine/**/*.ts",
        "src/file/**/*.ts",
        "src/foundation/comms*.ts",
        "src/foundation/messageId.ts",
        "src/integration/**/*.ts",
        "src/memory/**/*.ts",
        "src/observability/**/*.ts",
        "src/peer/negotiatedProtocol.ts",
        "src/protocol/communicationOperationRegistry.ts",
        "src/protocol/nativeCommunicationAction.ts",
        "src/reconnect/admissionReceiptResolver.ts",
        "src/reconnect/reconnectCoordinator.ts",
        "src/reconnect/reconnectHandoff.ts",
        "src/recovery/**/*.ts",
        "src/security/commsCapability.ts",
        "src/security/denyByDefaultAuthorizer.ts",
        "src/security/envelopePolicy.ts",
        "src/security/hmacIdentityVerifier.ts",
        "src/security/hmacKeyMaterial.ts",
        "src/security/composeProductionIdentity.ts",
        "src/security/identityRotation.ts",
        "src/security/typedMobility.ts",
        "src/security/certificateFingerprint.ts",
        "src/security/endpointIdentityVerifier.ts",
        "src/adapters/file/filePeerDirectory.ts",
        "src/security/x509/**/*.ts",
        "src/transports/**/*.ts",
      ],
      exclude: [
        "**/index.ts",
        "src/envelope/**",
        "src/events/**",
        "src/ports/**",
        "src/session/**",
        "src/mobility/**",
        "src/peer/authenticatedPeerContext.ts",
        "src/peer/peerDescriptor.ts",
        "src/protocol/communicationOccurrenceRecord.ts",
        "src/foundation/communicationStateAxes.ts",
        "src/foundation/stableCommunicationMetadata.ts",
        "src/security/identityVerifier.ts",
        "src/close/quiescentClosePlan.ts",
        "src/reconnect/admissionReconnectPlan.ts",
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
    alias: [
      {
        find: "@cantilune/core",
        replacement: path.resolve(packageRoot, "../core/src/index.ts"),
      },
    ],
  },
});
