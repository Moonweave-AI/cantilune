import { describe, it, expect } from "vitest";
import { actorId, collaborationSnapshot, snapshotRef, epochId, participant } from "@cantilune/core";
import type { ParticipationStatus } from "@cantilune/core";
import type { SyscallRuntime, SyscallPrincipal, OperationSchemaProvider } from "@cantilune/syscall";
import { clusterPerceive, type InboxMessageSummary } from "../../src/clusterPerceive.js";

function makeRuntime(participantList: [string, string][]): SyscallRuntime {
  const map = new Map(
    participantList.map(([id, status]) => [
      actorId(id),
      participant(actorId(id), "agent", status as ParticipationStatus),
    ]),
  );
  const snap = collaborationSnapshot({
    snapshotRef: snapshotRef("s1"),
    epochId: epochId("e1"),
    participants: map,
  });
  return { getHead: () => snap } as unknown as SyscallRuntime;
}

function makeEmptyRuntime(): SyscallRuntime {
  return { getHead: () => undefined } as unknown as SyscallRuntime;
}

const principal: SyscallPrincipal = { actorId: "agent-a", kind: "agent" };

const schemaProvider: OperationSchemaProvider = {
  getTemplates() {
    return [];
  },
};

describe("clusterPerceive", () => {
  describe("cluster status rendering", () => {
    it("returns single-agent mode when only one participant", async () => {
      const runtime = makeRuntime([["agent-a", "active"]]);
      const result = await clusterPerceive(runtime, principal, schemaProvider);
      expect(result.clusterStatus).toContain("Single-agent mode");
    });

    it("returns cluster participant count for multiple agents", async () => {
      const runtime = makeRuntime([
        ["agent-a", "active"],
        ["agent-b", "active"],
        ["agent-c", "registered"],
      ]);
      const result = await clusterPerceive(runtime, principal, schemaProvider);
      expect(result.clusterStatus).toContain("3 participants");
    });

    it("marks own agent with (YOU)", async () => {
      const runtime = makeRuntime([
        ["agent-a", "active"],
        ["agent-b", "done"],
      ]);
      const result = await clusterPerceive(runtime, principal, schemaProvider);
      expect(result.clusterStatus).toContain("agent-a");
      expect(result.clusterStatus).toContain("(YOU)");
    });

    it("shows status for each participant", async () => {
      const runtime = makeRuntime([
        ["agent-a", "active"],
        ["agent-b", "done"],
        ["agent-c", "registered"],
      ]);
      const result = await clusterPerceive(runtime, principal, schemaProvider);
      expect(result.clusterStatus).toContain("status=active");
      expect(result.clusterStatus).toContain("status=done");
      expect(result.clusterStatus).toContain("status=registered");
    });

    it("handles empty world gracefully", async () => {
      const runtime = makeEmptyRuntime();
      const result = await clusterPerceive(runtime, principal, schemaProvider);
      expect(result.clusterStatus).toContain("No cluster state");
    });
  });

  describe("inbox rendering", () => {
    it("returns 'No unread messages' when inbox is empty", async () => {
      const runtime = makeRuntime([["agent-a", "active"]]);
      const result = await clusterPerceive(runtime, principal, schemaProvider);
      expect(result.inboxSummary).toContain("No unread messages");
    });

    it("renders messages from inbox context", async () => {
      const runtime = makeRuntime([
        ["agent-a", "active"],
        ["agent-b", "active"],
      ]);
      const messages: InboxMessageSummary[] = [
        { from: "agent-b", content: "Hello from B", receivedAt: "2025-01-01T00:00:00Z" },
      ];
      const result = await clusterPerceive(runtime, principal, schemaProvider, {
        inboxMessages: messages,
      });
      expect(result.inboxSummary).toContain("agent-b");
      expect(result.inboxSummary).toContain("Hello from B");
    });

    it("truncates long messages to 200 chars", async () => {
      const runtime = makeRuntime([
        ["agent-a", "active"],
        ["agent-b", "active"],
      ]);
      const longContent = "x".repeat(300);
      const messages: InboxMessageSummary[] = [
        { from: "agent-b", content: longContent, receivedAt: "2025-01-01T00:00:00Z" },
      ];
      const result = await clusterPerceive(runtime, principal, schemaProvider, {
        inboxMessages: messages,
      });
      expect(result.inboxSummary).toContain("...");
      expect(result.inboxSummary.length).toBeLessThan(longContent.length);
    });

    it("renders multiple messages", async () => {
      const runtime = makeRuntime([
        ["agent-a", "active"],
        ["agent-b", "active"],
        ["agent-c", "active"],
      ]);
      const messages: InboxMessageSummary[] = [
        { from: "agent-b", content: "msg1", receivedAt: "2025-01-01T00:00:00Z" },
        { from: "agent-c", content: "msg2", receivedAt: "2025-01-01T00:01:00Z" },
      ];
      const result = await clusterPerceive(runtime, principal, schemaProvider, {
        inboxMessages: messages,
      });
      expect(result.inboxSummary).toContain("msg1");
      expect(result.inboxSummary).toContain("msg2");
    });
  });

  describe("heartbeat sequence", () => {
    it("returns 0 when no context provided", async () => {
      const runtime = makeRuntime([["agent-a", "active"]]);
      const result = await clusterPerceive(runtime, principal, schemaProvider);
      expect(result.ownHeartbeatSeq).toBe(0);
    });

    it("returns provided heartbeat seq from context", async () => {
      const runtime = makeRuntime([["agent-a", "active"]]);
      const result = await clusterPerceive(runtime, principal, schemaProvider, {
        heartbeatSeq: 42,
      });
      expect(result.ownHeartbeatSeq).toBe(42);
    });

    it("includes heartbeat seq in worldSummary", async () => {
      const runtime = makeRuntime([["agent-a", "active"]]);
      const result = await clusterPerceive(runtime, principal, schemaProvider, { heartbeatSeq: 7 });
      expect(result.worldSummary).toContain("own_seq=7");
    });
  });

  describe("enhanced world summary", () => {
    it("includes base world summary + cluster sections", async () => {
      const runtime = makeRuntime([
        ["agent-a", "active"],
        ["agent-b", "active"],
      ]);
      const result = await clusterPerceive(runtime, principal, schemaProvider);
      expect(result.worldSummary).toContain("Cluster Status");
      expect(result.worldSummary).toContain("Inbox Messages");
      expect(result.worldSummary).toContain("Heartbeat");
      expect(result.worldSummary).toContain("World State");
    });
  });
});
