import { randomUUID } from "node:crypto";
import { BOOT_EPOCH_ID } from "@cantilune/boot";
import type { ActorKind, CollaborationSnapshot } from "@cantilune/core";
import { actorId, collaborationSnapshot, participant, snapshotRef } from "@cantilune/core";

/** Construct the candidate T0 used by both config reconciliation and boot. */
export function createCliInitialSnapshot(
  principalId: string,
  principalKind: ActorKind = "agent",
): CollaborationSnapshot {
  const bootParticipantId = actorId(principalId);
  return collaborationSnapshot({
    snapshotRef: snapshotRef(`genesis-${randomUUID()}`),
    epochId: BOOT_EPOCH_ID,
    participants: new Map([[bootParticipantId, participant(bootParticipantId, principalKind)]]),
  });
}
