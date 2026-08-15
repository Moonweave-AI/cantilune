/**
 * Command + view wiring test for the CLI evaluation commands (ADR-0011).
 *
 * Verifies that /eval list|run|report|compare prefetch real evaluation data
 * through the eval controller and that the EvalView renders the prefetched
 * suites, runs, and attempts. A controllable mock EvalController stands in
 * for the real engine so the command wiring (not the engine) is under test;
 * the real engine path is covered by evalControl.test.ts.
 */
import { describe, it, expect, vi } from "vitest";
import { createCommandRegistry } from "../../src/commands/registry.js";
import { registerEvalCommands } from "../../src/commands/evalCommands.js";
import { createStore } from "../../src/store.js";
import { renderEvalViewOutput } from "../../src/views/EvalView.js";
import { sampleRuntime } from "../support/sampleRuntime.js";
import type { EvalController } from "../../src/wiring/evalControl.js";
import type { BenchmarkSuite } from "@cantilune/evaluation/benchmarks";
import type { RunAttempt, EvaluationRun } from "@cantilune/evaluation/execution";
import type { EvaluationResult } from "@cantilune/evaluation";

/** Build a controllable mock EvalController. */
function mockController(opts: {
  suites?: readonly BenchmarkSuite[];
  runs?: readonly EvaluationRun[];
  attempts?: readonly RunAttempt[];
  admitOk?: boolean;
  attemptOk?: boolean;
  completeOk?: boolean;
}): EvalController {
  const suites = opts.suites ?? [];
  return {
    engine: {
      admitRun: vi.fn(
        async (): Promise<EvaluationResult<{ run: EvaluationRun; token: unknown }>> => {
          if (!opts.admitOk) {
            return {
              ok: false,
              violations: [{ code: "invalid_input", path: "test", message: "admit rejected" }],
            } as never;
          }
          const run: EvaluationRun = {
            runId: "run-1" as never,
            planRef: "plan-1" as never,
            planDigest: "d" as never,
            subjectRef: "subj" as never,
            status: "admitted",
            attemptIds: [],
            currentAttemptId: undefined,
            startedAt: "2026-08-14T00:00:00.000Z",
            endedAt: undefined,
            runDigest: "d" as never,
          };
          return { ok: true, value: { run, token: "tok" } } as never;
        },
      ),
      executeAttempt: vi.fn(async (): Promise<EvaluationResult<RunAttempt>> => {
        if (!opts.attemptOk) {
          return {
            ok: false,
            violations: [{ code: "internal_error", path: "test", message: "exec rejected" }],
          } as never;
        }
        const attempt: RunAttempt = {
          attemptId: "att-1" as never,
          runId: "run-1" as never,
          idempotencyKey: "k",
          planDigest: "d" as never,
          subjectRef: "subj" as never,
          caseRef: "c" as never,
          seed: 1,
          executionOrder: 0,
          status: "succeeded",
          workerId: "w" as never,
          leaseId: "l" as never,
          fencingToken: "f" as never,
          startedAt: "2026-08-14T00:00:00.000Z",
          endedAt: "2026-08-14T00:00:01.000Z",
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
            modelCostCents: 0,
            toolCostCents: 0,
            networkCostCents: 0,
            totalCostCents: 0,
            currency: "USD",
            receiptRefs: [],
          },
          terminalDisposition: "succeeded",
          failureCategory: undefined,
          retryOf: undefined,
          environmentCaptureRef: undefined,
          resultDigest: "rd" as never,
        };
        return { ok: true, value: attempt } as never;
      }),
      completeRun: vi.fn(async (): Promise<EvaluationResult<EvaluationRun>> => {
        if (!opts.completeOk) {
          return {
            ok: false,
            violations: [{ code: "invalid_input", path: "test", message: "complete rejected" }],
          } as never;
        }
        return {
          ok: true,
          value: {
            runId: "run-1" as never,
            planRef: "plan-1" as never,
            planDigest: "d" as never,
            subjectRef: "subj" as never,
            status: "collecting",
            attemptIds: ["att-1" as never],
            currentAttemptId: "att-1" as never,
            startedAt: "2026-08-14T00:00:00.000Z",
            endedAt: "2026-08-14T00:00:01.000Z",
            runDigest: "d" as never,
          },
        } as never;
      }),
    } as never,
    suiteRegistry: {
      listAll: vi.fn(async () => suites),
    } as never,
    runStore: {} as never,
    suiteId: "cli-local-smoke" as never,
    plan: {
      planId: "plan-1" as never,
      caseSelection: { caseIds: ["cli-local-smoke-case-1" as never] },
      seeds: [1],
    } as never,
    subject: { subjectId: "subj" as never } as never,
    budgetPolicy: { policyId: "bp" as never } as never,
    listRuns: vi.fn(async () => opts.runs ?? []),
    listAttempts: vi.fn(async () => opts.attempts ?? []),
  } as unknown as EvalController;
}

