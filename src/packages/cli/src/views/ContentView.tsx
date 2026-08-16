import React from "react";
import { Box, Text } from "ink";
import { NO_RUNTIME_MESSAGE } from "../runtimeSync.js";
import type { AppStore, RuntimeState, ViewType } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { renderTable } from "../render/asciiTable.js";
import { SearchView } from "./SearchView.js";
import { ReportView } from "./ReportView.js";
import { ViewFrame, type ViewTone } from "./ViewFrame.js";
import { str } from "./viewStr.js";

/** Content is inert data, sharing the informational hue with the world views. */
const CONTENT_TONE: ViewTone = "info";

export interface ViewProps {
  readonly store: AppStore;
}

/**
 * Fallback content listing derived from the runtime audit tail. The live TUI
 * prefetched entries through the content store and stashed them in viewArgs; this
 * fallback keeps the synchronous view renderers testable without a store and
 * lets an empty/no-store render still show referenced refs.
 */
function contentEntriesFromRuntime(
  runtime: RuntimeState,
): readonly { ref: string; source: string }[] {
  if (runtime.snapshot === null) {
    return [];
  }

  const seen = new Set<string>();
  const entries: { ref: string; source: string }[] = [];
  for (const entry of runtime.snapshot.auditTail) {
    if (seen.has(entry.payloadRef)) {
      continue;
    }
    seen.add(entry.payloadRef);
    entries.push({ ref: entry.payloadRef, source: entry.source });
  }
  return entries;
}

interface PrefetchedEntry {
  readonly ref: string;
  readonly metadata: {
    readonly size: number;
    readonly mimeType: string;
    readonly createdAt: string;
    readonly createdBy?: string;
  };
}

/** Normalize prefetched entries (from the content store) and audit-tail refs. */
function resolveEntries(
  viewArgs: Record<string, unknown>,
  runtime: RuntimeState,
): { ref: string; size: string; source: string }[] {
  const prefetched = viewArgs.entries;
  if (Array.isArray(prefetched) && prefetched.length > 0) {
    return prefetched.map((entry: PrefetchedEntry) => ({
      ref: entry.ref,
      size: String(entry.metadata.size),
      source: entry.metadata.createdBy ?? "—",
    }));
  }
  return contentEntriesFromRuntime(runtime).map((e) => ({
    ref: e.ref,
    size: "—",
    source: e.source,
  }));
}

export function renderContentViewOutput(
  activeView: ViewType,
  viewArgs: Record<string, unknown>,
  runtime: RuntimeState,
): string {
  if (runtime.snapshot === null && activeView !== "content-cat") {
    return NO_RUNTIME_MESSAGE;
  }

  switch (activeView) {
    case "content-cat":
      return renderContentCatOutput(viewArgs, runtime);
    case "content-ls":
      return renderContentLsOutput(viewArgs, runtime);
    case "content-search":
      return renderContentSearchOutput(viewArgs, runtime);
    case "content-stats":
      return renderContentStatsOutput(viewArgs, runtime);
    case "content-gc":
      return renderContentGcOutput(viewArgs);
    default:
      return renderContentDefaultOutput(viewArgs, runtime);
  }
}

/** /content cat <ref>: prefetched body or an error/empty verdict. */
function renderContentCatOutput(viewArgs: Record<string, unknown>, runtime: RuntimeState): string {
  const ref = str(viewArgs.ref, "—");
  if (runtime.snapshot === null && viewArgs.body === undefined) {
    return NO_RUNTIME_MESSAGE;
  }
  const body = viewArgs.body;
  if (typeof body === "string") {
    return [`ContentRef: ${ref}`, "", body].join("\n");
  }
  if (viewArgs.error === "no-content-store") {
    return [`ContentRef: ${ref}`, "", "No content store connected — start an agent loop."].join(
      "\n",
    );
  }
  if (viewArgs.error === "not-found") {
    return [`ContentRef: ${ref}`, "", "Not found in the content store."].join("\n");
  }
  return [
    `ContentRef: ${ref}`,
    "",
    "Content body not prefetched — run `/content cat <ref>` against a live store.",
  ].join("\n");
}

/** /content ls: blob table (ref, source, size). */
function renderContentLsOutput(viewArgs: Record<string, unknown>, runtime: RuntimeState): string {
  const entries = resolveEntries(viewArgs, runtime);
  if (entries.length === 0) {
    return "No content available.";
  }
  return renderTable(
    [
      { header: "ContentRef", width: 22 },
      { header: "Source", width: 16 },
      { header: "Size", width: 8, align: "right" },
    ],
    entries.map((e) => [e.ref, e.source, e.size]),
  );
}

/** /content search <text>: ref count over the resolved entries. */
function renderContentSearchOutput(
  viewArgs: Record<string, unknown>,
  runtime: RuntimeState,
): string {
  const error = typeof viewArgs.error === "string" ? viewArgs.error : undefined;
  if (error !== undefined) {
    return `Search failed: ${error}`;
  }
  const query = str(viewArgs.text);
  const entries = resolveEntries(viewArgs, runtime);
  return `Search "${query}": ${entries.length} refs`;
}

