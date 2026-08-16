import { describe, expect, it } from "vitest";
import { observationsFromAttempts } from "../../src/analysis/observationsFromAttempts.js";
import type { RunAttempt } from "../../src/execution/evaluationRun.js";

function attempt(status: RunAttempt["status"], extras: Partial<RunAttempt> = {}): RunAttempt {
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
    outputRefs: extras.outputRefs ?? [],
    traceEvidenceRef: extras.traceEvidenceRef,
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
    ...extras,
  };
}

describe("observationsFromAttempts", () => {
  it("scores succeeded attempts as 1 and prefers trace evidence", () => {
    const rows = observationsFromAttempts([
      attempt("succeeded", { traceEvidenceRef: "trace-1" }),
      attempt("failed", { attemptId: "b" as RunAttempt["attemptId"], outputRefs: ["out-1"] }),
    ]);
    expect(rows[0]?.rawValue).toBe(1);
    expect(rows[0]?.evidenceRefs).toEqual(["trace-1"]);
    expect(rows[1]?.rawValue).toBe(0);
    expect(rows[1]?.evidenceRefs).toEqual(["out-1"]);
  });

  it("synthesizes an attempt evidence ref when none is recorded", () => {
    const rows = observationsFromAttempts([attempt("cancelled")]);
    expect(rows[0]?.evidenceRefs[0]).toMatch(/^attempt:/);
  });
});
