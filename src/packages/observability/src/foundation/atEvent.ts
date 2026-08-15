import { type EventTag } from "./eventTag.js";

/** Thin index wrapper — value must be a core type, not an observability entity. */
export interface AtEvent<T> {
  readonly eventTag: EventTag;
  readonly value: T;
}

export function atEvent<T>(eventTag: EventTag, value: T): AtEvent<T> {
  return { eventTag, value };
}
