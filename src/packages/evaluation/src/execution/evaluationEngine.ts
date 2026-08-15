import type { ContentDigest } from "@cantilune/core";
import {
  ok,
  violations,
  violation,
  type EvaluationResult,
} from "../foundation/evaluationResult.js";
import {
  evaluationRunId,
  runAttemptId,
  workerId,
  leaseId,
  fencingToken,
  type EvaluationRunId,
  type BenchmarkCaseId,
} from "../foundation/evaluationIds.js";
import type { EvaluationRunPlan } from "../plans/evaluationRunPlan.js";
import type { EvaluationRun, RunAttempt } from "./evaluationRun.js";
import type {
  RunStore,
  ContentAddressedStore,
  Clock,
  BudgetLedgerPort,
} from "../ports/stateGovernance.js";
import type {
  CandidateRunner,
  BaselineRunner,
  RunnerConfig,
  LeaseCoordinator,
} from "../ports/executionPorts.js";
import type { EvaluationBudgetPolicy } from "../budget/evaluationBudget.js";
import { reserveBudget, createEmptyLedger } from "../budget/evaluationBudget.js";
import { transitionRun } from "./runStateMachine.js";
import { _mintAdmittedRunToken, type AdmittedEvaluationRun } from "../foundation/opaqueTokens.js";
import type { CandidateSubject } from "../subjects/evaluationSubject.js";
import type { ConformanceCertificateResolver } from "../ports/productEvidence.js";
import type { SuiteRegistry } from "../ports/benchmarkData.js";

export interface EvaluationEnginePorts {
  readonly runStore: RunStore;
  readonly cas: ContentAddressedStore;
  readonly clock: Clock;
  readonly budgetLedger: BudgetLedgerPort;
  readonly candidateRunner: CandidateRunner;
  readonly baselineRunner: BaselineRunner;
  readonly certificateResolver: ConformanceCertificateResolver;
  readonly suiteRegistry: SuiteRegistry;
  readonly leaseCoordinator: LeaseCoordinator | undefined;
}

export interface EvaluationEngine {
  admitRun(
    plan: EvaluationRunPlan,
    candidateSubject: CandidateSubject,
    budgetPolicy: EvaluationBudgetPolicy,
  ): Promise<EvaluationResult<{ run: EvaluationRun; token: AdmittedEvaluationRun }>>;

  executeAttempt(
    runId: EvaluationRunId,
    caseRef: BenchmarkCaseId,
    seed: number,
  ): Promise<EvaluationResult<RunAttempt>>;

  completeRun(runId: EvaluationRunId): Promise<EvaluationResult<EvaluationRun>>;
}

