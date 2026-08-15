import React, { useMemo } from "react";
import { Text } from "ink";
import { NO_RUNTIME_MESSAGE } from "../runtimeSync.js";
import type { AppStore, RuntimeState, ViewType } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { renderTable } from "../render/asciiTable.js";
import { DiffView } from "./DiffView.js";
import { ReportView } from "./ReportView.js";
import { ViewFrame, type ViewTone } from "./ViewFrame.js";
import { str } from "./viewStr.js";
import type { BenchmarkSuite } from "@cantilune/evaluation/benchmarks";
import type { RunAttempt, EvaluationRun } from "@cantilune/evaluation/execution";

/** Evaluation reports pass/fail evidence, so it borrows the success hue. */
const EVAL_TONE: ViewTone = "success";

export interface ViewProps {
  readonly store: AppStore;
}

export interface PrefetchedEvalData {
  readonly suites?: readonly BenchmarkSuite[];
  readonly runs?: readonly EvaluationRun[];
  readonly attempts?: readonly RunAttempt[];
  readonly lastRunId?: string;
  readonly attemptsA?: readonly RunAttempt[];
  readonly attemptsB?: readonly RunAttempt[];
  readonly runA?: string;
  readonly runB?: string;
  readonly notice?: { readonly level: "info" | "warn" | "error"; readonly text: string };
}

function readEvalData(
  viewArgs: Record<string, unknown> | undefined,
): PrefetchedEvalData | undefined {
  if (viewArgs === undefined) return undefined;
  // The prefetch stashes typed records under well-known keys; if none are
  // present the view falls back to the no-runtime message.
  const has =
    "suites" in viewArgs ||
    "runs" in viewArgs ||
    "attempts" in viewArgs ||
    "attemptsA" in viewArgs ||
    "attemptsB" in viewArgs;
  if (!has) return undefined;
  return viewArgs as unknown as PrefetchedEvalData;
}

function suiteTable(suites: readonly BenchmarkSuite[]): string {
  if (suites.length === 0) return "No suites registered.";
  return renderTable(
    [
      { header: "Suite", width: 22 },
      { header: "Name", width: 22 },
      { header: "Status", width: 8 },
      { header: "Cases", width: 6 },
      { header: "Frozen", width: 12 },
    ],
    suites.map((s) => [
      s.suiteId as string,
      s.name,
      s.status,
      String(s.caseManifestRefs.length),
      s.frozenAt ?? "—",
    ]),
  );
}

function runTable(runs: readonly EvaluationRun[]): string {
  if (runs.length === 0) return "No runs recorded yet — use /eval run.";
  return renderTable(
    [
      { header: "Run", width: 30 },
      { header: "Status", width: 12 },
      { header: "Attempts", width: 9 },
      { header: "Started", width: 26 },
    ],
    runs.map((r) => [r.runId as string, r.status, String(r.attemptIds.length), r.startedAt ?? "—"]),
  );
}

function attemptTable(attempts: readonly RunAttempt[]): string {
  if (attempts.length === 0) return "No attempts for this run.";
  return renderTable(
    [
      { header: "Attempt", width: 30 },
      { header: "Status", width: 12 },
      { header: "Case", width: 26 },
      { header: "Tokens", width: 10 },
    ],
    attempts.map((a) => [
      a.attemptId as string,
      a.status,
      a.caseRef as string,
      String(a.tokenUsage.totalTokens),
    ]),
  );
}

