import { describe, it, expect } from "vitest";
import { createEvaluationEngine } from "../../src/execution/evaluationEngine.js";
import type { EvaluationEnginePorts } from "../../src/execution/evaluationEngine.js";
import { createMemoryRunStore } from "../../src/adapters/memory/memoryRunStore.js";
import { createMemoryContentAddressedStore } from "../../src/adapters/memory/memoryContentAddressedStore.js";
import { createMemoryBudgetLedger } from "../../src/adapters/memory/memoryBudgetLedger.js";
import { createMemorySuiteRegistry } from "../../src/adapters/memory/memorySuiteRegistry.js";
import {
  evaluationRunPlanId,
  evaluationClaimId,
  evaluationProtocolId,
  benchmarkSuiteId,
  benchmarkCaseId,
  evaluationSubjectId,
  budgetPolicyId,
  evaluationRunId,
} from "../../src/foundation/evaluationIds.js";
import type { EvaluationRunPlan } from "../../src/plans/evaluationRunPlan.js";
import type { CandidateSubject } from "../../src/subjects/evaluationSubject.js";
import type { EvaluationBudgetPolicy } from "../../src/budget/evaluationBudget.js";
import type { CandidateRunner, RunnerConfig } from "../../src/ports/executionPorts.js";
import type {
  ConformanceCertificateResolver,
  ResolvedCertificate,
} from "../../src/ports/productEvidence.js";
import type { ContentDigest } from "@cantilune/core";
import type { Clock } from "../../src/ports/stateGovernance.js";

const d = (s: string) => s as ContentDigest;

function makePorts(): EvaluationEnginePorts {
  const clock: Clock = {
    now: () => new Date().toISOString(),
    nowMs: () => Date.now(),
  };

  const resolvedCert: ResolvedCertificate = {
    certificateDigest: d("cd"),
    artifactSubjectDigest: d("asd"),
    verifierBuild: "v1",
    policyVersion: "p1",
    evidenceRootDigest: d("erd"),
    issuedAt: "2026-01-01",
    expiresAt: "2027-01-01",
    status: "valid",
  };

  const certResolver: ConformanceCertificateResolver = {
    async resolve() {
      return { ok: true as const, value: resolvedCert };
    },
    async checkValidity() {
      return "valid";
    },
    async checkRevocation() {
      return false;
    },
  };

  const candidateRunner: CandidateRunner = {
    async execute(_config: RunnerConfig) {
      return {
        ok: true as const,
        value: {
          outputRefs: ["output-1"],
          traceRef: "trace-1",
          wallTimeMs: 1000,
          tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          toolUsage: { toolCalls: 2, toolErrors: 0 },
          cost: {
            modelCostCents: 10,
            toolCostCents: 2,
            networkCostCents: 1,
            totalCostCents: 13,
            currency: "USD",
            receiptRefs: ["receipt-1"],
          },
          terminalDisposition: "success",
          environmentCaptureRef: "env-1",
          resultDigest: d("result-d"),
        },
      };
    },
  };

  return {
    runStore: createMemoryRunStore(),
    cas: createMemoryContentAddressedStore(),
    clock,
    budgetLedger: createMemoryBudgetLedger(),
    candidateRunner,
    baselineRunner: candidateRunner,
    certificateResolver: certResolver,
    suiteRegistry: createMemorySuiteRegistry(),
    leaseCoordinator: undefined,
  };
}

function makePlan(): EvaluationRunPlan {
  return {
    planId: evaluationRunPlanId("plan-1"),
    protocolRef: evaluationProtocolId("proto-1"),
    claimRefs: [evaluationClaimId("c1")],
    suiteRef: benchmarkSuiteId("suite-1"),
    caseSelection: { mode: "all", caseIds: undefined, strata: undefined, maxCases: undefined },
    datasetSplitRefs: [],
    candidateSubjectRef: evaluationSubjectId("s1"),
    baselineSubjectRefs: [],
    pairedExecution: false,
    blockingFactors: [],
    randomizationOrder: [],
    blinding: {
      candidateBlinded: true,
      baselineBlinded: true,
      judgeBlinded: true,
      presentationRandomized: true,
    },
    seeds: [42],
    repetitions: 1,
    modelProviderRevisions: [],
    promptDigests: [],
    rubricRefs: [],
    toolManifestRefs: [],
    concurrency: 1,
    retryPolicy: { maxRetries: 3, retryableFailures: ["timeout"], backoffMs: 1000 },
    timeoutPolicy: { perCaseMs: 60000, perRunMs: 3600000, totalMs: 86400000 },
    environmentManifest: "env-1",
    hardwareManifest: "hw-1",
    budgetPolicyRef: budgetPolicyId("bp-1"),
    judgeProtocolRefs: [],
    redactionPolicyRef: "redact-1",
    exclusionPolicy: "none",
    planDigest: d("plan-d"),
    frozenAt: "2026-01-15",
  };
}

