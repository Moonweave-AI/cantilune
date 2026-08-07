import type { ActorId, ArtifactId } from "../primitives/ids.js";
import type { CollaborationSnapshot } from "../coordination/collaborationSnapshot.js";
import type { RunHistory } from "./trace.js";
import { rewriteSegments } from "./trace.js";

/**
 * Read-model node describing emergent structure (derive only — agents do not author this).
 */
export type DerivedCompositionView =
  | { readonly kind: "serial"; readonly parts: readonly DerivedCompositionView[] }
  | { readonly kind: "parallel"; readonly parts: readonly DerivedCompositionView[] }
  | { readonly kind: "nest"; readonly inner: DerivedCompositionView; readonly label: string }
  | { readonly kind: "box"; readonly participantId?: ActorId; readonly artifactId?: ArtifactId };

/**
 * Derive a coarse structural view from committed facts.
 * This is observability / documentation — not the write model for agents.
 */
export function deriveCompositionView(
  snapshot: CollaborationSnapshot,
  history: RunHistory,
): DerivedCompositionView {
  const changes = rewriteSegments(history);
  if (changes.length === 0) {
    return deriveFromSnapshotOnly(snapshot);
  }

  const boxes: DerivedCompositionView[] = changes.map((change) => {
    const artifactTarget = change.targets.find((t) => t.kind === "artifact");
    const participantTarget = change.targets.find((t) => t.kind === "participant");
    return {
      kind: "box" as const,
      ...(participantTarget !== undefined
        ? { participantId: participantTarget.id as ActorId }
        : {}),
      ...(artifactTarget !== undefined ? { artifactId: artifactTarget.id as ArtifactId } : {}),
    };
  });

  if (boxes.length === 1) {
    const single = boxes[0];
    if (single !== undefined) {
      return single;
    }
  }

  return { kind: "serial", parts: boxes };
}

function deriveFromSnapshotOnly(snapshot: CollaborationSnapshot): DerivedCompositionView {
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