function servicesWith(controller: EvalController | undefined) {
  return controller === undefined ? {} : { evalControl: () => controller };
}

function registry() {
  const r = createCommandRegistry();
  for (const c of registerEvalCommands()) r.register(c);
  return r;
}

const SAMPLE_SUITE: BenchmarkSuite = {
  suiteId: "cli-local-smoke" as never,
  suiteVersion: 1,
  name: "CLI Local Smoke",
  description: "test suite",
  claimRefs: [],
  caseManifestRefs: ["c1" as never],
  datasetRefs: [],
  coverageTaxonomy: ["smoke"],
  requiredStrata: ["default"],
  samplingPolicy: "all",
  defaultRunPolicy: "single",
  defaultScoringPolicy: "none",
  defaultBudgetPolicy: "bp",
  provenanceRef: "p",
  licenseRef: "l",
  privacyReviewRef: "pr",
  suiteDigest: "sd" as never,
  status: "frozen",
  frozenAt: "2026-08-14T00:00:00.000Z",
  supersedes: undefined,
};

describe("eval command wiring", () => {
  it("/eval list prefetches suites and the view renders them", async () => {
    const controller = mockController({ suites: [SAMPLE_SUITE] });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    await reg.execute("/eval list", appStore, servicesWith(controller));
    expect(appStore.activeView).toBe("eval-list");
    expect((appStore.viewArgs.suites as readonly BenchmarkSuite[]).length).toBe(1);
    const out = renderEvalViewOutput("eval-list", appStore.viewArgs, sampleRuntime);
    expect(out).toContain("CLI Local Smoke");
    expect(out).toContain("cli-local-smoke");
    expect(controller.suiteRegistry.listAll).toHaveBeenCalled();
  });

  it("/eval list with no controller falls back to data-load prompt", async () => {
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    await reg.execute("/eval list", appStore, servicesWith(undefined));
    expect(appStore.activeView).toBe("eval-list");
    expect(appStore.viewArgs.suites).toBeUndefined();
    const out = renderEvalViewOutput("eval-list", appStore.viewArgs, sampleRuntime);
    expect(out).toContain("No evaluation data loaded");
  });

  it("/eval run drives admit → execute → complete and reports success", async () => {
    const controller = mockController({ admitOk: true, attemptOk: true, completeOk: true });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    const notified: string[] = [];
    await reg.execute("/eval run", appStore, {
      evalControl: () => controller,
      notify: (_l, t) => notified.push(t),
    });
    expect(appStore.activeView).toBe("eval-run");
    expect(controller.engine.admitRun).toHaveBeenCalled();
    expect(controller.engine.executeAttempt).toHaveBeenCalled();
    expect(controller.engine.completeRun).toHaveBeenCalled();
    expect(notified.some((t) => t.includes("run executed"))).toBe(true);
    expect(appStore.viewArgs.lastRunId).toBe("run-1");
  });

  it("/eval run reports admit failure", async () => {
    const controller = mockController({ admitOk: false });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    const notified: { level: string; text: string }[] = [];
    await reg.execute("/eval run", appStore, {
      evalControl: () => controller,
      notify: (level, text) => notified.push({ level, text }),
    });
    expect(notified.some((n) => n.text.includes("admit failed"))).toBe(true);
  });

  it("/eval run reports exec failure", async () => {
    const controller = mockController({ admitOk: true, attemptOk: false });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    const notified: string[] = [];
    await reg.execute("/eval run", appStore, {
      evalControl: () => controller,
      notify: (_l, t) => notified.push(t),
    });
    expect(notified.some((t) => t.includes("exec failed"))).toBe(true);
  });

  it("/eval run with no controller warns", async () => {
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    const notified: string[] = [];
    await reg.execute("/eval run", appStore, {
      notify: (_l, t) => notified.push(t),
    });
    expect(notified.some((t) => t.includes("no eval controller"))).toBe(true);
    expect(appStore.activeView).toBe("eval-run");
  });

  it("/eval report prefetches attempts for the given run", async () => {
    const controller = mockController({ admitOk: false });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    await reg.execute("/eval report run-1", appStore, servicesWith(controller));
    expect(appStore.activeView).toBe("eval-report");
    expect(appStore.viewArgs.lastRunId).toBe("run-1");
    expect(controller.listAttempts).toHaveBeenCalledWith("run-1" as never);
  });

  it("/eval compare prefetches attempts for both runs", async () => {
    const controller = mockController({ admitOk: false });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    await reg.execute("/eval compare r1 r2", appStore, servicesWith(controller));
    expect(appStore.activeView).toBe("eval-compare");
    expect(appStore.viewArgs.runA).toBe("r1");
    expect(appStore.viewArgs.runB).toBe("r2");
    expect(controller.listAttempts).toHaveBeenCalledTimes(2);
  });

  it("eval report view renders run + attempt records", async () => {
    const controller = mockController({
      admitOk: false,
      runs: [
        {
          runId: "run-x" as never,
          planRef: "p" as never,
          planDigest: "d" as never,
          subjectRef: "s" as never,
          status: "collecting",
          attemptIds: ["a1" as never],
          currentAttemptId: "a1" as never,
          startedAt: "2026-08-14T00:00:00.000Z",
          endedAt: undefined,
          runDigest: "d" as never,
        },
      ],
      attempts: [
        {
          attemptId: "a1" as never,
          runId: "run-x" as never,
          idempotencyKey: "k",
          planDigest: "d" as never,
          subjectRef: "s" as never,
          caseRef: "c" as never,
          seed: 1,
          executionOrder: 0,
          status: "succeeded",
          workerId: "w" as never,
          leaseId: "l" as never,
          fencingToken: "f" as never,
          startedAt: "2026-08-14T00:00:00.000Z",
          endedAt: "2026-08-14T00:00:01.000Z",
          inputRefs: [],
          outputRefs: ["o"],
          traceEvidenceRef: "t",
          observationEvidenceRef: undefined,
          admissionEvidenceRef: undefined,
          communicationEvidenceRef: undefined,
          providerReceiptRefs: [],
          rawArtifactRefs: ["o"],
          sanitizedArtifactRefs: [],
          tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          toolUsage: { toolCalls: 0, toolErrors: 0 },
          networkUsage: { requestCount: 0, totalBytesIn: 0, totalBytesOut: 0 },
          wallTime: 100,
          cost: {
            modelCostCents: 0,
            toolCostCents: 0,
            networkCostCents: 0,
            totalCostCents: 0,
            currency: "USD",
            receiptRefs: [],
          },
          terminalDisposition: "succeeded",
          failureCategory: undefined,
          retryOf: undefined,
          environmentCaptureRef: undefined,
          resultDigest: "rd" as never,
        },
      ],
    });
    const reg = registry();
    const appStore = createStore({ runtime: sampleRuntime });
    await reg.execute("/eval report run-x", appStore, servicesWith(controller));
    const out = renderEvalViewOutput("eval-report", appStore.viewArgs, sampleRuntime);
    expect(out).toContain("run-x");
    expect(out).toContain("a1");
    expect(out).toContain("succeeded");
  });

  it("eval compare view renders both attempt counts", async () => {
    const out = renderEvalViewOutput(
      "eval-compare",
      {
        runA: "r1",
        runB: "r2",
        attemptsA: [{ tokenUsage: { totalTokens: 10 } } as never],
        attemptsB: [],
      },
      sampleRuntime,
    );
    expect(out).toContain("Compare r1 vs r2");
    expect(out).toContain("Attempts A: 1");
    expect(out).toContain("Attempts B: 0");
  });

  it("eval-run view renders runs + attempts with lastRunId", () => {
    const out = renderEvalViewOutput(
      "eval-run",
      {
        lastRunId: "run-9",
        runs: [
          {
            runId: "run-9" as never,
            planRef: "p" as never,
            planDigest: "d" as never,
            subjectRef: "s" as never,
            status: "collecting",
            attemptIds: ["a9" as never],
            currentAttemptId: "a9" as never,
            startedAt: "2026-08-14T00:00:00.000Z",
            endedAt: undefined,
            runDigest: "d" as never,
          },
        ],
        attempts: [
          {
            attemptId: "a9" as never,
            runId: "run-9" as never,
            idempotencyKey: "k",
            planDigest: "d" as never,
            subjectRef: "s" as never,
            caseRef: "c" as never,
            seed: 1,
            executionOrder: 0,
            status: "succeeded",
            workerId: "w" as never,
            leaseId: "l" as never,
            fencingToken: "f" as never,
            startedAt: "2026-08-14T00:00:00.000Z",
            endedAt: "2026-08-14T00:00:01.000Z",
            inputRefs: [],
            outputRefs: ["o"],
            traceEvidenceRef: "t",
            observationEvidenceRef: undefined,
            admissionEvidenceRef: undefined,
            communicationEvidenceRef: undefined,
            providerReceiptRefs: [],
            rawArtifactRefs: ["o"],
            sanitizedArtifactRefs: [],
            tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            toolUsage: { toolCalls: 0, toolErrors: 0 },
            networkUsage: { requestCount: 0, totalBytesIn: 0, totalBytesOut: 0 },
            wallTime: 100,
            cost: {
              modelCostCents: 0,
              toolCostCents: 0,
              networkCostCents: 0,
              totalCostCents: 0,
              currency: "USD",
              receiptRefs: [],
            },
            terminalDisposition: "succeeded",
            failureCategory: undefined,
            retryOf: undefined,
            environmentCaptureRef: undefined,
            resultDigest: "rd" as never,
          },
        ],
      },
      sampleRuntime,
    );
    expect(out).toContain("run-9");
    expect(out).toContain("Latest run: run-9");
    expect(out).toContain("a9");
  });

  it("eval-run view renders a notice line when present", () => {
    const out = renderEvalViewOutput(
      "eval-run",
      { notice: { level: "info", text: "run executed: ok" }, runs: [], attempts: [] },
      sampleRuntime,
    );
    expect(out).toContain("info: run executed: ok");
    expect(out).toContain("No runs recorded yet");
  });

  it("eval-list view with empty suites renders the empty message", () => {
    const out = renderEvalViewOutput("eval-list", { suites: [] }, sampleRuntime);
    expect(out).toContain("No suites registered.");
  });

  it("eval default view renders the suite table", () => {
    const out = renderEvalViewOutput(
      "eval-unknown" as never,
      { suites: [SAMPLE_SUITE] },
      sampleRuntime,
    );
    expect(out).toContain("cli-local-smoke");
  });

  it("eval-run view with runs but no lastRunId renders the run table only", () => {
    const out = renderEvalViewOutput(
      "eval-run",
      {
        runs: [
          {
            runId: "run-only" as never,
            planRef: "p" as never,
            planDigest: "d" as never,
            subjectRef: "s" as never,
            status: "admitted",
            attemptIds: [],
            currentAttemptId: undefined,
            startedAt: "2026-08-14T00:00:00.000Z",
            endedAt: undefined,
            runDigest: "d" as never,
          },
        ],
      },
      sampleRuntime,
    );
    expect(out).toContain("run-only");
    expect(out).not.toContain("Latest run");
  });

  it("eval-compare view reports token totals for both sides", () => {
    const out = renderEvalViewOutput(
      "eval-compare",
      {
        runA: "a",
        runB: "b",
        attemptsA: [
          { tokenUsage: { totalTokens: 7 } } as never,
          { tokenUsage: { totalTokens: 3 } } as never,
        ],
        attemptsB: [{ tokenUsage: { totalTokens: 12 } } as never],
      },
      sampleRuntime,
    );
    expect(out).toContain("Tokens A: 10");
    expect(out).toContain("Tokens B: 12");
  });

  it("eval-report view with runs but no attempts key renders the empty attempt table", () => {
    const out = renderEvalViewOutput(
      "eval-report",
      { lastRunId: "run-z", runs: [] },
      sampleRuntime,
    );
    expect(out).toContain("Run: run-z");
    expect(out).toContain("No attempts for this run.");
  });

  it("eval-compare view with runs but no attemptsA/B keys renders zero counts", () => {
    const out = renderEvalViewOutput(
      "eval-compare",
      { runA: "x", runB: "y", runs: [] },
      sampleRuntime,
    );
    expect(out).toContain("Attempts A: 0");
    expect(out).toContain("Attempts B: 0");
  });

  it("eval-report view with no runs key renders the empty run table", () => {
    const out = renderEvalViewOutput(
      "eval-report",
      { lastRunId: "r1", runs: undefined },
      sampleRuntime,
    );
    expect(out).toContain("No runs recorded yet");
  });
});