export function renderEvalViewOutput(
  activeView: ViewType,
  viewArgs: Record<string, unknown>,
  runtime: RuntimeState,
): string {
  const data = readEvalData(viewArgs);
  // When there is no prefetched eval data AND no runtime, surface the
  // no-runtime message so the view is never blank in a cold CLI session.
  if (data === undefined) {
    if (runtime.snapshot === null && runtime.changeLog.length === 0) {
      return NO_RUNTIME_MESSAGE;
    }
    return "No evaluation data loaded — use /eval list or /eval run.";
  }

  switch (activeView) {
    case "eval-list":
      return ["Evaluation Suites", "", suiteTable(data.suites ?? [])].join("\n");
    case "eval-run": {
      const runs = data.runs ?? [];
      const attempts = data.attempts ?? [];
      const notice = data.notice !== undefined ? `${data.notice.level}: ${data.notice.text}` : "";
      return [
        notice,
        "",
        "Runs",
        runTable(runs),
        ...(data.lastRunId !== undefined
          ? ["", `Latest run: ${data.lastRunId}`, "", attemptTable(attempts)]
          : []),
      ]
        .filter((l) => l.length > 0 || runs.length > 0)
        .join("\n");
    }
    case "eval-report": {
      const runs = data.runs ?? [];
      const attempts = data.attempts ?? [];
      return [
        `Run: ${str(data.lastRunId, "—")}`,
        "",
        runTable(runs),
        "",
        attemptTable(attempts),
      ].join("\n");
    }
    case "eval-compare": {
      const a = data.attemptsA ?? [];
      const b = data.attemptsB ?? [];
      return [
        `Compare ${str(data.runA, "baseline")} vs ${str(data.runB, "current")}`,
        "",
        `Attempts A: ${a.length}`,
        `Attempts B: ${b.length}`,
        `Tokens A: ${a.reduce((s, x) => s + x.tokenUsage.totalTokens, 0)}`,
        `Tokens B: ${b.reduce((s, x) => s + x.tokenUsage.totalTokens, 0)}`,
      ].join("\n");
    }
    default:
      return suiteTable(data.suites ?? []);
  }
}

export function EvalView({ store }: ViewProps): React.ReactElement {
  const activeView = store.activeView ?? "eval-list";
  const output = useMemo(
    () => renderEvalViewOutput(activeView, store.viewArgs, store.runtime),
    [activeView, store],
  );

  const titles: Partial<Record<ViewType, string>> = {
    "eval-run": "Evaluation Run",
    "eval-list": "Evaluation Suites",
    "eval-report": "Evaluation Report",
    "eval-compare": "Evaluation Compare",
  };

  if (activeView === "eval-compare") {
    const data = readEvalData(store.viewArgs);
    const runA = str(data?.runA, "baseline");
    const runB = str(data?.runB, "current");
    return (
      <ViewFrame title="Evaluation Compare" tone={EVAL_TONE}>
        <DiffView
          leftLabel={runA}
          rightLabel={runB}
          left={`attempts: ${data?.attemptsA?.length ?? 0}`}
          right={`attempts: ${data?.attemptsB?.length ?? 0}`}
        />
      </ViewFrame>
    );
  }

  if (activeView === "eval-report") {
    return (
      <ViewFrame title="Evaluation Report" tone={EVAL_TONE}>
        <ReportView
          title="Evaluation Report"
          sections={[
            {
              heading: "Runs",
              content: runTable(dataRaw(store).runs ?? []),
            },
            {
              heading: "Attempts",
              content: attemptTable(dataRaw(store).attempts ?? []),
            },
          ]}
        />
        <Text>{output}</Text>
      </ViewFrame>
    );
  }

  return (
    <ViewFrame title={titles[activeView] ?? "Evaluation"} tone={EVAL_TONE}>
      <Text>{output}</Text>
    </ViewFrame>
  );
}

function dataRaw(store: AppStore): PrefetchedEvalData {
  return readEvalData(store.viewArgs) ?? {};
}

export interface ViewContainerProps {
  readonly viewArgs?: Record<string, unknown>;
  readonly activeView?: ViewType;
}

export default function EvalViewContainer(props: ViewContainerProps): React.ReactElement {
  const store = useAppStore({
    activeView: props.activeView ?? "eval-list",
    viewArgs: props.viewArgs ?? {},
  });
  return <EvalView store={store} />;
}
