/**
 * Evaluation harness wiring for the CLI (ADR-0011 / RFC-0004).
 *
 * Builds a real EvaluationEngine from file-durable ports
 * (`@cantilune/evaluation/file`) plus CLI LLM runners. Certificate resolution
 * uses `createCantiluneC9Resolver` fail-closed (no invented `valid` certs).
 * The deprecated local shim remains exported for unit tests only and is never
 * wired into the TUI default path.
 */
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import type { LlmAdapter } from "@cantilune/boot";
import { contentDigest, type ContentDigest } from "@cantilune/core";
import type { ArtifactSubject, PackageConformanceCertificate } from "@cantilune/conformance";
import { createMemoryRevocationStore } from "@cantilune/conformance/memory";
import {
  createEvaluationEngine,
  ok as evalOk,
  violations as evalViolations,
  violation as evalViolation,
  type EvaluationEngine,
  type EvaluationResult,
  type EvaluationRunPlan,
  type CandidateSubject,
  type BenchmarkSuite,
  type BenchmarkCase,
  type EvaluationBudgetPolicy,
  benchmarkSuiteId,
  benchmarkCaseId,
  evaluationClaimId,
  evaluationProtocolId,
  evaluationSubjectId,
  evaluationRunPlanId,
  budgetPolicyId,
  datasetId,
  judgeProtocolId,
  rubricRef,
  type BenchmarkSuiteId,
  type EvaluationSubjectId,
  type EvaluationRunId,
} from "@cantilune/evaluation";
import {
  createCantiluneC9Resolver,
  createCantiluneC9ResolverFromConformance,
} from "@cantilune/evaluation/cantilune";
import type {
  CandidateRunner,
  BaselineRunner,
  RunnerConfig,
  RunnerOutput,
  ConformanceCertificateResolver,
  ResolvedCertificate,
  RunStore,
  SuiteRegistry,
  BudgetLedgerPort,
  ContentAddressedStore,
} from "@cantilune/evaluation/ports";
import type { RunAttempt, EvaluationRun } from "@cantilune/evaluation/execution";
import {
  createMemorySuiteRegistry,
  createMemoryBudgetLedger,
} from "@cantilune/evaluation/memory";
import {
  createFileRunStore,
  createFileContentAddressedStore,
  createFileLeaseCoordinator,
} from "@cantilune/evaluation/file";

export interface EvalController {
  readonly engine: EvaluationEngine;
  readonly suiteRegistry: SuiteRegistry;
  readonly runStore: RunStore;
  readonly suiteId: BenchmarkSuiteId;
  readonly plan: EvaluationRunPlan;
  readonly subject: CandidateSubject;
  readonly budgetPolicy: EvaluationBudgetPolicy;
  /** List all runs recorded by the engine for this plan. */
  listRuns(): Promise<readonly EvaluationRun[]>;
  /** List attempts for a run. */
  listAttempts(runId: EvaluationRunId): Promise<readonly RunAttempt[]>;
}

function sha256Digest(data: string | Uint8Array): ContentDigest {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return contentDigest(createHash("sha256").update(bytes).digest("hex"));
}

/* ────────── Clock ────────── */
function createClock(): { now(): string; nowMs(): number } {
  return {
    now: () => new Date().toISOString(),
    nowMs: () => Date.now(),
  };
}

/* ────────── Conformance certificate resolver (test-only local shim) ────────── */
export interface LocalCertificateShimOptions {
  /** Required literal — the shim must never be constructed by accident. */
  readonly allowLocalShim: true;
}

/**
 * @deprecated Test/dev only. TUI `/eval` must not call this — use
 * `createCantiluneC9Resolver` / `createCantiluneC9ResolverFromConformance`.
 */
function createLocalCertificateResolver(
  subjectDigest: ContentDigest,
  options: LocalCertificateShimOptions,
): ConformanceCertificateResolver {
  if (options.allowLocalShim !== true) {
    throw new Error(
      "createLocalCertificateResolver is a local-mode shim and requires { allowLocalShim: true }. " +
        "Production fleet resolution belongs in @cantilune/conformance.",
    );
  }
  const resolved: ResolvedCertificate = {
    certificateDigest: subjectDigest,
    artifactSubjectDigest: subjectDigest,
    verifierBuild: "cli-local/0",
    policyVersion: "local",
    evidenceRootDigest: subjectDigest,
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2036-01-01T00:00:00.000Z",
    status: "valid",
  };
  return {
    async resolve(_ref: string): Promise<EvaluationResult<ResolvedCertificate>> {
      return evalOk(resolved);
    },
    async checkValidity(_ref: string): Promise<"valid" | "expired" | "revoked" | "superseded"> {
      return "valid";
    },
    async checkRevocation(_ref: string, _checkpoint: string): Promise<boolean> {
      return false;
    },
  };
}

