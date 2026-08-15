import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { createFileRunStore } from "../../src/adapters/file/fileRunStore.js";
import { createFileClaimLedger } from "../../src/adapters/file/fileClaimLedger.js";
import { createFileContentAddressedStore } from "../../src/adapters/file/fileContentAddressedStore.js";
import {
  evaluationRunId,
  runAttemptId,
  evaluationRunPlanId,
  evaluationSubjectId,
  benchmarkCaseId,
  evaluationClaimId,
  evaluationProtocolId,
  aggregateAnalysisId,
  workerId,
  leaseId,
  fencingToken,
} from "../../src/foundation/evaluationIds.js";
import type { EvaluationRun, RunAttempt } from "../../src/execution/evaluationRun.js";
import type { ClaimLedgerEntry } from "../../src/ports/stateGovernance.js";
import type { ContentDigest } from "@cantilune/core";

const d = (s: string) => s as ContentDigest;

function makeRun(id: string, planRef = "plan-1"): EvaluationRun {
  return {
    runId: evaluationRunId(id),
    planRef: evaluationRunPlanId(planRef),
    planDigest: d("pd"),
    subjectRef: evaluationSubjectId("sub1"),
    status: "admitted",
    attemptIds: [],
    currentAttemptId: undefined,
    startedAt: "2026-01-01",
    endedAt: undefined,
    runDigest: d("rd"),
  };
}

function makeAttempt(id: string, runId: string): RunAttempt {
  return {
    attemptId: runAttemptId(id),
    runId: evaluationRunId(runId),
    idempotencyKey: `${runId}-${id}`,
    planDigest: d("pd"),
    subjectRef: evaluationSubjectId("sub1"),
    caseRef: benchmarkCaseId("case1"),
    seed: 42,
    executionOrder: 0,
    status: "succeeded",
    workerId: workerId("w1"),
    leaseId: leaseId("l1"),
    fencingToken: fencingToken("f1"),
    startedAt: "2026-01-01",
    endedAt: "2026-01-01",
    inputRefs: [],
    outputRefs: ["out-1"],
    traceEvidenceRef: "trace-1",
    observationEvidenceRef: undefined,
    admissionEvidenceRef: undefined,
    communicationEvidenceRef: undefined,
    providerReceiptRefs: [],
    rawArtifactRefs: ["out-1"],
    sanitizedArtifactRefs: [],
    tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    toolUsage: { toolCalls: 0, toolErrors: 0 },
    networkUsage: { requestCount: 0, totalBytesIn: 0, totalBytesOut: 0 },
    wallTime: 100,
    cost: {
      modelCostCents: 1,
      toolCostCents: 0,
      networkCostCents: 0,
      totalCostCents: 1,
      currency: "USD",
      receiptRefs: [],
    },
    terminalDisposition: "success",
    failureCategory: undefined,
    retryOf: undefined,
    environmentCaptureRef: "env-1",
    resultDigest: d("result-d"),
  };
}

function makeLedgerEntry(
  claimRef: string,
  digest: string,
  previousDigest?: string,
  decision?: ClaimLedgerEntry["decision"],
): ClaimLedgerEntry {
  return {
    claimRef: evaluationClaimId(claimRef),
    action: "protocolFrozen",
    decision,
    previousDigest: previousDigest !== undefined ? d(previousDigest) : undefined,
    entryDigest: d(digest),
    timestamp: "2026-01-01",
  };
}

describe("File run store", () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "eval-run-store-"));
  });

  afterEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  it("saves and retrieves a run", async () => {
    const store = createFileRunStore(baseDir);
    const run = makeRun("run-1");
    const saveResult = await store.save(run);
    expect(saveResult.ok).toBe(true);
    expect(await store.get(evaluationRunId("run-1"))).toEqual(run);
  });

  it("lists runs by plan reference", async () => {
    const store = createFileRunStore(baseDir);
    await store.save(makeRun("run-1", "plan-a"));
    await store.save(makeRun("run-2", "plan-b"));
    await store.save(makeRun("run-3", "plan-a"));
    const listed = await store.listByPlan(evaluationRunPlanId("plan-a"));
    expect(listed).toHaveLength(2);
    expect(listed.every((r) => r.planRef === evaluationRunPlanId("plan-a"))).toBe(true);
  });

  it("returns empty list when runs directory is missing", async () => {
    const store = createFileRunStore(baseDir);
    expect(await store.listByPlan("plan-missing")).toEqual([]);
  });

  it("rejects invalid run id on save", async () => {
    const store = createFileRunStore(baseDir);
    const run = { ...makeRun("run-1"), runId: "../escape" as ReturnType<typeof evaluationRunId> };
    const result = await store.save(run);
    expect(result.ok).toBe(false);
  });

  it("returns undefined for invalid run id on get", async () => {
    const store = createFileRunStore(baseDir);
    expect(await store.get("../escape" as ReturnType<typeof evaluationRunId>)).toBeUndefined();
  });

  it("returns undefined for corrupted run file", async () => {
    const store = createFileRunStore(baseDir);
    const runsDir = path.join(baseDir, "runs");
    await fs.mkdir(runsDir, { recursive: true });
    await fs.writeFile(path.join(runsDir, "run-bad.json"), "not-json");
    expect(await store.get(evaluationRunId("run-bad"))).toBeUndefined();
  });

  it("saves and retrieves attempts", async () => {
    const store = createFileRunStore(baseDir);
    const attempt = makeAttempt("attempt-1", "run-1");
    expect((await store.saveAttempt(attempt)).ok).toBe(true);
    expect(await store.getAttempt(runAttemptId("attempt-1"))).toEqual(attempt);
  });

  it("lists attempts for a run", async () => {
    const store = createFileRunStore(baseDir);
    await store.saveAttempt(makeAttempt("a1", "run-1"));
    await store.saveAttempt(makeAttempt("a2", "run-2"));
    await store.saveAttempt(makeAttempt("a3", "run-1"));
    const listed = await store.listAttempts(evaluationRunId("run-1"));
    expect(listed).toHaveLength(2);
  });

  it("returns empty attempts when attempts directory is missing", async () => {
    const store = createFileRunStore(baseDir);
    expect(await store.listAttempts(evaluationRunId("run-1"))).toEqual([]);
  });

  it("rejects invalid attempt id on save", async () => {
    const store = createFileRunStore(baseDir);
    const attempt = {
      ...makeAttempt("a1", "run-1"),
      attemptId: "../bad" as ReturnType<typeof runAttemptId>,
    };
    expect((await store.saveAttempt(attempt)).ok).toBe(false);
  });
});

