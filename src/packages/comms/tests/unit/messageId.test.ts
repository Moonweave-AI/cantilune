import { describe, expect, it } from "vitest";
import {
  channelGeneration,
  channelId,
  closeRecordId,
  commsEventId,
  commsStoreSequence,
  connectionId,
  deliveryAttemptId,
  descriptorRef,
  messageId,
  reconnectRecordId,
  registryVersion,
  wireVersion,
} from "../../src/foundation/messageId.js";

describe("messageId brands", () => {
  it("constructs branded identifiers", () => {
    expect(messageId("msg-1")).toBe("msg-1");
    expect(channelId("ch-1")).toBe("ch-1");
    expect(connectionId("conn-1")).toBe("conn-1");
    expect(descriptorRef("desc-1")).toBe("desc-1");
    expect(commsEventId("evt-1")).toBe("evt-1");
    expect(deliveryAttemptId("del-1")).toBe("del-1");
    expect(reconnectRecordId("rc-1")).toBe("rc-1");
    expect(closeRecordId("close-1")).toBe("close-1");
  });

  it("constructs numeric brands", () => {
    expect(wireVersion(1)).toBe(1);
    expect(registryVersion(1)).toBe(1);
    expect(channelGeneration(2)).toBe(2);
    expect(commsStoreSequence(5)).toBe(5);
  });
});
