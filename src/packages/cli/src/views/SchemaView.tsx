import React from "react";
import { Text } from "ink";
import { NO_RUNTIME_MESSAGE } from "../runtimeSync.js";
import type { AppStore, RuntimeState, ViewType } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { renderTable } from "../render/asciiTable.js";
import { renderTimeline } from "../render/asciiTimeline.js";
import { DiffView } from "./DiffView.js";
import { str } from "./viewStr.js";
import { ReportView } from "./ReportView.js";
import { ViewFrame, type ViewTone } from "./ViewFrame.js";

/** Schema is governance territory; it shares the violet structural accent. */
const SCHEMA_TONE: ViewTone = "accentAlt";

export interface ViewProps {
  readonly store: AppStore;
}

/**
 * Prefetched control-plane data stashed by /schema * handlers. Present once a
 * control-plane controller is connected; the view falls back to the runtime
 * epoch projection when it is absent (e.g. headless/inspect).
 */
export interface PrefetchedSchemaData {
  readonly revisions: readonly {
    readonly schemaRef: {
      readonly schemaId: string;
      readonly revisionId: string;
      readonly digest: string;
    };
    readonly status: string;
    readonly createdAt: string;
  }[];
  readonly activeBinding:
    | {
        readonly epochId: string;
        readonly epochOrdinal: number;
        readonly schemaRef: {
          readonly schemaId: string;
          readonly revisionId: string;
          readonly digest: string;
        };
        readonly activatedBy: string;
        readonly activatedAt: string;
      }
    | undefined;
  readonly revisionDetail:
    | {
        readonly schemaRef: {
          readonly schemaId: string;
          readonly revisionId: string;
          readonly digest: string;
        };
        readonly createdBy: string;
        readonly createdAt: string;
        readonly operationTypeIds: readonly string[];
        readonly objectTypeIds: readonly string[];
      }
    | undefined;
  readonly events: readonly {
    readonly sequence: number;
    readonly kind: string;
    readonly recordedAt: string;
  }[];
  readonly extensionPlan?: {
    readonly ok: boolean;
    readonly addedObjectTypeIds?: readonly string[];
    readonly addedOperationTypeIds?: readonly string[];
    readonly message?: string;
  };
  readonly operations?: readonly SchemaOperationRow[];
  readonly admitResult?: { readonly ok: boolean; readonly message: string };
  readonly commitResult?: { readonly ok: boolean; readonly message: string };
  readonly rollout?: {
    readonly acknowledged: number;
    readonly pending: number;
    readonly drift: number;
    readonly failed: number;
  };
  readonly ephemeral?: boolean;
}

export interface SchemaOperationRow {
  readonly id: string;
  readonly roles: readonly string[];
  readonly visibility: string;
  readonly mayCreateSessions: boolean;
}

export function schemaDataFromRuntime(runtime: RuntimeState): {
  schema: { id: string; epoch: string; ops: number };
  operations: readonly { id: string; kind: string; footprint: string }[];
  epochs: readonly { id: string; preparedAt: string; status: string }[];
} | null {
  if (runtime.epoch === null) {
    return null;
  }

  const operations = [...new Set(runtime.changeLog.map((entry) => entry.operationTypeId))].map(
    (op) => ({
      id: op,
      kind: "unknown",
      footprint: "unavailable-without-control-plane",
    }),
  );

  return {
    schema: {
      id: runtime.epoch.schemaId,
      epoch: runtime.epoch.epochId,
      ops: operations.length,
    },
    operations,
    epochs: [
      {
        id: runtime.epoch.epochId,
        preparedAt: runtime.snapshot?.auditTail[0]?.timestamp ?? new Date().toISOString(),
        status: "active",
      },
    ],
  };
}

function readSchemaData(viewArgs: Record<string, unknown>): PrefetchedSchemaData | undefined {
  const data = viewArgs["schemaData"];
  if (data !== undefined && typeof data === "object" && data !== null && "revisions" in data) {
    return data as PrefetchedSchemaData;
  }
  return undefined;
}

