import { describe, it, expect } from "vitest";
import type { BaselineRunner, RunnerConfig, RunnerOutput } from "../../src/ports/executionPorts.js";
import type { EvaluationResult } from "../../src/foundation/evaluationResult.js";
import type { ContentDigest } from "@cantilune/core";

/**
 * Baseline Adapter TCK — Technology Compatibility Kit.
 * Any baseline adapter must satisfy these contract tests.
 */

function createMockBaselineRunner(): BaselineRunner {
  return {
    async execute(config: RunnerConfig): Promise<EvaluationResult<RunnerOutput>> {
      return {
        ok: true,
        value: {
          outputRefs: [`output-${config.seed}`],
          traceRef: `trace-${config.seed}`,
          wallTimeMs: 500,
          tokenUsage: { inputTokens: 50, outputTokens: 25, totalTokens: 75 },
          toolUsage: { toolCalls: 1, toolErrors: 0 },
          cost: {
            modelCostCents: 5,
            toolCostCents: 1,
            networkCostCents: 0,
            totalCostCents: 6,
            currency: "USD",
            receiptRefs: [],
          },
          terminalDisposition: "success",
          environmentCaptureRef: "env-capture",
          resultDigest: "result-digest" as ContentDigest,
        },
      };
    },
  };
}

describe("Baseline adapter TCK", () => {
  const adapter = createMockBaselineRunner();

  const config: RunnerConfig = {
    subjectRef: "baseline-cursor-1.0",
    caseRef: "case-dynamic-branch",
    inputRefs: ["input-1"],
    seed: 42,
    timeoutMs: 30000,
    networkPolicy: "deny",
    filesystemPolicy: "deny",
    toolManifest: [],
    environmentRef: "env-1",
  };

  it("returns a successful result with output refs", async () => {
    const result = await adapter.execute(config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.outputRefs.length).toBeGreaterThan(0);
    }
  });

  it("reports non-negative token usage", async () => {
    const result = await adapter.execute(config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tokenUsage.inputTokens).toBeGreaterThanOrEqual(0);
      expect(result.value.tokenUsage.outputTokens).toBeGreaterThanOrEqual(0);
      expect(result.value.tokenUsage.totalTokens).toBeGreaterThanOrEqual(0);
    }
  });

  it("reports non-negative cost", async () => {
    const result = await adapter.execute(config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cost.totalCostCents).toBeGreaterThanOrEqual(0);
    }
  });

  it("reports non-negative wall time", async () => {
    const result = await adapter.execute(config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.wallTimeMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("provides a terminal disposition", async () => {
    const result = await adapter.execute(config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.terminalDisposition).toBe("success");
    }
  });

  it("provides a result digest", async () => {
    const result = await adapter.execute(config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.resultDigest).toBe("result-digest");
    }
  });

  it("produces deterministic output for same seed", async () => {
    const r1 = await adapter.execute(config);
    const r2 = await adapter.execute(config);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(r1.value.outputRefs).toEqual(r2.value.outputRefs);
    }
  });
});
