import { describe, expect, it } from "vitest";
import { transferChannelCapability } from "../../src/security/typedMobility.js";
import { createProcessEStopGate } from "../../src/adapters/process/processEStopGate.js";
import { channelId, descriptorRef } from "../../src/foundation/messageId.js";
import { mobilityReceipt, testSessionBinding } from "../support/a2aV1Fixtures.js";

describe("transferChannelCapability branches", () => {
  it("rejects an empty receipt ref and freezes E-Stop", async () => {
    const eStop = createProcessEStopGate();
    const session = testSessionBinding();
    const result = await transferChannelCapability({
      session,
      channelId: session.channelId,
      fromEndpoint: session.localEndpoint,
      toEndpoint: descriptorRef("endpoint-b"),
      admissionReceiptRef: "  ",
      eStop,
      resolveReceipt: async () => mobilityReceipt(),
    });
    expect(result.ok).toBe(false);
    expect(eStop.isFrozen()).toBe(true);
  });

  it("rejects a resolver throw and an unusable receipt", async () => {
    const session = testSessionBinding();
    const thrown = await transferChannelCapability({
      session,
      channelId: session.channelId,
      fromEndpoint: session.localEndpoint,
      toEndpoint: descriptorRef("endpoint-b"),
      admissionReceiptRef: "boom",
      eStop: createProcessEStopGate(),
      resolveReceipt: async () => {
        throw new Error("nope");
      },
    });
    expect(thrown.ok).toBe(false);

    const unusable = await transferChannelCapability({
      session,
      channelId: session.channelId,
      fromEndpoint: session.localEndpoint,
      toEndpoint: descriptorRef("endpoint-b"),
      admissionReceiptRef: "bad",
      eStop: createProcessEStopGate(),
      resolveReceipt: async () => mobilityReceipt({ authorizationEvidenceRef: "" }),
    });
    expect(unusable.ok).toBe(false);
  });

  it("rejects snapshot, channel, endpoint, and empty toEndpoint mismatches", async () => {
    const session = testSessionBinding();
    const snap = await transferChannelCapability({
      session,
      channelId: session.channelId,
      fromEndpoint: session.localEndpoint,
      toEndpoint: descriptorRef("endpoint-b"),
      admissionReceiptRef: "r",
      eStop: createProcessEStopGate(),
      resolveReceipt: async () => mobilityReceipt({ afterSnapshotRef: "other" as never }),
    });
    expect(snap.ok).toBe(false);

    const channel = await transferChannelCapability({
      session,
      channelId: channelId("other-channel"),
      fromEndpoint: session.localEndpoint,
      toEndpoint: descriptorRef("endpoint-b"),
      admissionReceiptRef: "r",
      eStop: createProcessEStopGate(),
      resolveReceipt: async () => mobilityReceipt(),
    });
    expect(channel.ok).toBe(false);

    const endpoint = await transferChannelCapability({
      session,
      channelId: session.channelId,
      fromEndpoint: descriptorRef("not-on-session"),
      toEndpoint: descriptorRef("endpoint-b"),
      admissionReceiptRef: "r",
      eStop: createProcessEStopGate(),
      resolveReceipt: async () => mobilityReceipt(),
    });
    expect(endpoint.ok).toBe(false);

    const emptyTo = await transferChannelCapability({
      session,
      channelId: session.channelId,
      fromEndpoint: session.localEndpoint,
      toEndpoint: descriptorRef("   "),
      admissionReceiptRef: "r",
      eStop: createProcessEStopGate(),
      resolveReceipt: async () => mobilityReceipt(),
    });
    expect(emptyTo.ok).toBe(false);
  });

  it("returns comms_frozen when E-Stop is already active", async () => {
    const eStop = createProcessEStopGate(true);
    const session = testSessionBinding();
    const result = await transferChannelCapability({
      session,
      channelId: session.channelId,
      fromEndpoint: session.localEndpoint,
      toEndpoint: descriptorRef("endpoint-b"),
      admissionReceiptRef: "r",
      eStop,
      resolveReceipt: async () => mobilityReceipt(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("comms_frozen");
    }
  });

  it("accepts the remote session endpoint as fromEndpoint", async () => {
    const session = testSessionBinding();
    const result = await transferChannelCapability({
      session,
      channelId: session.channelId,
      fromEndpoint: session.remoteEndpoint,
      toEndpoint: descriptorRef("endpoint-b"),
      admissionReceiptRef: "r",
      eStop: createProcessEStopGate(),
      resolveReceipt: async () => mobilityReceipt(),
    });
    expect(result.ok).toBe(true);
  });
});