describe("File claim ledger", () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "eval-claim-ledger-"));
  });

  afterEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  it("appends entries and verifies chain", async () => {
    const ledger = createFileClaimLedger(baseDir);
    const e1 = makeLedgerEntry("c1", "digest-1");
    const e2 = makeLedgerEntry("c1", "digest-2", "digest-1");
    expect((await ledger.append(e1)).ok).toBe(true);
    expect((await ledger.append(e2)).ok).toBe(true);
    expect((await ledger.verifyChain()).ok).toBe(true);
  });

  it("rejects append with broken previous digest", async () => {
    const ledger = createFileClaimLedger(baseDir);
    await ledger.append(makeLedgerEntry("c1", "digest-1"));
    const bad = makeLedgerEntry("c1", "digest-2", "wrong-previous");
    const result = await ledger.append(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations[0]!.code).toBe("ledger_chain_broken");
  });

  it("filters history by claim reference", async () => {
    const ledger = createFileClaimLedger(baseDir);
    await ledger.append(makeLedgerEntry("c1", "d1"));
    await ledger.append(makeLedgerEntry("c2", "d2", "d1"));
    await ledger.append(makeLedgerEntry("c1", "d3", "d2"));
    const history = await ledger.getHistory(evaluationClaimId("c1"));
    expect(history).toHaveLength(2);
  });

  it("returns latest decision for a claim", async () => {
    const ledger = createFileClaimLedger(baseDir);
    await ledger.append(makeLedgerEntry("c1", "d1"));
    await ledger.append({
      ...makeLedgerEntry("c1", "d2", "d1"),
      action: "decided",
      decision: {
        claimRef: evaluationClaimId("c1"),
        protocolRef: evaluationProtocolId("p1"),
        analysisRefs: [aggregateAnalysisId("a1")],
        status: "supported",
        guardrailViolations: [],
        evidenceRoot: d("root-d"),
        reviewerAttestations: [],
        limitations: [],
        applicability: "all",
        decidedAt: "2026-01-02",
        publishedAt: undefined,
        supersedes: undefined,
        retractionReason: undefined,
        signatureRefs: [],
      },
    });
    const latest = await ledger.getLatestDecision(evaluationClaimId("c1"));
    expect(latest?.status).toBe("supported");
  });

  it("detects broken chain on verify", async () => {
    const ledger = createFileClaimLedger(baseDir);
    await ledger.append(makeLedgerEntry("c1", "d1"));
    const ledgerFile = path.join(baseDir, "claim-ledger.jsonl");
    await fs.appendFile(ledgerFile, JSON.stringify(makeLedgerEntry("c1", "d2", "broken")) + "\n");
    const result = await ledger.verifyChain();
    expect(result.ok).toBe(false);
  });

  it("rejects corrupted ledger line on read", async () => {
    const ledger = createFileClaimLedger(baseDir);
    await fs.mkdir(baseDir, { recursive: true });
    await fs.writeFile(path.join(baseDir, "claim-ledger.jsonl"), "not-json\n");
    await expect(ledger.getHistory(evaluationClaimId("c1"))).rejects.toThrow(
      /Corrupted ledger entry/,
    );
  });
});

describe("File content-addressed store", () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "eval-cas-"));
  });

  afterEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  it("stores and retrieves content by digest", async () => {
    const cas = createFileContentAddressedStore(baseDir);
    const data = new TextEncoder().encode("evaluation payload");
    const putResult = await cas.put(data);
    expect(putResult.ok).toBe(true);
    if (!putResult.ok) return;
    expect(await cas.has(putResult.value)).toBe(true);
    const getResult = await cas.get(putResult.value);
    expect(getResult.ok).toBe(true);
    if (getResult.ok) {
      expect(new TextDecoder().decode(getResult.value)).toBe("evaluation payload");
    }
  });

  it("returns violation for missing content", async () => {
    const cas = createFileContentAddressedStore(baseDir);
    const result = await cas.get(d("0".repeat(64)));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations[0]!.code).toBe("evidence_digest_mismatch");
  });

  it("reports false for missing digest on has", async () => {
    const cas = createFileContentAddressedStore(baseDir);
    expect(await cas.has(d("deadbeef".padEnd(64, "0")))).toBe(false);
  });
});