function makeCandidate(): CandidateSubject {
  return {
    subjectId: evaluationSubjectId("s1"),
    subjectKind: "candidate",
    packageConformanceCertificateRef: "cert-1",
    certificateDigest: d("cd"),
    artifactSubject: {
      packageName: "@cantilune/core",
      packageVersion: "0.0.1",
      commitSha: "abc123",
      treeDigest: d("td"),
      artifactDigest: d("ad"),
      lockfileDigest: d("ld"),
      toolchainDigest: d("tcd"),
      buildProvenanceDigest: d("bpd"),
    },
    packageConfigurationRef: "config-1",
    schemaBindingRef: "schema-1",
    policyRef: "policy-1",
    runtimeConfigRef: "runtime-1",
    controlPlaneConfigRef: "cp-1",
    commsConfigRef: "comms-1",
    adapterBuild: "build-1",
    adapterDigest: d("adapter-d"),
    certificateValidity: "valid",
    revocationCheckpoint: "checkpoint-1",
    subjectDigest: d("subject-d"),
  };
}

function makeBudgetPolicy(): EvaluationBudgetPolicy {
  return {
    policyId: budgetPolicyId("bp-1"),
    maxRuns: 100,
    maxCases: 1000,
    maxConcurrency: 8,
    maxInputTokens: 1000000,
    maxOutputTokens: 500000,
    maxModelCostCents: 10000,
    maxToolCostCents: 2000,
    maxNetworkCostCents: 1000,
    maxTotalCostCents: 15000,
    maxWallTimeMs: 86400000,
    maxRetries: 5,
    providerQuotas: [],
    suiteQuotas: [],
    dailyLimitCents: 50000,
    monthlyLimitCents: 500000,
    hardKillEnabled: true,
    safeStateOnKill: true,
    policyDigest: d("budget-d"),
  };
}

