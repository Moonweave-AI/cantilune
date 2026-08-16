import { describe, expect, it } from "vitest";
import { transferChannelCapability } from "../../src/index.js";
import { createProcessEStopGate } from "../../src/adapters/process/processEStopGate.js";
import { descriptorRef } from "../../src/foundation/messageId.js";
import { mobilityReceipt, testSessionBinding } from "../support/a2aV1Fixtures.js";

describe("ADR-0028 typed mobility contract", () => {
  it("E-Stops when channel capability transfer has no admission receipt", async () => {
    const eStop = createProcessEStopGate();
    const session = testSessionBinding();
    const result = await transferChannelCapability({
      session,
      channelId: session.channelId,
      fromEndpoint: session.localEndpoint,
      toEndpoint: descriptorRef("endpoint-delegatee"),
      admissionReceiptRef: "missing",
      eStop,
      resolveReceipt: async () => undefined,
    });
    expect(result.ok).toBe(false);
    expect(eStop.isFrozen()).toBe(true);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("admission_receipt_invalid");
    expect(result.error.phase).toBe("delegate");
    expect(result.error.retryable).toBe(false);
  });

  it("transfers a session channel when a committed receipt is bound to the session", async () => {
    const eStop = createProcessEStopGate();
    const session = testSessionBinding();
    const result = await transferChannelCapability({
      session,
      channelId: session.channelId,
      fromEndpoint: session.localEndpoint,
      toEndpoint: descriptorRef("endpoint-delegatee"),
      admissionReceiptRef: "receipt-1",
      eStop,
      resolveReceipt: async () => mobilityReceipt(),
    });
    expect(result.ok).toBe(true);
    expect(eStop.isFrozen()).toBe(false);
    if (!result.ok) {
      return;
    }
    expect(result.value.sessionId).toBe(session.sessionId);
    expect(result.value.admissionReceiptRef).toBe("receipt-1");
  });
});
