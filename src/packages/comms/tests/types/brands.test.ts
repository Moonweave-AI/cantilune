import { describe, expect, expectTypeOf, it } from "vitest";
import {
  channelId,
  descriptorRef,
  messageId,
  type ChannelId,
  type DescriptorRef,
  type MessageId,
} from "../../src/foundation/messageId.js";
import type { IdentityVerifier } from "../../src/security/identityVerifier.js";
import type { EndpointIdentityVerifier } from "../../src/security/endpointIdentityVerifier.js";
import type { A2ATransportAdapterOptions } from "../../src/transports/a2a/a2aTransportAdapter.js";
import type { PeerDirectory } from "../../src/ports/communicationTransport.js";
import type { RotateEndpointPinInput } from "../../src/security/identityRotation.js";
import type { TransferChannelCapabilityInput } from "../../src/security/typedMobility.js";
import type { SessionTransportBinding } from "../../src/session/sessionTransportBinding.js";

describe("comms brand and contract types", () => {
  it("keeps message, channel, and descriptor brands distinct", () => {
    expectTypeOf(messageId("m-1")).toEqualTypeOf<MessageId>();
    expectTypeOf(channelId("c-1")).toEqualTypeOf<ChannelId>();
    expectTypeOf(descriptorRef("d-1")).toEqualTypeOf<DescriptorRef>();
    expectTypeOf(messageId("x")).not.toEqualTypeOf<ChannelId>();
    expectTypeOf(channelId("x")).not.toEqualTypeOf<DescriptorRef>();
    expect(messageId("x")).toBe("x");
    expect(channelId("x")).toBe("x");
  });

  it("keeps IdentityVerifier and EndpointIdentityVerifier as distinct ports", () => {
    expectTypeOf<IdentityVerifier>().not.toEqualTypeOf<EndpointIdentityVerifier>();
    expectTypeOf<IdentityVerifier["verifyPeer"]>().not.toEqualTypeOf<
      EndpointIdentityVerifier["verifyPresentedIdentity"]
    >();
  });

  it("treats A2A HTTP frame handlers as optional overrides", () => {
    expectTypeOf<A2ATransportAdapterOptions["sendFrame"]>().toEqualTypeOf<
      A2ATransportAdapterOptions["sendFrame"] | undefined
    >();
    const options: A2ATransportAdapterOptions = { remoteEndpoint: "https://example.invalid/a2a" };
    expect(options.sendFrame).toBeUndefined();
    expect(options.receiveFrame).toBeUndefined();
  });

  it("requires peer directory pin accessors used by rotation", () => {
    expectTypeOf<PeerDirectory["getPinnedFingerprints"]>().toBeFunction();
    expectTypeOf<PeerDirectory["setPinnedFingerprints"]>().toBeFunction();
    expectTypeOf<RotateEndpointPinInput["admissionReceiptRef"]>().toEqualTypeOf<string>();
    expectTypeOf<RotateEndpointPinInput["oldFingerprint"]>().toEqualTypeOf<string>();
  });

  it("binds typed mobility to SessionTransportBinding and DescriptorRef", () => {
    expectTypeOf<TransferChannelCapabilityInput["session"]>().toEqualTypeOf<SessionTransportBinding>();
    expectTypeOf<TransferChannelCapabilityInput["fromEndpoint"]>().toEqualTypeOf<DescriptorRef>();
    expectTypeOf<TransferChannelCapabilityInput["toEndpoint"]>().toEqualTypeOf<DescriptorRef>();
    expectTypeOf<TransferChannelCapabilityInput["admissionReceiptRef"]>().toEqualTypeOf<string>();
  });
});