describe("Evaluation engine integration", () => {
  it("admits a run with valid plan and certificate", async () => {
    const ports = makePorts();
    const engine = createEvaluationEngine(ports);
    const result = await engine.admitRun(makePlan(), makeCandidate(), makeBudgetPolicy());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.run.status).toBe("admitted");
      expect(result.value.token.planDigest).toBe(d("plan-d"));
    }
  });

  it("rejects run with unfrozen plan", async () => {
    const ports = makePorts();
    const engine = createEvaluationEngine(ports);
    const unfrozenPlan = { ...makePlan(), frozenAt: undefined };
    const result = await engine.admitRun(unfrozenPlan, makeCandidate(), makeBudgetPolicy());
    expect(result.ok).toBe(false);
  });

  it("rejects run with subject mismatch", async () => {
    const ports = makePorts();
    const engine = createEvaluationEngine(ports);
    const mismatchCandidate = {
      ...makeCandidate(),
      subjectId: evaluationSubjectId("other-subject"),
    };
    const result = await engine.admitRun(makePlan(), mismatchCandidate, makeBudgetPolicy());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations[0]!.code).toBe("subject_digest_mismatch");
    }
  });

  it("rejects paired execution with no baselines", async () => {
    const ports = makePorts();
    const engine = createEvaluationEngine(ports);
    const pairedPlan = { ...makePlan(), pairedExecution: true, baselineSubjectRefs: [] };
    const result = await engine.admitRun(pairedPlan, makeCandidate(), makeBudgetPolicy());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations[0]!.code).toBe("invalid_input");
    }
  });

  it("rejects run with certificate digest mismatch", async () => {
    const ports = makePorts();
    const engine = createEvaluationEngine(ports);
    const mismatchCandidate = { ...makeCandidate(), certificateDigest: d("wrong-digest") };
    const result = await engine.admitRun(makePlan(), mismatchCandidate, makeBudgetPolicy());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations[0]!.code).toBe("subject_digest_mismatch");
    }
  });

  it("rejects run with revoked certificate", async () => {
    const ports = makePorts();
    ports.certificateResolver.checkRevocation = async () => true;
    const engine = createEvaluationEngine(ports);
    const result = await engine.admitRun(makePlan(), makeCandidate(), makeBudgetPolicy());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations[0]!.code).toBe("subject_certificate_revoked");
    }
  });

  it("executes an attempt after admission (no caller runner/config)", async () => {
    const ports = makePorts();
    const engine = createEvaluationEngine(ports);
    const admitResult = await engine.admitRun(makePlan(), makeCandidate(), makeBudgetPolicy());
    expect(admitResult.ok).toBe(true);
    if (!admitResult.ok) return;

    const attemptResult = await engine.executeAttempt(
      admitResult.value.run.runId,
      benchmarkCaseId("case-1"),
      42,
    );
    expect(attemptResult.ok).toBe(true);
    if (attemptResult.ok) {
      expect(attemptResult.value.status).toBe("succeeded");
      expect(attemptResult.value.tokenUsage.totalTokens).toBe(150);
    }
  });

  it("completes a run after execution", async () => {
    const ports = makePorts();
    const engine = createEvaluationEngine(ports);
    const admitResult = await engine.admitRun(makePlan(), makeCandidate(), makeBudgetPolicy());
    if (!admitResult.ok) return;

    await engine.executeAttempt(admitResult.value.run.runId, benchmarkCaseId("case-1"), 42);

    const completeResult = await engine.completeRun(admitResult.value.run.runId);
    expect(completeResult.ok).toBe(true);
    if (completeResult.ok) {
      expect(completeResult.value.status).toBe("collecting");
    }
  });

  it("propagates runner failure as violations", async () => {
    const ports = {
      ...makePorts(),
      candidateRunner: {
        async execute(): Promise<{
          ok: false;
          violations: [{ code: "internal_error"; path: string; message: string }];
        }> {
          return {
            ok: false as const,
            violations: [
              { code: "internal_error" as const, path: "runner", message: "Runner crashed" },
            ],
          };
        },
      },
    };
    const engine = createEvaluationEngine(ports);
    const admitResult = await engine.admitRun(makePlan(), makeCandidate(), makeBudgetPolicy());
    if (!admitResult.ok) return;

    const attemptResult = await engine.executeAttempt(
      admitResult.value.run.runId,
      benchmarkCaseId("case-1"),
      42,
    );
    expect(attemptResult.ok).toBe(false);
    if (!attemptResult.ok) {
      expect(attemptResult.violations[0]!.code).toBe("internal_error");
    }
  });

  it("rejects executeAttempt for missing run", async () => {
    const engine = createEvaluationEngine(makePorts());
    const result = await engine.executeAttempt(
      evaluationRunId("missing-run"),
      benchmarkCaseId("case-1"),
      42,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects completeRun for missing run", async () => {
    const engine = createEvaluationEngine(makePorts());
    const result = await engine.completeRun(evaluationRunId("missing-run"));
    expect(result.ok).toBe(false);
  });

  it("rejects run with expired certificate", async () => {
    const ports = makePorts();
    ports.certificateResolver.resolve = async () => ({
      ok: true,
      value: {
        certificateDigest: d("cd"),
        artifactSubjectDigest: d("asd"),
        verifierBuild: "v1",
        policyVersion: "p1",
        evidenceRootDigest: d("erd"),
        issuedAt: "2020-01-01",
        expiresAt: "2020-01-02",
        status: "valid",
      },
    });
    const engine = createEvaluationEngine(ports);
    const result = await engine.admitRun(makePlan(), makeCandidate(), makeBudgetPolicy());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations[0]!.code).toBe("subject_certificate_expired");
  });

  it("rejects run with invalid certificate status", async () => {
    const ports = makePorts();
    ports.certificateResolver.resolve = async () => ({
      ok: true,
      value: {
        certificateDigest: d("cd"),
        artifactSubjectDigest: d("asd"),
        verifierBuild: "v1",
        policyVersion: "p1",
        evidenceRootDigest: d("erd"),
        issuedAt: "2026-01-01",
        expiresAt: "2027-01-01",
        status: "revoked",
      },
    });
    const engine = createEvaluationEngine(ports);
    const result = await engine.admitRun(makePlan(), makeCandidate(), makeBudgetPolicy());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations[0]!.code).toBe("subject_certificate_invalid");
  });

  it("rejects run when certificate resolve fails", async () => {
    const ports = makePorts();
    ports.certificateResolver.resolve = async () => ({
      ok: false,
      violations: [
        { code: "subject_certificate_invalid" as const, path: "cert", message: "missing" },
      ],
    });
    const engine = createEvaluationEngine(ports);
    const result = await engine.admitRun(makePlan(), makeCandidate(), makeBudgetPolicy());
    expect(result.ok).toBe(false);
  });

  it("rejects executeAttempt when run is not executable", async () => {
    const ports = makePorts();
    const engine = createEvaluationEngine(ports);
    const admitResult = await engine.admitRun(makePlan(), makeCandidate(), makeBudgetPolicy());
    if (!admitResult.ok) return;
    await engine.executeAttempt(admitResult.value.run.runId, benchmarkCaseId("case-1"), 42);
    await engine.completeRun(admitResult.value.run.runId);
    const result = await engine.executeAttempt(
      admitResult.value.run.runId,
      benchmarkCaseId("case-1"),
      42,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations[0]!.code).toBe("run_not_admitted");
  });

  it("rejects admission when budget reservation fails", async () => {
    const ports = makePorts();
    const exhaustedPolicy = makeBudgetPolicy();
    await ports.budgetLedger.save({
      policyRef: exhaustedPolicy.policyId,
      reservedCostCents: 15000,
      actualCostCents: 0,
      reconciledCostCents: 0,
      reservedRuns: 0,
      completedRuns: 0,
      reservedTokens: 0,
      usedTokens: 0,
      costReceiptRefs: [],
      lastReconciledAt: undefined,
    });
    const engine = createEvaluationEngine(ports);
    const result = await engine.admitRun(makePlan(), makeCandidate(), exhaustedPolicy);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations[0]!.code).toBe("budget_reserve_failed");
  });
});
