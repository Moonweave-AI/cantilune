import type { Timestamp } from "../primitives/time.js";

/** Auditable record of a removed participant, session, capability, or link. */
export type RetiredEntityKind = "participant" | "session" | "capability" | "link" | "artifact";

export interface EntityTombstone {
  readonly entityId: string;
  readonly entityKind: RetiredEntityKind;
  readonly retiredAt: Timestamp;
  readonly reasonRef?: string;
}

export function entityTombstone(
  entityId: string,
  entityKind: RetiredEntityKind,
  retiredAt: Timestamp,
  reasonRef?: string,
): EntityTombstone {
  if (reasonRef === undefined) {
    return { entityId, entityKind, retiredAt };
  }
  return { entityId, entityKind, retiredAt, reasonRef };
}
