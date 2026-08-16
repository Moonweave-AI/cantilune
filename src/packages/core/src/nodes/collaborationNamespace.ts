import { DEFAULT_NAMESPACE_ID, type ActorId, type NamespaceId } from "../primitives/ids.js";

/**
 * Isolation domain for participants, transcripts, and fleet RBAC (ADR-0022).
 * Temporal/Kubernetes Namespace analogue — not a parallel tenant identity.
 */
export interface CollaborationNamespace {
  readonly namespaceId: NamespaceId;
  readonly displayName: string;
  readonly adminPrincipals: readonly ActorId[];
}

export function collaborationNamespace(
  namespaceId: NamespaceId,
  displayName: string,
  adminPrincipals: readonly ActorId[] = [],
): CollaborationNamespace {
  return { namespaceId, displayName, adminPrincipals };
}

export const DEFAULT_NAMESPACE = collaborationNamespace(
  DEFAULT_NAMESPACE_ID,
  "default",
);

export function resolveNamespaceId(value: NamespaceId | undefined): NamespaceId {
  return value ?? DEFAULT_NAMESPACE_ID;
}
