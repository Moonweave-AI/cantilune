import { describe, expect, it } from "vitest";
import { runA2AConformanceHarness } from "../../src/conformance/a2aConformanceHarness.js";

describe("runA2AConformanceHarness error isolation", () => {
  it("records a failed case when the pair factory throws", async () => {
    const report = await runA2AConformanceHarness({
      transportId: "throwing",
      createPair: () => {
        throw new Error("pair factory exploded");
      },
    });
    expect(report.passed).toBe(false);
    expect(report.results.some((result) => result.detail?.includes("pair factory exploded"))).toBe(
      true,
    );
  });
});
