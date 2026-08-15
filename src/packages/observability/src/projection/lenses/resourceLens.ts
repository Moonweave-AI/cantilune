import {
  type CapabilityId,
  type CollaborationSnapshot,
  type ScopedCapability,
} from "@cantilune/core";
import { type EventTag } from "../../foundation/eventTag.js";
import { type ResourceDelta } from "../../spine/projectionSlice.js";

function capabilityChanged(before: ScopedCapability | undefined, after: ScopedCapability): boolean {
  if (before === undefined) {
    return true;
  }
  return (
    before.holder !== after.holder ||
    before.kind !== after.kind ||
    before.scope.kind !== after.scope.kind ||
    (before.scope.kind === "artifact" &&
      after.scope.kind === "artifact" &&
      before.scope.artifactId !== after.scope.artifactId) ||
    (before.scope.kind === "session" &&
      after.scope.kind === "session" &&
      before.scope.sessionId !== after.scope.sessionId)
  );
}

function removedCapabilityIds(
  before: CollaborationSnapshot,
  after: CollaborationSnapshot,
): CapabilityId[] {
  const removed: CapabilityId[] = [];
  for (const capabilityId of before.capabilities.keys()) {
    if (!after.capabilities.has(capabilityId)) {
      removed.push(capabilityId as CapabilityId);
    }
  }
  return removed;
}

export function interpretResourceDelta(
  eventTag: EventTag,
  before: CollaborationSnapshot,
  after: CollaborationSnapshot,
): ResourceDelta {
  const updatedCapabilities: ScopedCapability[] = [];
  for (const [capabilityId, capability] of after.capabilities) {
    const previous = before.capabilities.get(capabilityId as CapabilityId);
    if (capabilityChanged(previous, capability)) {
      updatedCapabilities.push(capability);
    }
  }
  return {
    eventTag,
    updatedCapabilities,
    removedCapabilityIds: removedCapabilityIds(before, after),
  };
}
