import { describe, expect, it } from "vitest";
import {
  createA2AExternalAgentBroker,
  A2AExternalAgentBroker,
} from "../../src/integration/a2aExternalAgentHarness.js";
import { encodeA2AFrame } from "../../src/transports/a2a/a2aCodec.js";

describe("A2AExternalAgentBroker", () => {
  it("routes frames between registered agents", async () => {
    const broker = createA2AExternalAgentBroker();
    broker.registerAgent({ agentId: "agent-ext-1", profile: "a2a/0.1" });
    const frame = encodeA2AFrame(
      { profile: "a2a/0.1", wireVersion: 1, messageKind: "envelope" },
      new TextEncoder().encode("body"),
    );
    const sent = await broker.sendTo("agent-ext-1", frame);
    expect(sent.ok).toBe(true);
    const received = await broker.receiveFrom("agent-ext-1");
    expect(received.ok).toBe(true);
  });

  it("rejects unknown agent", async () => {
    const broker = new A2AExternalAgentBroker();
    const result = await broker.sendTo("missing", new Uint8Array());
    expect(result.ok).toBe(false);
  });

  it("runExternalAgentLoop echoes ack for valid frame", async () => {
    const broker = createA2AExternalAgentBroker();
    broker.registerAgent({ agentId: "agent-loop", profile: "a2a/0.1" });
    const frame = encodeA2AFrame(
      { profile: "a2a/0.1", wireVersion: 1, messageKind: "handshake" },
      new TextEncoder().encode("{}"),
    );
    await broker.sendTo("agent-loop", frame);
    await broker.runExternalAgentLoop("agent-loop");
    const ack = await broker.receiveFrom("agent-loop");
    expect(ack.ok).toBe(true);
  });
});