/** Fail-closed C9 resolver: no certificate is invented as valid. */
function createFailClosedCertificateResolver(): ConformanceCertificateResolver {
  return createCantiluneC9Resolver({
    async getCertificate() {
      return undefined;
    },
    async isRevokedAtCheckpoint() {
      return true;
    },
  });
}

/**
 * Real conformance-backed resolver for CLI local subject certificates.
 * Uses @cantilune/conformance/memory RevocationStore + an in-memory certificate
 * map — never allowLocalShim.
 */
function createCliConformanceCertificateResolver(
  certificateRef: string,
  artifact: ArtifactSubject,
  subjectDigest: ContentDigest,
  revocationCheckpoint: string,
): ConformanceCertificateResolver {
  const cert: PackageConformanceCertificate = {
    certificateId: certificateRef as PackageConformanceCertificate["certificateId"],
    certificateSchemaVersion: 1,
    conformanceProfile: "engineeringAdmission",
    artifactSubject: artifact,
    ruleInventoryDigest: subjectDigest as string,
    evidenceRootDigest: subjectDigest as string,
    proofManifestDigest: subjectDigest as string,
    verifierBuild: "cli-local/conformance",
    verifierArtifactDigest: subjectDigest as string,
    policyVersion: "local",
    policyDigest: subjectDigest as string,
    trustRootSetVersion: "1",
    revocationCheckpoint,
    machineDecisionRef: "cli-local-machine",
    humanReviewAttestationRefs: [],
    issuedAt: "2026-01-01T00:00:00.000Z",
    notBefore: "2026-01-01T00:00:00.000Z",
    expiresAt: "2036-01-01T00:00:00.000Z",
    status: {
      theory: "partialScaffold",
      machine: "verified",
      humanReview: "unassigned",
      release: "accepted",
    },
  };
  const certificates = new Map<string, PackageConformanceCertificate>([[certificateRef, cert]]);
  const revocationStore = createMemoryRevocationStore(revocationCheckpoint);
  return createCantiluneC9ResolverFromConformance({
    certificates: {
      async getByRef(ref) {
        return certificates.get(ref);
      },
    },
    revocationStore,
  });
}

