/**
 * Observability wiring for CLI `/observe*` — calls `@cantilune/observability`
 * public API (`createObservabilityService` → FourViewBundle), not a hand-rolled
 * RuntimeState projection. `FourViewBundle.structure` is core
 * `deriveDiagnosticSummary` / `diagnosticStepFromChange` (read-only; not a
 * parallel type and not a SwarmScheduler input).
 */
import {
  actorId,
  actorRef,
  appendRewriteSegment,
  emptyFootprint,
  emptyRunHistory,
  type CollaborationSnapshot,
  type CoordinationChange,
  type LinkEndpoint,
  type SnapshotRef,
  type UnvalidatedTrace,
} from "@cantilune/core";
import {
  createObservabilityService,
  EXTERNAL_AND_INTERNAL_LTS_POLICY,
  type FourViewBundle,
  type ObservationAccessContext,
} from "@cantilune/observability";
import type { CoordinationRuntime } from "@cantilune/runtime";

export interface CliObserveProjection {
  readonly headRef: string;
  readonly sinceRef: string;
  readonly summary: readonly {
    readonly lens: string;
    readonly nodes: number;
    readonly edges: number;
  }[];
  readonly dependency: {
    readonly nodes: readonly { readonly id: string; readonly label: string }[];
    readonly edges: readonly {
      readonly from: string;
      readonly to: string;
      readonly label: string;
    }[];
  };
  readonly resources: readonly {
    readonly resource: string;
    readonly actor: string;
    readonly mode: string;
  }[];
  readonly communication: {
    readonly nodes: readonly { readonly id: string; readonly label: string }[];
    readonly edges: readonly {
      readonly from: string;
      readonly to: string;
      readonly label: string;
    }[];
  };
  readonly structure: {
    readonly nodes: readonly { readonly id: string; readonly label: string }[];
    readonly edges: readonly {
      readonly from: string;
      readonly to: string;
      readonly label: string;
    }[];
  };
  readonly spine: readonly {
    readonly timestamp: number;
    readonly label: string;
    readonly kind: string;
  }[];
  readonly diagnostic: string;
}

export type ObserveResult =
  | { readonly ok: true; readonly projection: CliObserveProjection }
  | { readonly ok: false; readonly message: string };

export interface ObserveController {
  observe(options?: { readonly sinceRef?: string }): ObserveResult;
}

function endpointLabel(endpoint: LinkEndpoint): string {
  return endpoint.kind === "participant" ? String(endpoint.actorId) : String(endpoint.artifactId);
}

function rewriteHistoryForWindow(changes: readonly CoordinationChange[]): UnvalidatedTrace {
  let history = emptyRunHistory();
  for (const change of changes) {
    history = appendRewriteSegment(history, change);
  }
  return history;
}

function cliOperatorAccess(): ObservationAccessContext {
  return {
    principal: actorRef(actorId("cli-operator"), "human"),
    scope: emptyFootprint(),
    visibilityPolicy: EXTERNAL_AND_INTERNAL_LTS_POLICY,
  };
}

