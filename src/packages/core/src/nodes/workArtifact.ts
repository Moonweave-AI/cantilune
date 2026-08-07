import type { ActorId, ArtifactId } from "../primitives/ids.js";
import type { ContentRef } from "../primitives/refs.js";
import type { ActorRef } from "./participant.js";

/** Lifecycle stage of a work artifact in the coordination flow. */
export type ArtifactLifecycle =
  | "proposed"
  | "active"
  | "reviewable"
  | "published"
  | "retired";

/**
 * Passable work object (task, plan, draft, deliverable, evidence).
 * Body lives at contentRef — never embedded in CoordinationChange.
 */
export interface WorkArtifact {
  readonly artifactId: ArtifactId;
  readonly kind: string;
  readonly contentRef: ContentRef;
  readonly owner: ActorRef;
  readonly lifecycle: ArtifactLifecycle;
}

export function workArtifact(
  artifactId: ArtifactId,
  kind: string,
  contentRefValue: ContentRef,
  owner: ActorRef,
  lifecycle: ArtifactLifecycle = "proposed",
): WorkArtifact {
  return {
    artifactId,
    kind,
    contentRef: contentRefValue,
    owner,
    lifecycle,
  };
}

/** Update artifact fields immutably. */
export function withArtifactLifecycle(
  artifact: WorkArtifact,
  lifecycle: ArtifactLifecycle,
): WorkArtifact {
  return { ...artifact, lifecycle };
}

export function withArtifactOwner(artifact: WorkArtifact, owner: ActorRef): WorkArtifact {
  return { ...artifact, owner };
}
