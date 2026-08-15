import { describe, it, expect } from "vitest";
import { createMemorySuiteRegistry } from "../../src/adapters/memory/memorySuiteRegistry.js";
import { createMemoryRunStore } from "../../src/adapters/memory/memoryRunStore.js";
import { createMemoryClaimLedger } from "../../src/adapters/memory/memoryClaimLedger.js";
import { createMemoryContentAddressedStore } from "../../src/adapters/memory/memoryContentAddressedStore.js";
import { createMemoryResultStore } from "../../src/adapters/memory/memoryResultStore.js";
import { createMemoryBudgetLedger } from "../../src/adapters/memory/memoryBudgetLedger.js";
import {
  benchmarkSuiteId,
  evaluationClaimId,
  evaluationRunId,
  evaluationRunPlanId,
  runAttemptId,
  metricObservationId,
  metricId,
  benchmarkCaseId,
  evaluationSubjectId,
  budgetPolicyId,
  evaluationProtocolId,
  aggregateAnalysisId,
  scorerRef,
} from "../../src/foundation/evaluationIds.js";
import type { BenchmarkSuite, BenchmarkCase } from "../../src/benchmarks/benchmarkSuite.js";
import type { EvaluationRun } from "../../src/execution/evaluationRun.js";
import type { MetricObservation } from "../../src/scoring/metricObservation.js";
import type { ContentDigest } from "@cantilune/core";
import type { ClaimDecision } from "../../src/review/claimDecision.js";

const d = (s: string) => s as ContentDigest;

function makeSuite(id: string): BenchmarkSuite {
  return {
    suiteId: benchmarkSuiteId(id),
    suiteVersion: 1,
    name: "test-suite",
    description: "test",
    claimRefs: [],
    caseManifestRefs: [],
    datasetRefs: [],
    coverageTaxonomy: [],
    requiredStrata: [],
    samplingPolicy: "census",
    defaultRunPolicy: "default",
    defaultScoringPolicy: "default",
    defaultBudgetPolicy: "default",
    provenanceRef: "",
    licenseRef: "",
    privacyReviewRef: "",
    suiteDigest: d("sd"),
    status: "draft",
    frozenAt: undefined,
    supersedes: undefined,
  };
}

