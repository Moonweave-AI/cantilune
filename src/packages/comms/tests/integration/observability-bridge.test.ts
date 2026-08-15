import { describe, expect, it } from "vitest";
import {
  createObservabilityCommsEventBridge,
  createObservabilityCommsEventSink,
} from "../../src/observability/commsEventBridge.js";
import { commsEventId } from "../../src/foundation/messageId.js";

describe("observability comms event bridge", () => {
  it("redacts sensitive payload keys before ingest", () => {
    const sink = createObservabilityCommsEventSink();
    const bridge = createObservabilityCommsEventBridge(sink);
    bridge.emit({
      eventId: commsEventId("evt-obs-001"),
      storeSequence: 1 as never,
      kind: "MessageReceived",
      occurredAt: "2026-08-11T16:00:00Z",
      payload: {
        messageId: "msg-001",
        endpoint: "https://secret",
        credential: "must-not-appear",
      },
    });
    expect(sink.events[0]?.safePayload.messageId).toBe("msg-001");
    expect(sink.events[0]?.safePayload.endpoint).toBeUndefined();
    expect(sink.events[0]?.safePayload.credential).toBeUndefined();
  });
});
