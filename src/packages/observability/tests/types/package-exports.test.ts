import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

// dist/ is guaranteed by the `pretest`/`pretest:coverage` hooks. Building here
// spawned a nested `pnpm build` that raced the workspace build already running
// under `pnpm test`.
beforeAll(() => {
  const distEntry = join(packageRoot, "dist", "index.js");
  if (!existsSync(distEntry)) {
    throw new Error(
      `Package-export evidence requires a built package: ${distEntry} is missing. ` +
        `Run \`pnpm --filter @cantilune/observability... build\` first.`,
    );
  }
});

describe("observability package exports (dist)", () => {
  it("re-exports stable facade entry points from dist", async () => {
    const observability = await import("../../dist/index.js");
    expect(typeof observability.createObservabilityService).toBe("function");
    expect(typeof observability.createObservationIndex).toBe("function");
    expect(typeof observability.CrossViewInvariants.validate).toBe("function");
    expect(typeof observability.isReadOnlyViolation).toBe("function");
    expect(typeof observability.requireAccessContext).toBe("function");
    expect(typeof observability.allowsVisibility).toBe("function");
    expect(typeof observability.redactFourViewBundle).toBe("function");
    expect(typeof observability.toAgUiEvents).toBe("function");
    expect(typeof observability.createOtlpTraceExporter).toBe("function");
    expect(typeof observability.projectionCertificateDigest).toBe("function");
    expect(observability.GEN_AI_SEMCONV_STABILITY).toBe("Development");
    expect(observability.CANTILUNE_OTLP_EXPORT_MATURITY).toBe("production");
  });

  it("does not expose internal projection engine on the root export", async () => {
    const observability = await import("../../dist/index.js");
    expect("ProjectionEngine" in observability).toBe(false);
    expect("assembleObservationWorld" in observability).toBe(false);
  });
});
