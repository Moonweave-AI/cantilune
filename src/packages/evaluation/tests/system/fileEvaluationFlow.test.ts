import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { createEvaluationEngine } from "../../src/execution/evaluationEngine.js";
import type { EvaluationEnginePorts } from "../../src/execution/evaluationEngine.js";
import { createFileRunStore } from "../../src/adapters/file/fileRunStore.js";
import { createFileContentAddressedStore } from "../../src/adapters/file/fileContentAddressedStore.js";
import { createFileLeaseCoordinator } from "../../src/adapters/file/fileLeaseCoordinator.js";
import { createMemoryBudgetLedger } from "../../src/adapters/memory/memoryBudgetLedger.js";
import { createMemorySuiteRegistry } from "../../src/adapters/memory/memorySuiteRegistry.js";
import { createCantiluneC9Resolver } from "../../src/adapters/cantilune/cantiluneC9Resolver.js";
import {
  evaluationRunPlanId,
  evaluationClaimId,
  evaluationProtocolId,
  benchmarkSuiteId,
  benchmarkCaseId,
  evaluationSubjectId,
  budgetPolicyId,
} from "../../src/foundation/evaluationIds.js";
import type { EvaluationRunPlan } from "../../src/plans/evaluationRunPlan.js";
import type { CandidateSubject } from "../../src/subjects/evaluationSubject.js";
import type { EvaluationBudgetPolicy } from "../../src/budget/evaluationBudget.js";
import type { CandidateRunner, RunnerConfig } from "../../src/ports/executionPorts.js";
import type { ResolvedCertificate } from "../../src/ports/productEvidence.js";
import type { Clock } from "../../src/ports/stateGovernance.js";
import type { ContentDigest } from "@cantilune/core";

const d = (s: string) => s as ContentDigest;

describe("File-backed evaluation system flow", () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "eval-system-"));
  });

  afterEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true });
  });

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

    const candidateRunner: CandidateRunner = {
      async execute(_config: RunnerConfig) {
        return {
          ok: true as const,
          value: {
            outputRefs: ["output-1"],
            traceRef: "trace-1",
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
            environmentCaptureRef: "env-1",
            resultDigest: d("result-d"),
          },
        };
      },
    };

    return {
      runStore: createFileRunStore(baseDir),
      cas: createFileContentAddressedStore(path.join(baseDir, "cas")),
      clock,
      budgetLedger: createMemoryBudgetLedger(),
      candidateRunner,
      baselineRunner: candidateRunner,
      certificateResolver: createCantiluneC9Resolver({
        async getCertificate(ref) {
          return ref === "cert-1" ? resolvedCert : undefined;
        },
      }),
      suiteRegistry: createMemorySuiteRegistry(),
      leaseCoordinator: createFileLeaseCoordinator(baseDir),
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
      retryPolicy: { maxRetries: 1, retryableFailures: [], backoffMs: 100 },
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

  it("persists admitted run and attempt to disk then completes run", async () => {
    const ports = makePorts();
    const engine = createEvaluationEngine(ports);
    const admitResult = await engine.admitRun(makePlan(), makeCandidate(), makeBudgetPolicy());
    expect(admitResult.ok).toBe(true);
    if (!admitResult.ok) return;

    const runId = admitResult.value.run.runId;
    const attemptResult = await engine.executeAttempt(runId, benchmarkCaseId("case-1"), 42);
    expect(attemptResult.ok).toBe(true);

    const reloadedRun = await ports.runStore.get(runId);
    expect(reloadedRun?.attemptIds.length).toBeGreaterThan(0);
    expect(await ports.runStore.listAttempts(runId)).toHaveLength(1);

    const completeResult = await engine.completeRun(runId);
    expect(completeResult.ok).toBe(true);
    if (completeResult.ok) expect(completeResult.value.status).toBe("collecting");

    const casPayload = new TextEncoder().encode("artifact");
    const putResult = await ports.cas.put(casPayload);
    expect(putResult.ok).toBe(true);
  });

  it("survives reload from fresh store instance on same base directory", async () => {
    const ports = makePorts();
    const engine = createEvaluationEngine(ports);
    const admitResult = await engine.admitRun(makePlan(), makeCandidate(), makeBudgetPolicy());
    if (!admitResult.ok) return;
    const runId = admitResult.value.run.runId;

    const reloadedStore = createFileRunStore(baseDir);
    const persisted = await reloadedStore.get(runId);
    expect(persisted?.runId).toBe(runId);
    expect(persisted?.status).toBe("admitted");
  });
});