describe("Memory suite registry", () => {
  it("registers and retrieves suite", async () => {
    const reg = createMemorySuiteRegistry();
    const s = makeSuite("s1");
    const result = await reg.register(s);
    expect(result.ok).toBe(true);
    expect(await reg.get(benchmarkSuiteId("s1"))).toBeDefined();
  });

  it("rejects duplicate registration", async () => {
    const reg = createMemorySuiteRegistry();
    await reg.register(makeSuite("s1"));
    const result = await reg.register(makeSuite("s1"));
    expect(result.ok).toBe(false);
  });

  it("lists all suites", async () => {
    const reg = createMemorySuiteRegistry();
    await reg.register(makeSuite("s1"));
    await reg.register(makeSuite("s2"));
    expect(await reg.listAll()).toHaveLength(2);
  });

  it("registers and retrieves benchmark cases", async () => {
    const reg = createMemorySuiteRegistry();
    await reg.register(makeSuite("s1"));
    const benchmarkCase: BenchmarkCase = {
      caseId: benchmarkCaseId("case-1"),
      suiteId: benchmarkSuiteId("s1"),
      caseVersion: 1,
      caseKind: "structural",
      claimRefs: [],
      tags: [],
      stratum: "default",
      inputArtifactRefs: ["input-1"],
      initialSnapshotRef: "snap-0",
      schemaBindingRef: "schema-1",
      policyRef: "policy-1",
      requiredCapabilities: [],
      requiredTools: [],
      networkPolicy: "deny",
      filesystemPolicy: "deny",
      semanticOracleRefs: [],
      successPredicateRef: "pred-1",
      expectedTerminalClasses: ["success"],
      resourceCaps: {
        maxTokensInput: 1000,
        maxTokensOutput: 500,
        maxToolCalls: 10,
        maxNetworkRequests: 0,
        maxFilesystemOps: 0,
        maxCostCents: 100,
      },
      maxStructuralSteps: 100,
      maxExecutionEpochs: 10,
      engineeringTimeout: 60000,
      redactionPolicyRef: "redact-1",
      caseDigest: d("case-d"),
    };
    const result = await reg.registerCase(benchmarkCase);
    expect(result.ok).toBe(true);
    expect(await reg.getCase(benchmarkCaseId("case-1"))).toEqual(benchmarkCase);
    expect(await reg.getCases(benchmarkSuiteId("s1"))).toHaveLength(1);
  });

  it("rejects duplicate case registration", async () => {
    const reg = createMemorySuiteRegistry();
    await reg.register(makeSuite("s1"));
    const benchmarkCase: BenchmarkCase = {
      caseId: benchmarkCaseId("case-1"),
      suiteId: benchmarkSuiteId("s1"),
      caseVersion: 1,
      caseKind: "structural",
      claimRefs: [],
      tags: [],
      stratum: "default",
      inputArtifactRefs: [],
      initialSnapshotRef: "snap-0",
      schemaBindingRef: "schema-1",
      policyRef: "policy-1",
      requiredCapabilities: [],
      requiredTools: [],
      networkPolicy: "deny",
      filesystemPolicy: "deny",
      semanticOracleRefs: [],
      successPredicateRef: "pred-1",
      expectedTerminalClasses: [],
      resourceCaps: {
        maxTokensInput: 1,
        maxTokensOutput: 1,
        maxToolCalls: 1,
        maxNetworkRequests: 0,
        maxFilesystemOps: 0,
        maxCostCents: 1,
      },
      maxStructuralSteps: 1,
      maxExecutionEpochs: 1,
      engineeringTimeout: 1000,
      redactionPolicyRef: "redact-1",
      caseDigest: d("case-d"),
    };
    await reg.registerCase(benchmarkCase);
    const result = await reg.registerCase(benchmarkCase);
    expect(result.ok).toBe(false);
  });

  it("rejects case registration without parent suite", async () => {
    const reg = createMemorySuiteRegistry();
    const benchmarkCase: BenchmarkCase = {
      caseId: benchmarkCaseId("case-1"),
      suiteId: benchmarkSuiteId("missing"),
      caseVersion: 1,
      caseKind: "structural",
      claimRefs: [],
      tags: [],
      stratum: "default",
      inputArtifactRefs: [],
      initialSnapshotRef: "snap-0",
      schemaBindingRef: "schema-1",
      policyRef: "policy-1",
      requiredCapabilities: [],
      requiredTools: [],
      networkPolicy: "deny",
      filesystemPolicy: "deny",
      semanticOracleRefs: [],
      successPredicateRef: "pred-1",
      expectedTerminalClasses: [],
      resourceCaps: {
        maxTokensInput: 1,
        maxTokensOutput: 1,
        maxToolCalls: 1,
        maxNetworkRequests: 0,
        maxFilesystemOps: 0,
        maxCostCents: 1,
      },
      maxStructuralSteps: 1,
      maxExecutionEpochs: 1,
      engineeringTimeout: 1000,
      redactionPolicyRef: "redact-1",
      caseDigest: d("case-d"),
    };
    const result = await reg.registerCase(benchmarkCase);
    expect(result.ok).toBe(false);
  });
});

describe("Memory run store", () => {
  it("saves and retrieves run", async () => {
    const store = createMemoryRunStore();
    const run: EvaluationRun = {
      runId: evaluationRunId("r1"),
      planRef: evaluationRunPlanId("p1"),
      planDigest: d("pd"),
      subjectRef: evaluationSubjectId("sub1"),
      status: "admitted",
      attemptIds: [],
      currentAttemptId: undefined,
      startedAt: "2026-01-01",
      endedAt: undefined,
      runDigest: d("rd"),
    };
    await store.save(run);
    expect(await store.get(evaluationRunId("r1"))).toEqual(run);
  });

  it("lists runs by plan", async () => {
    const store = createMemoryRunStore();
    const run: EvaluationRun = {
      runId: evaluationRunId("r1"),
      planRef: evaluationRunPlanId("plan-1"),
      planDigest: d("pd"),
      subjectRef: evaluationSubjectId("sub1"),
      status: "admitted",
      attemptIds: [],
      currentAttemptId: undefined,
      startedAt: "2026-01-01",
      endedAt: undefined,
      runDigest: d("rd"),
    };
    await store.save(run);
    expect(await store.listByPlan("plan-1")).toHaveLength(1);
    expect(await store.listByPlan("plan-2")).toHaveLength(0);
  });
});

