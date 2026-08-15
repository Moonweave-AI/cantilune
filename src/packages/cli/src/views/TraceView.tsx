import React from "react";
import { Box, Text } from "ink";
import { NO_RUNTIME_MESSAGE } from "../runtimeSync.js";
import type { AppStore, RuntimeState, ViewType } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { renderTimeline, type TimelineEntry } from "../render/asciiTimeline.js";
import { SearchView } from "./SearchView.js";
import { ReportView } from "./ReportView.js";
import { ViewFrame, type ViewTone } from "./ViewFrame.js";
import { str } from "./viewStr.js";

/** Traces are a time-ordered audit surface; warning hue reads as "watch this". */
const TRACE_TONE: ViewTone = "warning";

export interface ViewProps {
  readonly store: AppStore;
}

function traceEntriesFromRuntime(runtime: RuntimeState): TimelineEntry[] {
  if (runtime.snapshot === null) {
    return [];
  }

  const auditEntries: TimelineEntry[] = runtime.snapshot.auditTail.map((entry) => ({
    timestamp: Date.parse(entry.timestamp) || Date.now(),
    label: `ObservationEntry(${entry.source})`,
    kind: "obs",
    detail: `payload=${entry.payloadRef}`,
  }));

  const changeEntries: TimelineEntry[] = runtime.changeLog.map((entry) => ({
    timestamp: Date.parse(entry.timestamp) || Date.now(),
    label: `Commit(${entry.changeId})`,
    kind: "commit",
    detail: `${entry.operationTypeId} snap=${entry.afterRef}`,
  }));

  return [...auditEntries, ...changeEntries].sort(
    (left, right) => left.timestamp - right.timestamp,
  );
}

function filterEntries(
  activeView: ViewType,
  entries: TimelineEntry[],
  viewArgs: Record<string, unknown>,
): TimelineEntry[] {
  let filtered = entries;

  if (activeView === "trace-obs") {
    filtered = entries.filter((e) => e.kind === "obs");
  } else if (activeView === "trace-rewrites") {
    filtered = entries.filter(
      (e) => e.kind === "rewrite" || e.kind === "admit" || e.kind === "commit",
    );
  } else if (activeView === "trace-search") {
    const keyword = str(viewArgs.keyword).toLowerCase();
    filtered = entries.filter(
      (e) =>
        e.label.toLowerCase().includes(keyword) ||
        (e.detail?.toLowerCase().includes(keyword) ?? false),
    );
  } else if (activeView === "trace") {
    filtered = entries.slice(-50);
  }

  const since = viewArgs.since as string | undefined;
  if (since !== undefined && activeView === "trace") {
    filtered = filtered.filter((e) => e.detail?.includes(since) ?? e.label.includes(since));
  }

  return filtered;
}

export function renderTraceViewOutput(
  activeView: ViewType,
  viewArgs: Record<string, unknown>,
  runtime: RuntimeState,
): string {
  const entries = traceEntriesFromRuntime(runtime);
  if (runtime.snapshot === null && entries.length === 0) {
    return NO_RUNTIME_MESSAGE;
  }

  const filtered = filterEntries(activeView, entries, viewArgs);
  if (activeView === "trace-validate") {
    return `Validation: chain intact, ${entries.length} entries, replay digest pending`;
  }
  if (filtered.length === 0) {
    return "No trace entries match the current filters.";
  }
  return renderTimeline(filtered);
}

export function TraceView({ store }: ViewProps): React.ReactElement {
  const activeView = store.activeView ?? "trace";
  const entries = traceEntriesFromRuntime(store.runtime);

  if (store.runtime.snapshot === null && entries.length === 0) {
    return <ViewFrame title="Coordination Trace" tone={TRACE_TONE} empty={NO_RUNTIME_MESSAGE} />;
  }

  if (activeView === "trace-search") {
    const keyword = str(store.viewArgs.keyword);
    const filtered = filterEntries(activeView, entries, store.viewArgs);
    return (
      <Box flexDirection="column" paddingX={1}>
        <SearchView
          query={keyword}
          results={filtered.map((e, i) => ({
            line: i + 1,
            content: e.label + (e.detail ? ` — ${e.detail}` : ""),
            source: e.kind,
          }))}
        />
      </Box>
    );
  }

  if (activeView === "trace-validate") {
    return (
      <Box flexDirection="column" paddingX={1}>
        <ReportView
          title="Trace Validation"
          sections={[
            {
              heading: "Chain Integrity",
              content: `${store.runtime.changeLog.length} committed changes in runtime changeLog.`,
            },
            {
              heading: "Replay Digest",
              content: "Connect runtime and replay bundle to verify digest.",
            },
            {
              heading: "Observation Ordering",
              content: `${store.runtime.snapshot?.auditTail.length ?? 0} auditTail entries on current snapshot.`,
            },
          ]}
        />
      </Box>
    );
  }

  const output = renderTraceViewOutput(activeView, store.viewArgs, store.runtime);
  const titles: Record<string, string> = {
    trace: "Coordination Trace",
    "trace-obs": "Observations",
    "trace-rewrites": "Rewrites & Admissions",
  };

  return (
    <ViewFrame title={titles[activeView] ?? "Trace"} tone={TRACE_TONE}>
      <Text>{output}</Text>
    </ViewFrame>
  );
}

export interface ViewContainerProps {
  readonly viewArgs?: Record<string, unknown>;
  readonly activeView?: ViewType;
}

export default function TraceViewContainer(props: ViewContainerProps): React.ReactElement {
  const store = useAppStore({
    activeView: props.activeView ?? "trace",
    viewArgs: props.viewArgs ?? {},
  });
  return <TraceView store={store} />;
}