export function createEvaluationEngine(ports: EvaluationEnginePorts): EvaluationEngine {
  const { runStore, clock, budgetLedger, certificateResolver, candidateRunner, suiteRegistry } =
    ports;

  return {
    async admitRun(
      plan: EvaluationRunPlan,
      candidateSubject: CandidateSubject,
      budgetPolicy: EvaluationBudgetPolicy,
    ): Promise<EvaluationResult<{ run: EvaluationRun; token: AdmittedEvaluationRun }>> {
      if (plan.frozenAt === undefined) {
        return violations([
          violation("plan_digest_mismatch", "plan.frozenAt", "Plan is not frozen"),
        ]);
      }

      if (plan.candidateSubjectRef !== candidateSubject.subjectId) {
        return violations([
          violation(
            "subject_digest_mismatch",
            "plan.candidateSubjectRef",
            "Plan candidate subject does not match provided subject",
          ),
        ]);
      }

      if (plan.pairedExecution && plan.baselineSubjectRefs.length === 0) {
        return violations([
          violation(
            "invalid_input",
            "plan.baselineSubjectRefs",
            "Paired execution requires at least one baseline subject",
          ),
        ]);
      }

      const certResult = await certificateResolver.resolve(
        candidateSubject.packageConformanceCertificateRef,
      );
      if (!certResult.ok) return certResult as EvaluationResult<never>;

      const resolvedCert = certResult.value;

      if (resolvedCert.status !== "valid") {
        return violations([
          violation(
            "subject_certificate_invalid",
            "certificate.status",
            `Certificate status: ${resolvedCert.status}`,
            { status: resolvedCert.status },
          ),
        ]);
      }

      if (resolvedCert.certificateDigest !== candidateSubject.certificateDigest) {
        return violations([
          violation(
            "subject_digest_mismatch",
            "certificate.digest",
            "Certificate digest mismatch between subject and resolved certificate",
          ),
        ]);
      }

      const isRevoked = await certificateResolver.checkRevocation(
        candidateSubject.packageConformanceCertificateRef,
        candidateSubject.revocationCheckpoint,
      );
      if (isRevoked) {
        return violations([
          violation("subject_certificate_revoked", "certificate", "Certificate has been revoked"),
        ]);
      }

      const now = clock.now();
      const nowMs = clock.nowMs();
      if (resolvedCert.expiresAt && new Date(resolvedCert.expiresAt).getTime() < nowMs) {
        return violations([
          violation(
            "subject_certificate_expired",
            "certificate.expiresAt",
            `Certificate expired at ${resolvedCert.expiresAt}`,
          ),
        ]);
      }

      const currentLedger =
        (await budgetLedger.get(budgetPolicy.policyId)) ?? createEmptyLedger(budgetPolicy.policyId);

      const estimatedCost =
        budgetPolicy.maxTotalCostCents > 0
          ? Math.ceil(budgetPolicy.maxTotalCostCents / Math.max(budgetPolicy.maxRuns, 1))
          : 0;
      const estimatedTokens = Math.ceil(
        (budgetPolicy.maxInputTokens + budgetPolicy.maxOutputTokens) /
          Math.max(budgetPolicy.maxRuns, 1),
      );

      const reserveResult = reserveBudget(
        currentLedger,
        budgetPolicy,
        estimatedCost,
        estimatedTokens,
      );
      if (!reserveResult.ok) return reserveResult as EvaluationResult<never>;

      await budgetLedger.save(reserveResult.value);

      const rid = evaluationRunId(generateUUID());

      const run: EvaluationRun = {
        runId: rid,
        planRef: plan.planId,
        planDigest: plan.planDigest,
        subjectRef: candidateSubject.subjectId,
        status: "admitted",
        attemptIds: [],
        currentAttemptId: undefined,
        startedAt: now,
        endedAt: undefined,
        runDigest: plan.planDigest,
      };

      const saveResult = await runStore.save(run);
      if (!saveResult.ok) return saveResult as EvaluationResult<never>;

      const token = _mintAdmittedRunToken(plan.planDigest, now);
      return ok({ run, token });
    },

    async executeAttempt(
      runId: EvaluationRunId,
      caseRef: BenchmarkCaseId,
      seed: number,
    ): Promise<EvaluationResult<RunAttempt>> {
      const run = await runStore.get(runId);
      if (run === undefined) {
        return violations([violation("invalid_input", "run.runId", `Run not found: ${runId}`)]);
      }

      if (run.status === "admitted") {
        const qResult = transitionRun(run.status, "queued");
        if (!qResult.ok) return qResult as EvaluationResult<RunAttempt>;
        const queued: EvaluationRun = { ...run, status: "queued" };
        await runStore.save(queued);

        const lResult = transitionRun("queued", "leased");
        if (!lResult.ok) return lResult as EvaluationResult<RunAttempt>;
        const leased: EvaluationRun = { ...queued, status: "leased" };
        await runStore.save(leased);

        const rResult = transitionRun("leased", "running");
        if (!rResult.ok) return rResult as EvaluationResult<RunAttempt>;
        const running: EvaluationRun = { ...leased, status: "running" };
        await runStore.save(running);
      } else if (run.status !== "running") {
        return violations([
          violation(
            "run_not_admitted",
            "run.status",
            `Run is not in executable state: ${run.status}`,
          ),
        ]);
      }

      const currentRun = (await runStore.get(runId))!;

      const benchmarkCase = await suiteRegistry.getCase(caseRef);
      const config: RunnerConfig = {
        subjectRef: currentRun.subjectRef as string,
        caseRef: caseRef as string,
        inputRefs: benchmarkCase?.inputArtifactRefs ?? [],
        seed,
        timeoutMs: benchmarkCase?.engineeringTimeout ?? 60000,
        networkPolicy: benchmarkCase?.networkPolicy ?? "deny",
        filesystemPolicy: benchmarkCase?.filesystemPolicy ?? "deny",
        toolManifest: benchmarkCase?.requiredTools ?? [],
        environmentRef: "",
      };

      const now = clock.now();
      const aid = runAttemptId(generateUUID());
      const wid = workerId(generateUUID());
      const lid = leaseId(generateUUID());
      const ft = fencingToken(generateUUID());

      const runnerResult = await candidateRunner.execute(config);
      const endedAt = clock.now();

      if (!runnerResult.ok) {
        const failedAttempt: RunAttempt = {
          attemptId: aid,
          runId,
          idempotencyKey: `${runId}-${caseRef}-${seed}`,
          planDigest: currentRun.planDigest,
          subjectRef: currentRun.subjectRef,
          caseRef,
          seed,
          executionOrder: currentRun.attemptIds.length,
          status: "failed",
          workerId: wid,
          leaseId: lid,
          fencingToken: ft,
          startedAt: now,
          endedAt,
          inputRefs: config.inputRefs,
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
          terminalDisposition: "failed",
          failureCategory: "execution_error",
          retryOf: undefined,
          environmentCaptureRef: undefined,
          resultDigest: "" as ContentDigest,
        };
        const saveRes = await runStore.saveAttempt(failedAttempt);
        if (!saveRes.ok) return saveRes as EvaluationResult<RunAttempt>;
        return violations(runnerResult.violations);
      }

      const output = runnerResult.value;
      const attempt: RunAttempt = {
        attemptId: aid,
        runId,
        idempotencyKey: `${runId}-${caseRef}-${seed}`,
        planDigest: currentRun.planDigest,
        subjectRef: currentRun.subjectRef,
        caseRef,
        seed,
        executionOrder: currentRun.attemptIds.length,
        status: "succeeded",
        workerId: wid,
        leaseId: lid,
        fencingToken: ft,
        startedAt: now,
        endedAt,
        inputRefs: config.inputRefs,
        outputRefs: output.outputRefs,
        traceEvidenceRef: output.traceRef,
        observationEvidenceRef: undefined,
        admissionEvidenceRef: undefined,
        communicationEvidenceRef: undefined,
        providerReceiptRefs: [],
        rawArtifactRefs: output.outputRefs,
        sanitizedArtifactRefs: [],
        tokenUsage: output.tokenUsage,
        toolUsage: output.toolUsage,
        networkUsage: { requestCount: 0, totalBytesIn: 0, totalBytesOut: 0 },
        wallTime: output.wallTimeMs,
        cost: output.cost,
        terminalDisposition: output.terminalDisposition,
        failureCategory: undefined,
        retryOf: undefined,
        environmentCaptureRef: output.environmentCaptureRef,
        resultDigest: output.resultDigest,
      };

      const saveRes = await runStore.saveAttempt(attempt);
      if (!saveRes.ok) return saveRes as EvaluationResult<RunAttempt>;

      const updatedRun: EvaluationRun = {
        ...currentRun,
        status: "running",
        attemptIds: [...currentRun.attemptIds, aid],
        currentAttemptId: aid,
      };
      const runSaveRes = await runStore.save(updatedRun);
      if (!runSaveRes.ok) return runSaveRes as EvaluationResult<RunAttempt>;

      return ok(attempt);
    },

    async completeRun(runId: EvaluationRunId): Promise<EvaluationResult<EvaluationRun>> {
      const run = await runStore.get(runId);
      if (run === undefined) {
        return violations([violation("invalid_input", "run.runId", `Run not found: ${runId}`)]);
      }

      const result = transitionRun(run.status, "collecting");
      if (!result.ok) return result as EvaluationResult<EvaluationRun>;

      const updated: EvaluationRun = { ...run, status: "collecting", endedAt: clock.now() };
      const saveRes = await runStore.save(updated);
      if (!saveRes.ok) return saveRes as EvaluationResult<EvaluationRun>;
      return ok(updated);
    },
  };
}

function generateUUID(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
