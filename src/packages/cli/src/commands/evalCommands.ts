/**
 * Evaluation commands for the TUI — /eval list, /eval run, /eval report,
 * /eval compare (ADR-0011 / RFC-0004).
 *
 * The view commands prefetch real evaluation data through the eval controller
 * (suiteRegistry.listAll, runStore.listByPlan, runStore.listAttempts) and
 * stash it in store.viewArgs so the (synchronous) view renders pre-fetched
 * records. /eval run is an operation: it drives the real EvaluationEngine
 * path admitRun → executeAttempt → completeRun with a genuine LLM call, then
 * stashes the resulting run + attempt so the report renders real evidence.
 * Nothing here fabricates a run; every "executed" record comes from the engine.
 */
import type { SlashCommand, CommandCategory } from "./registry.js";
import type { AppStore } from "../store.js";
import type { BenchmarkSuite } from "@cantilune/evaluation/benchmarks";
import type { RunAttempt, EvaluationRun } from "@cantilune/evaluation/execution";
import type { EvalController } from "../wiring/evalControl.js";
import {
  analyzeMetricObservations,
  collectTheoryOracleBundle,
  compareEvaluationRuns,
  composeEvaluationReport,
  evaluationClaimId,
  evaluationProtocolId,
  evaluationRunPlanId,
  observationsFromAttempts,
  type EvaluationClaim,
  type EvaluationProtocol,
} from "@cantilune/evaluation";
import { contentDigest } from "@cantilune/core";

export type EvalNoticeLevel = "info" | "warn" | "error";

export interface EvalNotice {
  readonly level: EvalNoticeLevel;
  readonly text: string;
}

export interface PrefetchedEvalData {
  readonly suites?: readonly BenchmarkSuite[];
  readonly runs?: readonly EvaluationRun[];
  readonly attempts?: readonly RunAttempt[];
  readonly lastRunId?: string;
  readonly notice?: EvalNotice;
  readonly report?: unknown;
  readonly theoryOracles?: unknown;
}

export function registerEvalCommands(): SlashCommand[] {
  const view = "view" as CommandCategory;
  const operation = "operation" as CommandCategory;
  return [
    {
      name: "/eval list",
      description: "List available evaluation suites",
      category: view,
      handler: async (_args: Record<string, unknown>, store: AppStore, services): Promise<void> => {
        store.mode = "view";
        store.activeView = "eval-list";
        store.viewArgs = await prefetchEvalList(services);
      },
    },
    {
      name: "/eval run",
      description: "Run the local evaluation suite (admit → execute → complete)",
      category: operation,
      args: [{ name: "suite", description: "Benchmark suite id", required: false, type: "string" }],
      handler: async (args: Record<string, unknown>, store: AppStore, services): Promise<void> => {
        const controller = services?.evalControl?.();
        if (controller === undefined) {
          notify(store, services, "warn", "no eval controller connected");
          store.mode = "view";
          store.activeView = "eval-run";
          store.viewArgs = { notice: { level: "warn", text: "no eval controller connected" } };
          return;
        }
        const requestedSuite = typeof args.suite === "string" ? args.suite : undefined;
        const result = await runLocalSuite(controller, requestedSuite);
        notify(store, services, result.notice.level, result.notice.text);
        store.mode = "view";
        store.activeView = "eval-run";
        store.viewArgs = await prefetchEvalRun(services, result.runId);
      },
    },
    {
      name: "/eval report",
      description: "Show evaluation run report",
      category: view,
      args: [{ name: "runId", description: "Evaluation run id", required: true, type: "string" }],
      handler: async (args: Record<string, unknown>, store: AppStore, services): Promise<void> => {
        store.mode = "view";
        store.activeView = "eval-report";
        const runId = typeof args.runId === "string" ? args.runId : undefined;
        store.viewArgs = await prefetchEvalReport(services, runId);
      },
    },
    {
      name: "/eval compare",
      description: "Compare two evaluation runs",
      category: view,
      args: [
        { name: "runA", description: "Baseline run id", required: true, type: "string" },
        { name: "runB", description: "Candidate run id", required: true, type: "string" },
      ],
      handler: async (args: Record<string, unknown>, store: AppStore, services): Promise<void> => {
        store.mode = "view";
        store.activeView = "eval-compare";
        store.viewArgs = await prefetchEvalCompare(services, args);
      },
    },
  ];
}