function refString(
  ref: { readonly revisionId: string; readonly digest: string } | undefined,
): string {
  if (ref === undefined) return "—";
  return `${ref.revisionId}@${ref.digest.slice(0, 12)}`;
}

/** Report content for the schema-validate monotone-extension section. */
function extensionPlanContent(prefetched: PrefetchedSchemaData | undefined): string {
  const plan = prefetched?.extensionPlan;
  if (plan === undefined) {
    return "No extension plan computed.";
  }
  if (plan.ok) {
    return `Monotone extension accepted; ${plan.addedOperationTypeIds?.length ?? 0} added operations.`;
  }
  return `Non-monotone: ${plan.message ?? "rejected"}`;
}

/** Report content for the schema-validate runtime-binding section. */
function bindingContent(prefetched: PrefetchedSchemaData | undefined): string {
  const binding = prefetched?.activeBinding;
  if (binding === undefined) {
    return "No active binding.";
  }
  return `Epoch ${binding.epochId} on ${refString(binding.schemaRef)}.`;
}

export function renderSchemaViewOutput(
  activeView: ViewType,
  viewArgs: Record<string, unknown>,
  runtime: RuntimeState,
): string {
  const prefetched = readSchemaData(viewArgs);

  // No control-plane controller connected: fall back to the runtime projection.
  if (prefetched === undefined) {
    return renderSchemaFallback(activeView, viewArgs, runtime);
  }

  const binding = prefetched.activeBinding;
  const detail = prefetched.revisionDetail;
  const ops = detail?.operationTypeIds ?? [];
  const objectTypes = detail?.objectTypeIds ?? [];

  switch (activeView) {
    case "schema-ops":
      return schemaOpsTable(prefetched.operations ?? ops.map((id) => ({
        id,
        roles: [],
        visibility: "unknown",
        mayCreateSessions: false,
      })));
    case "schema-admit":
      return prefetched.admitResult?.message ?? "No admission submitted.";
    case "schema-commit":
      return prefetched.commitResult?.message ?? "No commit attempted.";
    case "schema-rollout":
      return schemaRolloutOutput(prefetched);
    case "schema-epoch":
      return schemaEpochTable(binding, ops, objectTypes);
    case "schema-epoch-history":
      return renderTimeline(
        prefetched.events.map((e) => ({
          timestamp: Date.parse(e.recordedAt),
          label: e.kind,
          kind: "info",
          detail: `seq ${e.sequence}`,
        })),
      );
    case "schema-diff":
      return schemaDiffOutput(viewArgs, prefetched.extensionPlan);
    case "schema-validate":
      return schemaValidateOutput(prefetched.extensionPlan);
    case "schema":
    default:
      return schemaOverviewOutput(prefetched, binding, ops, objectTypes);
  }
}

/** /schema ops: real OperationTypeDeclaration roles / visibility / session flag. */
function schemaOpsTable(ops: readonly SchemaOperationRow[]): string {
  return renderTable(
    [
      { header: "Operation", width: 22 },
      { header: "Roles", width: 22 },
      { header: "Visibility", width: 12 },
      { header: "Sessions", width: 10 },
    ],
    ops.map((op) => [
      op.id,
      op.roles.join(",") || "—",
      op.visibility,
      op.mayCreateSessions ? "yes" : "no",
    ]),
  );
}

function schemaRolloutOutput(prefetched: PrefetchedSchemaData): string {
  const report = prefetched.rollout;
  if (report === undefined) {
    return "No fleet journal (ephemeral control plane or empty bindings).";
  }
  return renderTable(
    [
      { header: "Status", width: 16 },
      { header: "Count", width: 8 },
    ],
    [
      ["acknowledged", String(report.acknowledged)],
      ["pending", String(report.pending)],
      ["drift", String(report.drift)],
      ["failed", String(report.failed)],
    ],
  );
}

