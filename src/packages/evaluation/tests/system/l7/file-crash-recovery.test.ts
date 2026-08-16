import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { contentDigest } from "@cantilune/core";
import { createFileLeaseCoordinator } from "../../../src/adapters/file/fileLeaseCoordinator.js";
import { createFileRunStore } from "../../../src/adapters/file/fileRunStore.js";
import { createFileClaimLedger } from "../../../src/adapters/file/fileClaimLedger.js";
import { createFileContentAddressedStore } from "../../../src/adapters/file/fileContentAddressedStore.js";
import { createEvaluationEngine } from "../../../src/execution/evaluationEngine.js";
import { createCantiluneC9Resolver } from "../../../src/adapters/cantilune/cantiluneC9Resolver.js";
import { createMemoryBudgetLedger } from "../../../src/adapters/memory/memoryBudgetLedger.js";
import { createMemorySuiteRegistry } from "../../../src/adapters/memory/memorySuiteRegistry.js";
import {
  benchmarkCaseId,
  benchmarkSuiteId,
  budgetPolicyId,
  evaluationClaimId,
  evaluationProtocolId,
  evaluationRunPlanId,
  evaluationSubjectId,
  workerId,
} from "../../../src/foundation/evaluationIds.js";
import type { EvaluationRunPlan } from "../../../src/plans/evaluationRunPlan.js";
import type { CandidateSubject } from "../../../src/subjects/evaluationSubject.js";
import type { EvaluationBudgetPolicy } from "../../../src/budget/evaluationBudget.js";
import type { ContentDigest } from "@cantilune/core";

const d = (s: string) => s as ContentDigest;

describe("evaluation L7 file crash recovery", () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "eval-l7-"));
  });

  afterEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  function plan(): EvaluationRunPlan {
    return {
      planId: evaluationRunPlanId("plan-l7"),
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
      seeds: [7],
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

  function candidate(): CandidateSubject {
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

  function budget(): EvaluationBudgetPolicy {
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

  it("does not overwrite a persisted attempt after store reopen", async () => {
    const runStore = createFileRunStore(baseDir);
    const engine = createEvaluationEngine({
      runStore,
      cas: createFileContentAddressedStore(path.join(baseDir, "cas")),
      clock: { now: () => new Date().toISOString(), nowMs: () => Date.now() },
      budgetLedger: createMemoryBudgetLedger(),
      candidateRunner: {
        async execute() {
          return {
            ok: true,
            value: {
              outputRefs: ["out"],
              traceRef: "trace",
              wallTimeMs: 10,
              tokenUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
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
              environmentCaptureRef: "env",
              resultDigest: d("result"),
            },
          };
        },
      },
      baselineRunner: {
        async execute() {
          throw new Error("baseline unused");
        },
      },
      certificateResolver: createCantiluneC9Resolver({
        async getCertificate() {
          return {
            certificateDigest: d("cd"),
            artifactSubjectDigest: d("asd"),
            verifierBuild: "v1",
            policyVersion: "p1",
            evidenceRootDigest: d("erd"),
            issuedAt: "2026-01-01",
            expiresAt: "2027-01-01",
            status: "valid",
          };
        },
      }),
      suiteRegistry: createMemorySuiteRegistry(),
      leaseCoordinator: createFileLeaseCoordinator(baseDir),
    });

    const admitted = await engine.admitRun(plan(), candidate(), budget());
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const runId = admitted.value.run.runId;
    const first = await engine.executeAttempt(runId, benchmarkCaseId("case-1"), 7);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const attemptId = first.value.attemptId;
    const snapshot = JSON.stringify(first.value);

    const reopened = createFileRunStore(baseDir);
    const reloaded = await reopened.getAttempt(attemptId);
    expect(reloaded).toBeDefined();
    expect(JSON.stringify(reloaded)).toBe(snapshot);
    expect((await reopened.listAttempts(runId)).map((a) => a.attemptId)).toEqual([attemptId]);
  });

  it("rejects a second worker lease after process death without release", async () => {
    const first = createFileLeaseCoordinator(baseDir);
    const grant = await first.acquireLease(workerId("worker-a"), 30_000);
    expect(grant.ok).toBe(true);
    if (!grant.ok) return;

    const afterCrash = createFileLeaseCoordinator(baseDir);
    const stolen = await afterCrash.acquireLease(workerId("worker-b"), 30_000);
    expect(stolen.ok).toBe(false);
    if (!stolen.ok) expect(stolen.violations[0]!.code).toBe("run_lease_held");
    expect(
      await afterCrash.validateFencingToken(grant.value.leaseId, grant.value.fencingToken),
    ).toBe(true);
    const stale = await afterCrash.renewLease(grant.value.leaseId, "9:deadbeef" as never, 30_000);
    expect(stale.ok).toBe(false);
  });

  it("keeps the claim ledger chain intact across reopen", async () => {
    const first = createFileClaimLedger(baseDir);
    const firstEntry = {
      claimRef: evaluationClaimId("c-l7"),
      action: "measured" as const,
      decision: undefined,
      previousDigest: undefined,
      entryDigest: contentDigest("entry-1"),
      timestamp: "2026-01-01T00:00:00.000Z",
    };
    expect((await first.append(firstEntry)).ok).toBe(true);

    const second = createFileClaimLedger(baseDir);
    const broken = await second.append({
      ...firstEntry,
      entryDigest: contentDigest("entry-2"),
      previousDigest: contentDigest("wrong-parent"),
    });
    expect(broken.ok).toBe(false);

    const continued = await second.append({
      claimRef: evaluationClaimId("c-l7"),
      action: "published",
      decision: undefined,
      previousDigest: firstEntry.entryDigest,
      entryDigest: contentDigest("entry-2"),
      timestamp: "2026-01-01T00:00:01.000Z",
    });
    expect(continued.ok).toBe(true);
    expect((await second.verifyChain()).ok).toBe(true);
  });
});