interface RunOutcome {
  readonly runId: string;
  readonly notice: EvalNotice;
}

async function runLocalSuite(
  controller: EvalController,
  requestedSuite: string | undefined,
): Promise<RunOutcome> {
  const { engine, plan, subject, budgetPolicy, suiteId, suiteRegistry } = controller;
  if (requestedSuite !== undefined && requestedSuite !== (suiteId as string)) {
    const suites = await suiteRegistry.listAll();
    const match = suites.find((s) => (s.suiteId as string) === requestedSuite);
    if (match === undefined) {
      return {
        runId: "",
        notice: {
          level: "warn",
          text: `unknown suite: ${requestedSuite} (registered: ${suites.map((s) => s.suiteId as string).join(", ") || "none"})`,
        },
      };
    }
  }
  const admit = await engine.admitRun(plan, subject, budgetPolicy);
  if (!admit.ok) {
    return {
      runId: "",
      notice: {
        level: "warn",
        text: `admit failed: ${admit.violations.map((v) => v.message).join("; ")}`,
      },
    };
  }
  const run = admit.value.run;
  const caseRef = plan.caseSelection.caseIds?.[0] ?? "cli-local-smoke-case-1";
  const seed = plan.seeds[0] ?? 1;
  const attempt = await engine.executeAttempt(run.runId, caseRef as never, seed);
  if (!attempt.ok) {
    return {
      runId: run.runId as string,
      notice: {
        level: "warn",
        text: `exec failed: ${attempt.violations.map((v) => v.message).join("; ")}`,
      },
    };
  }
  await engine.completeRun(run.runId);
  return {
    runId: run.runId as string,
    notice: {
      level: "info",
      text: `run executed: ${run.runId as string} (suite ${requestedSuite ?? (suiteId as string)}, attempt ${attempt.value.attemptId as string}, status ${attempt.value.status})`,
    },
  };
}

async function prefetchEvalList(
  services?: { readonly evalControl?: () => unknown } | undefined,
): Promise<Record<string, unknown>> {
  const controller = readController(services);
  if (controller === undefined) return {};
  const suites = await controller.suiteRegistry.listAll();
  return { suites };
}

async function prefetchEvalRun(
  services?: { readonly evalControl?: () => unknown } | undefined,
  runId?: string,
): Promise<Record<string, unknown>> {
  const controller = readController(services);
  if (controller === undefined) return runId === undefined ? {} : { lastRunId: runId };
  const runs = await controller.listRuns();
  const lastRunId = runId ?? (runs.length > 0 ? (runs.at(-1)?.runId as string) : undefined);
  const attempts = lastRunId !== undefined ? await controller.listAttempts(lastRunId as never) : [];
  return {
    suites: await controller.suiteRegistry.listAll(),
    runs,
    attempts,
    lastRunId,
  };
}

