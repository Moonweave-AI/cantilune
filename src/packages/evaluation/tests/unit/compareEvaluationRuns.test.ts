import { describe, expect, it } from "vitest";
import { compareEvaluationRuns } from "../../src/analysis/compareEvaluationRuns.js";
import type { RunAttempt } from "../../src/execution/evaluationRun.js";

function attempt(status: RunAttempt["status"]): RunAttempt {
  return {
    attemptId: "a" as RunAttempt["attemptId"],
    runId: "r" as RunAttempt["runId"],
    idempotencyKey: "k",
    planDigest: "d" as RunAttempt["planDigest"],
    subjectRef: "s" as RunAttempt["subjectRef"],
    caseRef: "c" as RunAttempt["caseRef"],
    seed: 1,
    executionOrder: 1,
    status,
    workerId: "w" as RunAttempt["workerId"],
    leaseId: "l" as RunAttempt["leaseId"],
    fencingToken: "f" as RunAttempt["fencingToken"],
    startedAt: undefined,
    endedAt: undefined,
    inputRefs: [],
    outputRefs: [],
    traceEvidenceRef: undefined,
    observationEvidenceRef: undefined,
    admissionEvidenceRef: undefined,
    communicationEvidenceRef: undefined,
    providerReceiptRefs: [],
    rawArtifactRefs: [],
    sanitizedArtifactRefs: [],
    tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    toolUsage: { toolCalls: 0, toolErrors: 0 },
    networkUsage: { requestCount: 0, totalBytesIn: 0, totalBytesOut: 0 },
    wallTime: 0,
    cost: {
      modelCostCents: 0,
      toolCostCents: 0,
      networkCostCents: 0,
      totalCostCents: 0,
      currency: "USD",
      receiptRefs: [],
    },
    terminalDisposition: undefined,
    failureCategory: undefined,
    retryOf: undefined,
    environmentCaptureRef: undefined,
    resultDigest: "d" as RunAttempt["resultDigest"],
  };
}

describe("compareEvaluationRuns", () => {
  it("reports succeeded-attempt delta without a superiority claim", () => {
    const analysis = compareEvaluationRuns({
      runA: "run-a",
      runB: "run-b",
      attemptsA: [attempt("succeeded"), attempt("failed")],
      attemptsB: [attempt("succeeded"), attempt("succeeded")],
    });
    expect(analysis.estimate.pointEstimate).toBe(1);
    expect(analysis.estimate.method).toBe("completed-attempt-count-delta");
    expect(analysis.negativeResults.some((row) => row.includes("runA failed"))).toBe(true);
    expect(analysis.pairedResults).toHaveLength(1);
  });
});