describe("Memory CAS", () => {
  it("stores and retrieves content by digest", async () => {
    const cas = createMemoryContentAddressedStore();
    const data = new TextEncoder().encode("hello world");
    const result = await cas.put(data);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(await cas.has(result.value)).toBe(true);
      const getResult = await cas.get(result.value);
      expect(getResult.ok).toBe(true);
      if (getResult.ok) {
        expect(new TextDecoder().decode(getResult.value)).toBe("hello world");
      }
    }
  });

  it("returns violation for missing content", async () => {
    const cas = createMemoryContentAddressedStore();
    const result = await cas.get(d("nonexistent"));
    expect(result.ok).toBe(false);
  });
});

describe("Memory claim ledger", () => {
  it("appends and retrieves entries", async () => {
    const ledger = createMemoryClaimLedger();
    const entry = {
      claimRef: evaluationClaimId("c1"),
      action: "protocolFrozen" as const,
      decision: undefined,
      previousDigest: undefined,
      entryDigest: d("ed"),
      timestamp: "2026-01-01",
    };
    await ledger.append(entry);
    const history = await ledger.getHistory(evaluationClaimId("c1"));
    expect(history).toHaveLength(1);
  });

  it("verifies chain (noop for memory)", async () => {
    const ledger = createMemoryClaimLedger();
    const result = await ledger.verifyChain();
    expect(result.ok).toBe(true);
  });

  it("rejects append with broken previous digest", async () => {
    const ledger = createMemoryClaimLedger();
    await ledger.append({
      claimRef: evaluationClaimId("c1"),
      action: "protocolFrozen",
      decision: undefined,
      previousDigest: undefined,
      entryDigest: d("ed1"),
      timestamp: "2026-01-01",
    });
    const result = await ledger.append({
      claimRef: evaluationClaimId("c1"),
      action: "measured",
      decision: undefined,
      previousDigest: d("wrong"),
      entryDigest: d("ed2"),
      timestamp: "2026-01-02",
    });
    expect(result.ok).toBe(false);
  });

  it("returns latest decision for a claim", async () => {
    const ledger = createMemoryClaimLedger();
    const decision: ClaimDecision = {
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
    };
    await ledger.append({
      claimRef: evaluationClaimId("c1"),
      action: "protocolFrozen",
      decision: undefined,
      previousDigest: undefined,
      entryDigest: d("ed1"),
      timestamp: "2026-01-01",
    });
    await ledger.append({
      claimRef: evaluationClaimId("c1"),
      action: "decided",
      decision,
      previousDigest: d("ed1"),
      entryDigest: d("ed2"),
      timestamp: "2026-01-02",
    });
    expect(await ledger.getLatestDecision(evaluationClaimId("c1"))).toEqual(decision);
  });
});

describe("Memory result store", () => {
  it("saves and retrieves observations", async () => {
    const store = createMemoryResultStore();
    const obs: MetricObservation = {
      observationId: metricObservationId("obs1"),
      metricRef: metricId("m1"),
      runId: evaluationRunId("r1"),
      attemptId: runAttemptId("a1"),
      caseRef: benchmarkCaseId("c1"),
      subjectRef: evaluationSubjectId("s1"),
      rawValue: 0.95,
      normalizedValue: 0.95,
      unit: "ratio",
      numerator: 95,
      denominator: 100,
      scorerRef: scorerRef("scorer"),
      judgeRef: undefined,
      evidenceRefs: [],
      status: "valid",
      computedAt: "2026-01-01",
      rowDigest: d("od"),
    };
    await store.saveObservation(obs);
    expect(await store.getObservations(evaluationRunId("r1"))).toHaveLength(1);
    expect(await store.getObservationsByMetric("m1")).toHaveLength(1);
  });
});

describe("Memory budget ledger", () => {
  it("saves and retrieves budget ledger", async () => {
    const port = createMemoryBudgetLedger();
    const pid = budgetPolicyId("bp1");
    const ledger = {
      policyRef: pid,
      reservedCostCents: 0,
      actualCostCents: 0,
      reconciledCostCents: 0,
      reservedRuns: 0,
      completedRuns: 0,
      reservedTokens: 0,
      usedTokens: 0,
      costReceiptRefs: [] as string[],
      lastReconciledAt: undefined,
    };
    await port.save(ledger);
    expect(await port.get(pid)).toEqual(ledger);
  });
});
