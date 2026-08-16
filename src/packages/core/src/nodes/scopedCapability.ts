import type {
  ActorId,
  ArtifactId,
  CapabilityId,
  NamespaceId,
  SessionId,
} from "../primitives/ids.js";

/** Kind of linear or scarce scoped resource. */
export const CAPABILITY_KINDS = [
  "write_lock",
  "budget_slot",
  "approval_slot",
  "tool_lease",
  "transcript_read",
] as const;

export type CapabilityKind = (typeof CAPABILITY_KINDS)[number];

/** What entity a capability is scoped to. */
export type CapabilityScope =
  | { readonly kind: "artifact"; readonly artifactId: ArtifactId }
  | { readonly kind: "session"; readonly sessionId: SessionId }
  | { readonly kind: "transcript"; readonly actorId: ActorId; readonly namespaceId: NamespaceId };

/**
 * Non-copyable scoped resource (Petri token analogue).
 * holder is unique — duplication must be explicit via CoordinationChange.
 */
export interface ScopedCapability {
  readonly capabilityId: CapabilityId;
  readonly kind: CapabilityKind;
  readonly holder: ActorId;
  readonly scope: CapabilityScope;
}

export function scopedCapability(
  capabilityId: CapabilityId,
  kind: CapabilityKind,
  holder: ActorId,
  scope: CapabilityScope,
): ScopedCapability {
  return { capabilityId, kind, holder, scope };
}

export function withCapabilityHolder(
  capability: ScopedCapability,
  holder: ActorId,
): ScopedCapability {
  return { ...capability, holder };
}