/** /schema epoch: the active binding's epoch table. */
function schemaEpochTable(
  binding: PrefetchedSchemaData["activeBinding"],
  ops: readonly string[],
  objectTypes: readonly string[],
): string {
  if (binding === undefined) return "No active schema binding on this control plane.";
  return renderTable(
    [
      { header: "Field", width: 16 },
      { header: "Value", width: 36 },
    ],
    [
      ["epochId", binding.epochId],
      ["epochOrdinal", String(binding.epochOrdinal)],
      ["schemaRef", refString(binding.schemaRef)],
      ["schemaId", binding.schemaRef.schemaId],
      ["activatedBy", binding.activatedBy],
      ["activatedAt", binding.activatedAt],
      ["objectTypes", String(objectTypes.length)],
      ["operations", String(ops.length)],
    ],
  );
}

/** /schema diff: monotone-extension verdict over the extension plan. */
function schemaDiffOutput(
  viewArgs: Record<string, unknown>,
  plan: PrefetchedSchemaData["extensionPlan"],
): string {
  const epochA = str(viewArgs.epochA, "—");
  const epochB = str(viewArgs.epochB, "—");
  if (plan === undefined) {
    return `Diff epochs: ${epochA} vs ${epochB} (no extension plan)`;
  }
  if (!plan.ok) {
    return `Diff ${epochA} → ${epochB}: non-monotone — ${plan.message ?? "rejected"}`;
  }
  return [
    `Diff ${epochA} → ${epochB}: monotone extension`,
    `Added object types: ${plan.addedObjectTypeIds?.length ?? 0}`,
    ...(plan.addedObjectTypeIds ?? []).map((id) => `  + ${id}`),
    `Added operations: ${plan.addedOperationTypeIds?.length ?? 0}`,
    ...(plan.addedOperationTypeIds ?? []).map((id) => `  + ${id}`),
  ].join("\n");
}

/** /schema validate: extension-plan acceptance verdict. */
function schemaValidateOutput(plan: PrefetchedSchemaData["extensionPlan"]): string {
  if (plan === undefined) return "Validation: no extension plan computed.";
  if (!plan.ok) {
    return `Validation: non-monotone extension — ${plan.message ?? "rejected"}`;
  }
  return [
    "Schema Validation",
    `Monotone extension: accepted`,
    `Added object types: ${plan.addedObjectTypeIds?.length ?? 0}`,
    `Added operations: ${plan.addedOperationTypeIds?.length ?? 0}`,
  ].join("\n");
}

/** /schema: overview table, or a revision-list fallback with no active binding. */
function schemaOverviewOutput(
  prefetched: PrefetchedSchemaData,
  binding: PrefetchedSchemaData["activeBinding"],
  ops: readonly string[],
  objectTypes: readonly string[],
): string {
  if (binding === undefined) {
    return [
      `Schema revisions: ${prefetched.revisions.length}`,
      ...(prefetched.revisions.length === 0
        ? ["  (no revisions)"]
        : prefetched.revisions.map((r) => `  ${refString(r.schemaRef)} [${r.status}]`)),
    ].join("\n");
  }
  return renderTable(
    [
      { header: "Field", width: 16 },
      { header: "Value", width: 36 },
    ],
    [
      ["schemaId", binding.schemaRef.schemaId],
      ["schemaRef", refString(binding.schemaRef)],
      ["epoch", binding.epochId],
      ["operations", String(ops.length)],
      ["objectTypes", String(objectTypes.length)],
      ["status", binding === undefined ? "—" : "active"],
    ],
  );
}