/** /content stats: prefetched metrics table, or a runtime-derived fallback. */
function renderContentStatsOutput(
  viewArgs: Record<string, unknown>,
  runtime: RuntimeState,
): string {
  const stats = viewArgs.stats as
    { total: number; totalBytes: number; referenced: number; orphans: number } | undefined;
  if (stats !== undefined) {
    return renderTable(
      [
        { header: "Metric", width: 16 },
        { header: "Value", width: 14 },
      ],
      [
        ["Total blobs", String(stats.total)],
        ["Total bytes", String(stats.totalBytes)],
        ["Referenced", String(stats.referenced)],
        ["Orphans", String(stats.orphans)],
      ],
    );
  }
  const entries = resolveEntries(viewArgs, runtime);
  return renderTable(
    [
      { header: "Metric", width: 16 },
      { header: "Value", width: 12 },
    ],
    [
      ["Total blobs", String(entries.length)],
      ["Total bytes", "—"],
      ["Referenced", String(entries.length)],
      ["Orphans", "—"],
    ],
  );
}

/** /content gc: dry-run plan or confirmed deletion count. */
function renderContentGcOutput(viewArgs: Record<string, unknown>): string {
  const orphans = Array.isArray(viewArgs.orphans) ? (viewArgs.orphans as string[]) : [];
  const confirm = viewArgs.confirm === true;
  const deletedCount = typeof viewArgs.deletedCount === "number" ? viewArgs.deletedCount : 0;
  if (viewArgs.error === "no-content-store") {
    return "GC: no content store connected — start an agent loop.";
  }
  if (confirm) {
    return `GC: deleted ${deletedCount} orphaned blob(s).`;
  }
  return [
    `GC dry-run: ${orphans.length} orphaned blob(s) would be deleted.`,
    "Run `/content gc --confirm` to delete.",
    "",
    orphans.length > 0 ? orphans.join("\n") : "(no orphans)",
  ].join("\n");
}

/** Default content view: bare ref list. */
function renderContentDefaultOutput(
  viewArgs: Record<string, unknown>,
  runtime: RuntimeState,
): string {
  const entries = resolveEntries(viewArgs, runtime);
  return entries.length > 0
    ? entries.map((entry) => entry.ref).join("\n")
    : "No content available.";
}

export function ContentView({ store }: ViewProps): React.ReactElement {
  const activeView = store.activeView ?? "content-ls";
  const entries = resolveEntries(store.viewArgs, store.runtime);

  if (store.runtime.snapshot === null && store.viewArgs.body === undefined) {
    return <ViewFrame title="Content Store" tone={CONTENT_TONE} empty={NO_RUNTIME_MESSAGE} />;
  }

  if (activeView === "content-search") {
    const query = str(store.viewArgs.text);
    const all = resolveEntries(store.viewArgs, store.runtime);
    return (
      <Box flexDirection="column" paddingX={1}>
        <SearchView
          query={query}
          results={all
            .filter((entry) => entry.ref.toLowerCase().includes(query.toLowerCase()))
            .map((entry, index) => ({
              line: index + 1,
              content: entry.ref,
              source: entry.source,
            }))}
        />
      </Box>
    );
  }

  if (activeView === "content-gc") {
    const orphans = Array.isArray(store.viewArgs.orphans)
      ? (store.viewArgs.orphans as string[])
      : [];
    const confirm = store.viewArgs.confirm === true;
    const deletedCount =
      typeof store.viewArgs.deletedCount === "number" ? store.viewArgs.deletedCount : 0;
    return (
      <Box flexDirection="column" paddingX={1}>
        <ReportView
          title="Content GC"
          sections={[
            {
              heading: "Scan Result",
              content:
                orphans.length === 0
                  ? "No orphaned blobs found."
                  : `${orphans.length} orphaned blob(s) found.`,
            },
            {
              heading: "Action",
              content: confirm
                ? `Deleted ${deletedCount} orphaned blob(s).`
                : "Dry-run only. Run `/content gc --confirm` to delete.",
            },
          ]}
        />
      </Box>
    );
  }

  const output = renderContentViewOutput(activeView, store.viewArgs, store.runtime);
  const titles: Record<string, string> = {
    "content-cat": "Content Viewer",
    "content-ls": "Content Store",
    "content-stats": "Content Statistics",
  };

  if (entries.length === 0 && activeView === "content-ls") {
    return (
      <ViewFrame
        title={titles[activeView] ?? "Content"}
        tone={CONTENT_TONE}
        empty="No content available."
      />
    );
  }

  return (
    <ViewFrame title={titles[activeView] ?? "Content"} tone={CONTENT_TONE}>
      <Text>{output}</Text>
    </ViewFrame>
  );
}

export interface ViewContainerProps {
  readonly viewArgs?: Record<string, unknown>;
  readonly activeView?: ViewType;
}

export default function ContentViewContainer(props: ViewContainerProps): React.ReactElement {
  const store = useAppStore({
    activeView: props.activeView ?? "content-ls",
    viewArgs: props.viewArgs ?? {},
  });
  return <ContentView store={store} />;
}
