import type { CollaborationSnapshot, ContentRef, OperationTypeId } from "@cantilune/core";
import type { RuntimeViolation } from "../foundation/errors.js";
import { runtimeViolation } from "../foundation/errors.js";
import type { ContentRefAuthority } from "../ports/contentRefAuthority.js";

/**
 * Validate every content pointer that a change is about to introduce into the
 * durable world, regardless of which operation handler produced it.
 *
 * This intentionally runs in the commit path after the pure in-memory apply
 * has exposed the complete artifact delta, but before durable storage, so
 * callers cannot bypass it by invoking CoordinationRuntime directly instead
 * of going through syscall.
 */
export function validateCommitContentAvailability(
  before: CollaborationSnapshot,
  after: CollaborationSnapshot,
  operation: OperationTypeId,
  authority: ContentRefAuthority | undefined,
): RuntimeViolation | undefined {
  const introducedRefs = changedArtifactContentRefs(before, after);
  if (introducedRefs.length === 0) return undefined;

  if (authority === undefined) {
    return runtimeViolation(
      "content_ref_unavailable",
      `${String(operation)} introduces content but no ContentRefAuthority is configured`,
      { operationTypeId: operation, path: "artifacts.contentRef" },
    );
  }

  for (const ref of introducedRefs) {
    try {
      // Runtime integrations can arrive through JavaScript or unsafe casts.
      // Accept only the literal boolean true: a Promise is truthy but is not
      // synchronous commit evidence.
      const available: unknown = authority.isAvailable(ref);
      if (available === true) continue;
    } catch {
      // Authority errors are availability failures. Do not let an I/O exception
      // turn a fail-closed contract into an unhandled runtime escape.
    }

    return runtimeViolation(
      "content_ref_unavailable",
      `contentRef is not available from the authoritative store: ${String(ref)}`,
      { operationTypeId: operation, path: "artifacts.contentRef", actual: String(ref) },
    );
  }

  return undefined;
}

function changedArtifactContentRefs(
  before: CollaborationSnapshot,
  after: CollaborationSnapshot,
): ContentRef[] {
  const refs: ContentRef[] = [];
  for (const [artifactId, artifact] of after.artifacts) {
    if (before.artifacts.get(artifactId)?.contentRef !== artifact.contentRef) {
      refs.push(artifact.contentRef);
    }
  }
  return refs;
}
