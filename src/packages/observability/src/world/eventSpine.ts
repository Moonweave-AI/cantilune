import { type CoordinationChange } from "@cantilune/core";
import { type EventTag, eventTagFromChange } from "../foundation/eventTag.js";

/** Single spine step — EventTag + core Change (no duplicated change fields). */
export interface SourceEvent {
  readonly eventTag: EventTag;
  readonly change: CoordinationChange;
}

export interface EventSpine {
  readonly events: readonly SourceEvent[];
}

export function sourceEventFromChange(change: CoordinationChange): SourceEvent {
  return {
    eventTag: eventTagFromChange(change),
    change,
  };
}

export function buildEventSpine(changes: readonly CoordinationChange[]): EventSpine {
  return {
    events: changes.map(sourceEventFromChange),
  };
}
