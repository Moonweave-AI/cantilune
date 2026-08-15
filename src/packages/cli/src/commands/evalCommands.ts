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
  _requestedSuite: string | undefined,
): Promise<RunOutcome> {
  const { engine, plan, subject, budgetPolicy } = controller;
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
      text: `run executed: ${run.runId as string} (attempt ${attempt.value.attemptId as string}, status ${attempt.value.status})`,
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
  return {
    runs: await controller.listRuns(),
    attempts,
    lastRunId: runId,
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
  return {
    runs: await controller.listRuns(),
    runA,
    runB,
    attemptsA,
    attemptsB,
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
