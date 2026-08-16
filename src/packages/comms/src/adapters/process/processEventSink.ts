/**
 * Explicit process-local EventSink — injectable, never a silent production default.
 */
import type { EventSink } from "../../ports/runtimePorts.js";
import type { CommsEventEnvelope } from "../../events/commsEvent.js";

export interface ProcessEventSink extends EventSink {
  readonly events: readonly CommsEventEnvelope[];
}

export function createProcessEventSink(): ProcessEventSink {
  const events: CommsEventEnvelope[] = [];
  return {
    events,
    emit(event) {
      events.push(event);
    },
  };
}
