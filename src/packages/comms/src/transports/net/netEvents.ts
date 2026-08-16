import { commsEventId, commsStoreSequence } from "../../foundation/messageId.js";
import type { CommsEventEnvelope, CommsEventKind } from "../../events/commsEvent.js";

export interface NetTransportEventSink {
  emit(event: CommsEventEnvelope): void;
}

let eventCounter = 0;

export function emitNetTransportEvent(
  sink: NetTransportEventSink | undefined,
  kind: CommsEventKind,
  payload: Record<string, string | number | boolean>,
): void {
  if (sink === undefined) {
    return;
  }
  eventCounter += 1;
  sink.emit({
    eventId: commsEventId(`evt-net-${String(eventCounter)}`),
    storeSequence: commsStoreSequence(eventCounter),
    kind,
    occurredAt: new Date().toISOString(),
    payload,
  });
}
