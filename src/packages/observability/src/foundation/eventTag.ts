import {
  type ChangeId,
  type EpochId,
  type OperationTypeId,
  type Timestamp,
  type CoordinationChange,
} from "@cantilune/core";

/** Cross-projection join key — canonical identity is {@link ChangeId}. */
export interface EventTag {
  readonly changeId: ChangeId;
  readonly epochId: EpochId;
  readonly operationTypeId: OperationTypeId;
  readonly recordedAt: Timestamp;
}

export function eventTagFromChange(change: CoordinationChange): EventTag {
  return {
    changeId: change.changeId,
    epochId: change.epochId,
    operationTypeId: change.operationTypeId,
    recordedAt: change.recordedAt,
  };
}

/** Canonical index key — ChangeId only (non-colliding). */
export function eventTagKey(tag: EventTag): string {
  return tag.changeId;
}

export function eventTagsMetadataEqual(left: EventTag, right: EventTag): boolean {
  return (
    left.changeId === right.changeId &&
    left.epochId === right.epochId &&
    left.operationTypeId === right.operationTypeId &&
    left.recordedAt === right.recordedAt
  );
}
