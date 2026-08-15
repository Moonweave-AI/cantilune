import type { ActorId, ArtifactId } from "../primitives/ids.js";
import type { CollaborationSnapshot } from "../coordination/collaborationSnapshot.js";
import type { CoordinationChange } from "../coordination/coordinationChange.js";
import type { RunHistory } from "./trace.js";
import { rewriteSegments } from "./trace.js";

/**
 * Diagnostic read-model node — not authoritative for scheduling or concurrency.
 * Use only for observability summaries until structure projection ADR closes.
 */
export type DerivedDiagnosticView =
  | { readonly kind: "serial"; readonly parts: readonly DerivedDiagnosticView[] }
  | { readonly kind: "parallel"; readonly parts: readonly DerivedDiagnosticView[] }
  | { readonly kind: "nest"; readonly inner: DerivedDiagnosticView; readonly label: string }
  | { readonly kind: "box"; readonly participantId?: ActorId; readonly artifactId?: ArtifactId };

/** @deprecated Renamed to {@link DerivedDiagnosticView}. */
export type DerivedCompositionView = DerivedDiagnosticView;

/**
 * Derive a coarse diagnostic summary from committed facts.
 * Not a trustworthy structure projection — do not use for scheduling decisions.
 */
export function deriveDiagnosticSummary(
  snapshot: CollaborationSnapshot,
  history: RunHistory,
): DerivedDiagnosticView {
  const changes = rewriteSegments(history);
  if (changes.length === 0) {
    return deriveFromSnapshotOnly(snapshot);
  }

  const views = changes.map((change) => diagnosticStepFromChange(change));

  if (views.length === 1) {
    const single = views[0];
    if (single !== undefined) {
      return single;
    }
  }

  return { kind: "serial", parts: views };
}

/** Single-step diagnostic view for one committed change — shared with observability structure lens. */
export function diagnosticStepFromChange(change: CoordinationChange): DerivedDiagnosticView {
  if (change.operationTypeId === "create_session") {
    const sessionRef = change.createdSessionRefs[0];
    const participantTargets = change.targets.filter((target) => target.kind === "participant");
    const inner =
      participantTargets.length <= 1
        ? {
            kind: "box" as const,
            ...(participantTargets[0] !== undefined
              ? { participantId: participantTargets[0].id as ActorId }
              : { participantId: change.initiator.actorId }),
          }
        : {
            kind: "parallel" as const,
            parts: participantTargets.map((target) => ({
              kind: "box" as const,
              participantId: target.id as ActorId,
            })),
          };
    return {
      kind: "nest",
      inner,
      label: sessionRef ?? "session",
    };
  }

  if (change.operationTypeId === "fork_branch") {
    const participantTargets = change.targets.filter((target) => target.kind === "participant");
    const branchIds =
      participantTargets.length > 0
        ? participantTargets.map((target) => target.id as ActorId)
        : [change.initiator.actorId];
    return {
      kind: "parallel",
      parts: branchIds.map((participantId) => ({ kind: "box" as const, participantId })),
    };
  }

  const artifactTarget = change.targets.find((target) => target.kind === "artifact");
  const participantTarget = change.targets.find((target) => target.kind === "participant");
  return {
    kind: "box" as const,
    ...(participantTarget !== undefined ? { participantId: participantTarget.id as ActorId } : {}),
    ...(artifactTarget !== undefined ? { artifactId: artifactTarget.id as ArtifactId } : {}),
  };
}

/** @deprecated Use {@link deriveDiagnosticSummary}. */
export function deriveCompositionView(
  snapshot: CollaborationSnapshot,
  history: RunHistory,
): DerivedDiagnosticView {
  return deriveDiagnosticSummary(snapshot, history);
}

function deriveFromSnapshotOnly(snapshot: CollaborationSnapshot): DerivedDiagnosticView {
  const participants = [...snapshot.participants.values()];
  if (participants.length === 0) {
    return { kind: "box" };
  }
  if (participants.length === 1) {
    const p = participants[0];
    if (p !== undefined) {
      return { kind: "box", participantId: p.actorId };
    }
  }
  return {
    kind: "parallel",
    parts: participants.map((p) => ({ kind: "box" as const, participantId: p.actorId })),
  };
}

/** Count active entities for quick diagnostics. */
export function deriveSnapshotStats(snapshot: CollaborationSnapshot): {
  readonly participants: number;
  readonly artifacts: number;
  readonly links: number;
  readonly sessions: number;
  readonly capabilities: number;
  readonly observations: number;
  readonly changes: number;
} {
  return {
    participants: snapshot.participants.size,
    artifacts: snapshot.artifacts.size,
    links: snapshot.links.size,
    sessions: snapshot.sessions.size,
    capabilities: snapshot.capabilities.size,
    observations: snapshot.auditTail.length,
    changes: 0,
  };
}

export function deriveSnapshotStatsWithHistory(
  snapshot: CollaborationSnapshot,
  history: RunHistory,
): ReturnType<typeof deriveSnapshotStats> {
  return {
    ...deriveSnapshotStats(snapshot),
    changes: rewriteSegments(history).length,
  };
}