function renderSchemaFallback(
  activeView: ViewType,
  viewArgs: Record<string, unknown>,
  runtime: RuntimeState,
): string {
  const data = schemaDataFromRuntime(runtime);
  if (data === null) {
    return NO_RUNTIME_MESSAGE;
  }
  switch (activeView) {
    case "schema-ops":
      return renderTable(
        [
          { header: "Operation", width: 20 },
          { header: "Kind", width: 12 },
          { header: "Footprint", width: 18 },
        ],
        data.operations.map((o) => [o.id, o.kind, o.footprint]),
      );
    case "schema-epoch":
      return renderTable(
        [
          { header: "Field", width: 14 },
          { header: "Value", width: 24 },
        ],
        [
          ["epochId", data.schema.epoch],
          ["schemaId", data.schema.id],
          ["operations", String(data.schema.ops)],
          ["binding", "runtime:memory-local (no control plane)"],
        ],
      );
    case "schema-epoch-history":
      return renderTimeline(
        data.epochs.map((e) => ({
          timestamp: Date.parse(e.preparedAt),
          label: e.id,
          kind: e.status,
          detail: `prepared ${e.preparedAt}`,
        })),
      );
    case "schema-diff":
      return `Diff epochs: ${str(viewArgs.epochA, data.epochs[0]?.id ?? "—")} vs ${str(viewArgs.epochB, data.schema.epoch)}`;
    case "schema-validate":
      return `Validation: schema bound, ${data.schema.ops} observed operations`;
    case "schema":
    default:
      return renderTable(
        [
          { header: "Field", width: 14 },
          { header: "Value", width: 24 },
        ],
        [
          ["schemaId", data.schema.id],
          ["epoch", data.schema.epoch],
          ["operations", String(data.schema.ops)],
          ["status", "active"],
        ],
      );
  }
}

export function SchemaView({ store }: ViewProps): React.ReactElement {
  const activeView = store.activeView ?? "schema";
  const data = schemaDataFromRuntime(store.runtime);
  const prefetched = readSchemaData(store.viewArgs);

  if (prefetched === undefined && data === null) {
    return <ViewFrame title="OrchestrationSchema" tone={SCHEMA_TONE} empty={NO_RUNTIME_MESSAGE} />;
  }

  if (activeView === "schema-diff") {
    const epochA = str(store.viewArgs.epochA, "—");
    const epochB = str(store.viewArgs.epochB, "—");
    return (
      <ViewFrame title="Schema Diff" tone={SCHEMA_TONE}>
        <DiffView
          leftLabel={epochA}
          rightLabel={epochB}
          left={`from: ${epochA}`}
          right={`to: ${epochB}`}
        />
      </ViewFrame>
    );
  }

  if (activeView === "schema-validate") {
    return (
      <ViewFrame title="Schema Validation" tone={SCHEMA_TONE}>
        <ReportView
          title="Schema Validation"
          sections={[
            {
              heading: "Monotone Extension",
              content: extensionPlanContent(prefetched),
            },
            {
              heading: "Runtime Binding",
              content: bindingContent(prefetched),
            },
            { heading: "Policy", content: "Policy evaluation delegated to runtime admission." },
          ]}
        />
      </ViewFrame>
    );
  }

  const output = renderSchemaViewOutput(activeView, store.viewArgs, store.runtime);
  const titles: Record<string, string> = {
    schema: "OrchestrationSchema",
    "schema-ops": "Operation Templates",
    "schema-epoch": "Current Epoch",
    "schema-epoch-history": "Epoch History",
    "schema-admit": "Schema Admit",
    "schema-commit": "Schema Commit",
    "schema-rollout": "Schema Rollout",
  };

  return (
    <ViewFrame title={titles[activeView] ?? "Schema"} tone={SCHEMA_TONE}>
      <Text>{output}</Text>
    </ViewFrame>
  );
}

export interface ViewContainerProps {
  readonly viewArgs?: Record<string, unknown>;
  readonly activeView?: ViewType;
}

export default function SchemaViewContainer(props: ViewContainerProps): React.ReactElement {
  const store = useAppStore({
    activeView: props.activeView ?? "schema",
    viewArgs: props.viewArgs ?? {},
  });
  return <SchemaView store={store} />;
}
