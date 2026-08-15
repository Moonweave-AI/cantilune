import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

beforeAll(() => {
  execSync("pnpm build", { cwd: packageRoot, stdio: "inherit" });
});

describe("observability package exports (dist)", () => {
  it("re-exports stable facade entry points from dist", async () => {
    const observability = await import("../../dist/index.js");
    expect(typeof observability.createObservabilityService).toBe("function");
    expect(typeof observability.createObservationIndex).toBe("function");
    expect(typeof observability.CrossViewInvariants.validate).toBe("function");
    expect(typeof observability.isReadOnlyViolation).toBe("function");
  });

  it("does not expose internal projection engine on the root export", async () => {
    const observability = await import("../../dist/index.js");
    expect("ProjectionEngine" in observability).toBe(false);
    expect("assembleObservationWorld" in observability).toBe(false);
  });
});
