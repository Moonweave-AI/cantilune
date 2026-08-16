import { createHash } from "node:crypto";
import type { ContentDigest } from "@cantilune/core";
import { contentDigest } from "@cantilune/core";
import {
  ok,
  violations,
  violation,
  type EvaluationResult,
} from "../../foundation/evaluationResult.js";
import type {
  BaselineRunner,
  CandidateRunner,
  RunnerConfig,
  RunnerOutput,
} from "../../ports/executionPorts.js";
import type { ContentAddressedStore } from "../../ports/stateGovernance.js";

function sha256Digest(bytes: Uint8Array): ContentDigest {
  return contentDigest(createHash("sha256").update(bytes).digest("hex"));
}

export interface InProcessBaselineOptions {
  readonly cas: ContentAddressedStore;
  /** Deterministic label embedded in outputs for paired parity checks. */
  readonly baselineId?: string;
}

/**
 * Real in-process baseline runner — executes a deterministic echo/hash baseline
 * against case input refs without external network. Suitable for C1–C4 corpus
 * paired execution inside the evaluation package.
 */
export function createInProcessBaselineRunner(
  options: InProcessBaselineOptions,
): BaselineRunner & CandidateRunner {
  const { cas, baselineId = "cantilune-inprocess-baseline" } = options;

  return {
    async execute(config: RunnerConfig): Promise<EvaluationResult<RunnerOutput>> {
      const started = Date.now();
      const parts: string[] = [baselineId, config.caseRef, String(config.seed)];
      for (const ref of config.inputRefs) {
        parts.push(ref);
        const got = await cas.get(ref as ContentDigest);
        if (got.ok) {
          parts.push(new TextDecoder().decode(got.value));
        }
      }
      const body = parts.join("\n");
      const bytes = new TextEncoder().encode(body);
      const put = await cas.put(bytes);
      if (!put.ok) {
        return violations([
          violation("store_write_failed", "baseline.output", "Failed to store baseline output"),
        ]);
      }
      const trace = JSON.stringify({
        kind: "in-process-baseline",
        baselineId,
        caseRef: config.caseRef,
        seed: config.seed,
        inputRefs: config.inputRefs,
      });
      const tracePut = await cas.put(new TextEncoder().encode(trace));
      if (!tracePut.ok) {
        return violations([
          violation("store_write_failed", "baseline.trace", "Failed to store baseline trace"),
        ]);
      }
      const wallTimeMs = Math.max(1, Date.now() - started);
      return ok({
        outputRefs: [put.value as string],
        traceRef: tracePut.value as string,
        wallTimeMs,
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        toolUsage: { toolCalls: 0, toolErrors: 0 },
        cost: {
          modelCostCents: 0,
          toolCostCents: 0,
          networkCostCents: 0,
          totalCostCents: 0,
          currency: "USD",
          receiptRefs: [],
        },
        terminalDisposition: "success",
        environmentCaptureRef: baselineId,
        resultDigest: sha256Digest(bytes),
      });
    },
  };
}
