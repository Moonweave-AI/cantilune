import type { Timestamp } from "../primitives/time.js";

/** Auditable record of a removed participant, session, capability, or link. */
export const RETIRED_ENTITY_KINDS = [
  "participant",
  "session",
  "capability",
  "link",
  "artifact",
] as const;

export type RetiredEntityKind = (typeof RETIRED_ENTITY_KINDS)[number];

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
