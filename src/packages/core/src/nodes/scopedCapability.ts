import type { ActorId, ArtifactId, CapabilityId, SessionId } from "../primitives/ids.js";

/** Kind of linear or scarce scoped resource. */
export type CapabilityKind = "write_lock" | "budget_slot" | "approval_slot" | "tool_lease";

/** What entity a capability is scoped to. */
export type CapabilityScope =
  | { readonly kind: "artifact"; readonly artifactId: ArtifactId }
  | { readonly kind: "session"; readonly sessionId: SessionId };

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