/* ────────── Runner adapters (bridge the CLI LLM adapter) ────────── */
function createLocalRunner(
  llmFactory: () => LlmAdapter,
  cas: ContentAddressedStore,
  kind: "candidate" | "baseline",
): CandidateRunner | BaselineRunner {
  return {
    async execute(config: RunnerConfig): Promise<EvaluationResult<RunnerOutput>> {
      try {
        const adapter = llmFactory();
        const prompt =
          config.inputRefs.length > 0
            ? `Evaluate case ${config.caseRef} against inputs: ${config.inputRefs.join(", ")}`
            : `Evaluate case ${config.caseRef} (no input artifacts)`;
        const startedMs = Date.now();
        const response = await adapter.chat({
          messages: [
            {
              role: "system",
              content: `You are a ${kind} subject in the Cantilune evaluation harness.`,
            },
            { role: "user", content: prompt },
          ],
          tools: [],
        });
        const wallTimeMs = Date.now() - startedMs;
        const text = response.text ?? "";
        const outputPut = await cas.put(new TextEncoder().encode(text));
        if (!outputPut.ok) {
          return evalViolations([
            evalViolation("internal_error", "runner.output", "Failed to store runner output"),
          ]);
        }
        const trace = JSON.stringify({
          kind,
          caseRef: config.caseRef,
          seed: config.seed,
          finishReason: response.finishReason,
        });
        const tracePut = await cas.put(new TextEncoder().encode(trace));
        if (!tracePut.ok) {
          return evalViolations([
            evalViolation("internal_error", "runner.trace", "Failed to store runner trace"),
          ]);
        }
        const tokens = response.usage ?? { prompt: 0, completion: 0, total: 0 };
        return evalOk({
          outputRefs: [outputPut.value as string],
          traceRef: tracePut.value as string,
          wallTimeMs,
          tokenUsage: {
            inputTokens: tokens.prompt,
            outputTokens: tokens.completion,
            totalTokens: tokens.total,
          },
          toolUsage: { toolCalls: 0, toolErrors: 0 },
          cost: {
            modelCostCents: 0,
            toolCostCents: 0,
            networkCostCents: 0,
            totalCostCents: 0,
            currency: "USD",
            receiptRefs: [],
          },
          terminalDisposition: "succeeded",
          environmentCaptureRef: "",
          resultDigest: outputPut.value,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return evalViolations([
          evalViolation("internal_error", "runner.execute", `Runner failed: ${message}`),
        ]);
      }
    },
  };
}

/* ────────── Minimal frozen suite + plan + subject ────────── */
function buildMinimalSuite(): { suite: BenchmarkSuite; case_: BenchmarkCase } {
  const suiteDigest = sha256Digest("cli-local-smoke-suite-v1");
  const caseDigest = sha256Digest("cli-local-smoke-case-1-v1");
  const suite: BenchmarkSuite = {
    suiteId: benchmarkSuiteId("cli-local-smoke"),
    suiteVersion: 1,
    name: "CLI Local Smoke",
    description: "Minimal frozen suite assembled by the CLI for local-mode evaluation wiring.",
    claimRefs: [evaluationClaimId("claim-1")],
    caseManifestRefs: [benchmarkCaseId("cli-local-smoke-case-1")],
    datasetRefs: [datasetId("cli-local-dataset")],
    coverageTaxonomy: ["smoke"],
    requiredStrata: ["default"],
    samplingPolicy: "all",
    defaultRunPolicy: "single",
    defaultScoringPolicy: "none",
    defaultBudgetPolicy: "cli-local-budget",
    provenanceRef: "cli-local",
    licenseRef: "cli-local",
    privacyReviewRef: "cli-local",
    suiteDigest,
    status: "frozen",
    frozenAt: "2026-08-14T00:00:00.000Z",
    supersedes: undefined,
  };
  const case_: BenchmarkCase = {
    caseId: benchmarkCaseId("cli-local-smoke-case-1"),
    suiteId: benchmarkSuiteId("cli-local-smoke"),
    caseVersion: 1,
    caseKind: "structural",
    claimRefs: [evaluationClaimId("claim-1")],
    tags: ["smoke"],
    stratum: "default",
    inputArtifactRefs: [],
    initialSnapshotRef: "snap-s0",
    schemaBindingRef: "cli-local-schema",
    policyRef: "cli-local-policy",
    requiredCapabilities: [],
    requiredTools: [],
    networkPolicy: "deny",
    filesystemPolicy: "deny",
    semanticOracleRefs: [],
    successPredicateRef: "cli-local-success",
    expectedTerminalClasses: ["succeeded"],
    resourceCaps: {
      maxTokensInput: 4096,
      maxTokensOutput: 4096,
      maxToolCalls: 0,
      maxNetworkRequests: 0,
      maxFilesystemOps: 0,
      maxCostCents: 0,
    },
    maxStructuralSteps: 1,
    maxExecutionEpochs: 1,
    engineeringTimeout: 60_000,
    redactionPolicyRef: "cli-local-redaction",
    caseDigest,
  };
  return { suite, case_ };
}

function buildMinimalPlan(
  suiteId: BenchmarkSuiteId,
  subjectId: EvaluationSubjectId,
): EvaluationRunPlan {
  const planDigest = sha256Digest(`cli-local-plan-${suiteId}-${subjectId}`);
  return {
    planId: evaluationRunPlanId("cli-local-plan-1"),
    protocolRef: evaluationProtocolId("cli-local-protocol"),
    claimRefs: [evaluationClaimId("claim-1")],
    suiteRef: suiteId,
    caseSelection: {
      mode: "all",
      caseIds: undefined,
      strata: undefined,
      maxCases: undefined,
    },
    datasetSplitRefs: [datasetId("cli-local-dataset")],
    candidateSubjectRef: subjectId,
    baselineSubjectRefs: [],
    pairedExecution: false,
    blockingFactors: [],
    randomizationOrder: [],
    blinding: {
      candidateBlinded: false,
      baselineBlinded: false,
      judgeBlinded: false,
      presentationRandomized: false,
    },
    seeds: [1],
    repetitions: 1,
    modelProviderRevisions: ["cli-local"],
    promptDigests: [sha256Digest("cli-local-prompt")],
    rubricRefs: [rubricRef("cli-local-rubric")],
    toolManifestRefs: [],
    concurrency: 1,
    retryPolicy: { maxRetries: 0, retryableFailures: [], backoffMs: 0 },
    timeoutPolicy: { perCaseMs: 60_000, perRunMs: 120_000, totalMs: 120_000 },
    environmentManifest: "cli-local",
    hardwareManifest: "cli-local",
    budgetPolicyRef: budgetPolicyId("cli-local-budget"),
    judgeProtocolRefs: [judgeProtocolId("cli-local-judge")],
    redactionPolicyRef: "cli-local-redaction",
    exclusionPolicy: "none",
    planDigest,
    frozenAt: "2026-08-14T00:00:00.000Z",
  };
}

function buildMinimalBudgetPolicy(): EvaluationBudgetPolicy {
  return {
    policyId: budgetPolicyId("cli-local-budget"),
    maxRuns: 100,
    maxCases: 100,
    maxConcurrency: 1,
    maxInputTokens: 1_000_000,
    maxOutputTokens: 1_000_000,
    maxModelCostCents: 0,
    maxToolCostCents: 0,
    maxNetworkCostCents: 0,
    maxTotalCostCents: 0,
    maxWallTimeMs: 120_000,
    maxRetries: 0,
    providerQuotas: [],
    suiteQuotas: [],
    dailyLimitCents: 0,
    monthlyLimitCents: 0,
    hardKillEnabled: false,
    safeStateOnKill: true,
    policyDigest: sha256Digest("cli-local-budget-policy-v1"),
  };
}

function buildCandidateSubject(subjectId: EvaluationSubjectId): CandidateSubject {
  const subjectDigest = sha256Digest(`cli-local-subject-${subjectId}`);
  const artifact: ArtifactSubject = {
    packageName: "cantilune-cli",
    packageVersion: "0.0.1",
    commitSha: "local",
    treeDigest: subjectDigest,
    artifactDigest: subjectDigest,
    lockfileDigest: subjectDigest,
    toolchainDigest: subjectDigest,
    buildProvenanceDigest: subjectDigest,
  };
  return {
    subjectId,
    subjectKind: "candidate",
    packageConformanceCertificateRef: `cli-local-cert-${subjectId}`,
    certificateDigest: subjectDigest,
    artifactSubject: artifact,
    packageConfigurationRef: "cli-local-config",
    schemaBindingRef: "cli-local-schema",
    policyRef: "cli-local-policy",
    runtimeConfigRef: "cli-local-runtime",
    controlPlaneConfigRef: "cli-local-controlplane",
    commsConfigRef: "cli-local-comms",
    adapterBuild: "cli-local",
    adapterDigest: subjectDigest,
    certificateValidity: "valid",
    revocationCheckpoint: "2026-08-14T00:00:00.000Z",
    subjectDigest,
  };
}

/**
 * Build the TUI evaluation controller (ADR-0011 / RFC-0004).
 * Uses file-durable run/CAS/lease stores and a fail-closed C9 resolver —
 * never `allowLocalShim`.
 */
export function createEvalController(
  llmFactory: () => LlmAdapter,
  options?: {
    readonly evalStoreDir?: string;
    readonly certificateResolver?: ConformanceCertificateResolver;
  },
): EvalController {
  const baseDir = options?.evalStoreDir ?? join(homedir(), ".cantilune", "eval");
  const clock = createClock();
  const cas = createFileContentAddressedStore(join(baseDir, "cas"));
  const runStore: RunStore = createFileRunStore(baseDir);
  const suiteRegistry: SuiteRegistry = createMemorySuiteRegistry();
  const budgetLedger: BudgetLedgerPort = createMemoryBudgetLedger();
  const leaseCoordinator = createFileLeaseCoordinator(baseDir);

  const { suite, case_ } = buildMinimalSuite();
  void suiteRegistry.register(suite);
  void suiteRegistry.registerCase(case_);

  const subjectId = evaluationSubjectId("cli-local-candidate");
  const subject = buildCandidateSubject(subjectId);
  const plan = buildMinimalPlan(suite.suiteId, subjectId);
  const budgetPolicy = buildMinimalBudgetPolicy();

  const certificateResolver =
    options?.certificateResolver ?? createFailClosedCertificateResolver();
  const candidateRunner = createLocalRunner(llmFactory, cas, "candidate");
  const baselineRunner = createLocalRunner(llmFactory, cas, "baseline");

  const engine = createEvaluationEngine({
    runStore,
    cas,
    clock,
    budgetLedger,
    candidateRunner,
    baselineRunner,
    certificateResolver,
    suiteRegistry,
    leaseCoordinator,
  });

  return {
    engine,
    suiteRegistry,
    runStore,
    suiteId: suite.suiteId,
    plan,
    subject,
    budgetPolicy,
    async listRuns() {
      return runStore.listByPlan(plan.planId as string);
    },
    async listAttempts(runId: EvaluationRunId) {
      return runStore.listAttempts(runId);
    },
  };
}

export {
  buildMinimalPlan,
  buildCandidateSubject,
  buildMinimalBudgetPolicy,
  buildMinimalSuite,
  createLocalRunner,
  createLocalCertificateResolver,
  createFailClosedCertificateResolver,
  createCliConformanceCertificateResolver,
  sha256Digest,
};