async function prefetchEvalReport(
  services?: { readonly evalControl?: () => unknown } | undefined,
  runId?: string,
): Promise<Record<string, unknown>> {
  const controller = readController(services);
  if (controller === undefined) return runId === undefined ? {} : { lastRunId: runId };
  if (runId === undefined) return { runs: await controller.listRuns() };
  const attempts = await controller.listAttempts(runId as never);
  const observations = observationsFromAttempts(attempts);
  const analysis = analyzeMetricObservations({
    planRef: evaluationRunPlanId(controller.plan.planId as string),
    population: "cli-local",
    observations,
    exploratory: true,
    analysisPlanDeclared: false,
  });
  const claim: EvaluationClaim = {
    claimId: evaluationClaimId("cli-local-claim"),
    claimVersion: 1,
    claimCode: "evaluation.c5",
    statement: "CLI local evaluation report (not a public superiority claim)",
    nullHypothesis: "no attempt-success difference",
    targetPopulation: "cli-local",
    candidateSubjectPolicy: "c9",
    baselineFamily: "cli-local",
    primaryMetricRefs: [],
    secondaryMetricRefs: [],
    guardrailMetricRefs: [],
    successRule: "review",
    failureRule: "review",
    inconclusiveRule: "default",
    samplePlanRef: "cli-local",
    uncertaintyMethod: "student-t",
    multipleComparisonPolicy: "holm",
    stoppingRule: "one-look",
    rescopeOrTerminationRule: "none",
    ownerRef: "cli",
    requiredReviewerRoles: ["stats"],
    status: "protocolFrozen",
    protocolDigest: contentDigest("cli-local-protocol"),
    createdAt: "2026-08-16T00:00:00.000Z",
    frozenAt: "2026-08-16T00:00:00.000Z",
    supersedes: undefined,
  };
  const protocol: EvaluationProtocol = {
    protocolId: evaluationProtocolId("cli-local-protocol"),
    protocolVersion: 1,
    claimRefs: [claim.claimId],
    benchmarkSuiteRef: controller.suiteId as string,
    candidateSelection: "cli-local",
    baselineSelection: "cli-local",
    populationDefinition: "cli-local",
    samplingMethod: "census",
    sampleSize: attempts.length,
    seedPolicy: "fixed",
    repetitionPolicy: "1x",
    randomizationPlan: "none",
    blindingPlan: "none",
    metricPlan: "attempt-success",
    analysisPlan: "exploratory",
    missingDataPolicy: "exclude",
    outlierPolicy: "none",
    stoppingPolicy: "one-look",
    securityPlanRef: "cli-local",
    privacyPlanRef: "cli-local",
    budgetPolicyRef: "cli-local",
    reviewPolicyRef: "cli-local",
    amendmentOf: undefined,
    protocolDigest: contentDigest("cli-local-protocol"),
    frozenAt: "2026-08-16T00:00:00.000Z",
  };
  const report = analysis.ok
    ? composeEvaluationReport({
        claim,
        protocol,
        analysis: analysis.value,
        candidateSubjectDigest: contentDigest("cli-local-candidate"),
        baselineSubjectDigests: [contentDigest("cli-local-baseline")],
        suiteRef: controller.suiteId,
      })
    : undefined;
  const theoryOracles = collectTheoryOracleBundle({
    repoRoot: process.cwd(),
    evaluatorRef: "cli-/eval-report",
  });
  return {
    runs: await controller.listRuns(),
    attempts,
    lastRunId: runId,
    ...(analysis.ok ? { analysis: analysis.value } : {}),
    ...(report !== undefined ? { report } : {}),
    theoryOracles,
  };
}

async function prefetchEvalCompare(
  services?: { readonly evalControl?: () => unknown } | undefined,
  args?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const controller = readController(services);
  const runA = typeof args?.runA === "string" ? args.runA : undefined;
  const runB = typeof args?.runB === "string" ? args.runB : undefined;
  if (controller === undefined) {
    return { ...(runA !== undefined ? { runA } : {}), ...(runB !== undefined ? { runB } : {}) };
  }
  const attemptsA = runA !== undefined ? await controller.listAttempts(runA as never) : [];
  const attemptsB = runB !== undefined ? await controller.listAttempts(runB as never) : [];
  const analysis =
    runA !== undefined && runB !== undefined
      ? compareEvaluationRuns({ runA, runB, attemptsA, attemptsB })
      : undefined;
  return {
    runs: await controller.listRuns(),
    runA,
    runB,
    attemptsA,
    attemptsB,
    ...(analysis !== undefined ? { analysis } : {}),
  };
}

function readController(
  services?: { readonly evalControl?: () => unknown } | undefined,
): EvalController | undefined {
  return services?.evalControl?.() as EvalController | undefined;
}

function notify(
  store: AppStore,
  services:
    { readonly notify?: (level: "info" | "warn" | "error", text: string) => void } | undefined,
  level: "info" | "warn" | "error",
  text: string,
): void {
  if (services !== undefined) {
    services.notify?.(level, text);
  } else {
    store.notice = { level, text };
  }
}
