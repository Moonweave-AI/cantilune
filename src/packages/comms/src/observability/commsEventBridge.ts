import { type CommsEventEnvelope } from "../events/commsEvent.js";
import { type EventSink } from "../ports/runtimePorts.js";

type SafePayload = Record<string, string | number | boolean>;

/** Sanitized communication lens event for observability ingestion. */
export interface ObservabilityCommsEvent {
  readonly kind: string;
  readonly occurredAt: string;
  readonly storeSequence: number;
  readonly correlationId?: string;
  readonly occurrenceId?: string;
  readonly safePayload: SafePayload;
}

export interface ObservabilityCommsEventSink {
  readonly ingest: (event: ObservabilityCommsEvent) => void;
  readonly events: readonly ObservabilityCommsEvent[];
}

export function createObservabilityCommsEventSink(): ObservabilityCommsEventSink {
  const events: ObservabilityCommsEvent[] = [];
  return {
    ingest(event) {
      events.push(event);
    },
    get events() {
      return [...events];
    },
  };
}

/** Bridges comms EventSink to observability-safe sanitized events. */
export class ObservabilityCommsEventBridge implements EventSink {
  constructor(private readonly sink: ObservabilityCommsEventSink) {}

  emit(event: CommsEventEnvelope): void {
    this.sink.ingest({
      kind: event.kind,
      occurredAt: event.occurredAt,
      storeSequence: event.storeSequence as number,
      ...(event.correlationId !== undefined ? { correlationId: event.correlationId } : {}),
      ...(event.occurrenceId !== undefined ? { occurrenceId: event.occurrenceId } : {}),
      safePayload: sanitizePayload(event.payload),
    });
  }
}

export function createObservabilityCommsEventBridge(
  sink: ObservabilityCommsEventSink,
): ObservabilityCommsEventBridge {
  return new ObservabilityCommsEventBridge(sink);
}

function sanitizePayload(payload: SafePayload): SafePayload {
  const out: SafePayload = {};
  for (const [key, value] of Object.entries(payload)) {
    if (/secret|credential|token|payload|prompt|endpoint/i.test(key)) {
      continue;
    }
    out[key] = value;
  }
  return out;
}