function projectBundle(
  bundle: FourViewBundle,
  headRef: string,
  sinceRef: string,
): CliObserveProjection {
  const depLinks = bundle.dependency.links;
  const depNodes = new Map<string, string>();
  for (const link of depLinks) {
    depNodes.set(endpointLabel(link.from), endpointLabel(link.from));
    depNodes.set(endpointLabel(link.to), endpointLabel(link.to));
  }

  const resources = bundle.resource.capabilities.map((capability) => ({
    resource: capability.kind,
    actor: String(capability.holder),
    mode: capability.scope.kind,
  }));

  const sessions = bundle.communication.sessions;
  const commNodes = new Map<string, string>();
  const commEdges: { from: string; to: string; label: string }[] = [];
  for (const session of sessions) {
    const sid = String(session.sessionId);
    commNodes.set(sid, session.visibility);
    const controller = String(session.controller);
    commNodes.set(controller, "controller");
    commEdges.push({ from: controller, to: sid, label: session.visibility });
    for (const participant of session.participants) {
      const pid = String(participant);
      commNodes.set(pid, "participant");
      if (pid !== controller) {
        commEdges.push({ from: pid, to: sid, label: "member" });
      }
    }
  }

  const structuralLinks = bundle.structure.structuralLinks;
  const structNodes = new Map<string, string>();
  for (const link of structuralLinks) {
    structNodes.set(endpointLabel(link.from), endpointLabel(link.from));
    structNodes.set(endpointLabel(link.to), endpointLabel(link.to));
  }

  const spine = bundle.spine.events.map((event, index) => ({
    timestamp: Date.parse(String(event.change.recordedAt)) || Date.now() + index,
    label: `EventSpine[${index}] ${event.change.operationTypeId}`,
    kind: "spine",
  }));

  const stats = bundle.diagnostic?.stats;
  const diagnostic =
    stats === undefined
      ? `Spine events=${bundle.spine.events.length}; diagnostic not attached`
      : `participants=${stats.participants} artifacts=${stats.artifacts} ` +
        `sessions=${stats.sessions} capabilities=${stats.capabilities} ` +
        `links=${stats.links} spine=${bundle.spine.events.length}`;

  return {
    headRef,
    sinceRef,
    summary: [
      { lens: "dependency", nodes: depNodes.size, edges: depLinks.length },
      { lens: "resource", nodes: resources.length, edges: resources.length },
      { lens: "communication", nodes: commNodes.size, edges: commEdges.length },
      { lens: "structure", nodes: structNodes.size, edges: structuralLinks.length },
    ],
    dependency: {
      nodes: [...depNodes.entries()].map(([id, label]) => ({ id, label })),
      edges: depLinks.map((link) => ({
        from: endpointLabel(link.from),
        to: endpointLabel(link.to),
        label: link.kind,
      })),
    },
    resources,
    communication: {
      nodes: [...commNodes.entries()].map(([id, label]) => ({ id, label })),
      edges: commEdges,
    },
    structure: {
      nodes: [...structNodes.entries()].map(([id, label]) => ({ id, label })),
      edges: structuralLinks.map((link) => ({
        from: endpointLabel(link.from),
        to: endpointLabel(link.to),
        label: link.kind,
      })),
    },
    spine,
    diagnostic: `Diagnostics: ${diagnostic}`,
  };
}

export function createObserveController(backends: {
  readonly coordinationRuntime: () => CoordinationRuntime | undefined;
  readonly getSnapshot: (ref: string) => CollaborationSnapshot | undefined;
}): ObserveController {
  const service = createObservabilityService({ requireAccessContext: true });

  return {
    observe(options) {
      const runtime = backends.coordinationRuntime();
      if (runtime === undefined) {
        return { ok: false, message: "no runtime connected" };
      }
      const head = runtime.getHead();
      if (head === undefined) {
        return { ok: false, message: "no snapshot on the runtime head" };
      }
      const headRef = head.snapshotRef;
      const allChanges = runtime.changes();
      const sinceRef = (options?.sinceRef ?? allChanges[0]?.beforeRef ?? headRef) as SnapshotRef;

      const windowChanges = runtime.changes(sinceRef);
      const runHistory =
        windowChanges.length === 0 ? undefined : rewriteHistoryForWindow(windowChanges);

      try {
        const bundle = service.observeCommitted(
          {
            head: () => runtime.getHead()?.snapshotRef,
            getSnapshot: (ref) => backends.getSnapshot(ref as string),
            changesSince: (cursor) => runtime.changes(cursor),
            ...(runHistory !== undefined ? { runHistory: () => runHistory } : {}),
          },
          sinceRef,
          { attachDiagnostic: true, validateInvariants: true },
          cliOperatorAccess(),
        );
        return {
          ok: true,
          projection: projectBundle(bundle, String(headRef), String(sinceRef)),
        };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

/** Read a prefetched observe projection from viewArgs (fail-closed). */
export function readObserveProjection(
  viewArgs: Record<string, unknown>,
): CliObserveProjection | undefined {
  const raw = viewArgs["observeProjection"];
  if (raw === undefined || typeof raw !== "object" || raw === null) {
    return undefined;
  }
  return raw as CliObserveProjection;
}

export function readObserveError(viewArgs: Record<string, unknown>): string | undefined {
  const err = viewArgs["observeError"];
  return typeof err === "string" && err.length > 0 ? err : undefined;
}
