import { describe, expect, it } from "vitest";
import {
  actorId,
  collaborationSnapshot,
  contentRef,
  epochId,
  snapshotRef,
  timestamp,
  type CollaborationSnapshot,
  type ObservationEntry,
  type Participant,
  type PolicyContext,
} from "@cantilune/core";
import { MemoryCollaborationStore } from "../../../src/memory/memoryStore.js";

describe("MemoryCollaborationStore", () => {
  const snap0 = collaborationSnapshot({
    snapshotRef: snapshotRef("snap-S0"),
    epochId: epochId("42"),
  });
  const snap1 = collaborationSnapshot({
    snapshotRef: snapshotRef("snap-S1"),
    epochId: epochId("42"),
  });

  it("tracks head through put and remove", () => {
    const store = new MemoryCollaborationStore();
    expect(store.head()).toBeUndefined();
    store.put(snap0);
    expect(store.head()).toBe("snap-S0");
    store.remove(snapshotRef("snap-S0"));
    expect(store.head()).toBeUndefined();
  });

  it("putIfAbsent rejects collision", () => {
    const store = new MemoryCollaborationStore({ initial: snap0 });
    expect(store.putIfAbsent(snap0)).toBe(false);
    expect(store.putIfAbsent(snap1)).toBe(true);
  });

  it("compareAndSwapHead succeeds only when head matches", () => {
    const store = new MemoryCollaborationStore({ initial: snap0 });
    expect(store.compareAndSwapHead(snapshotRef("snap-S0"), snap1)).toBe(true);
    expect(store.head()).toBe("snap-S1");
    expect(store.compareAndSwapHead(snapshotRef("snap-S0"), snap0)).toBe(false);
  });

  it("setHead updates head without requiring snapshot presence", () => {
    const store = new MemoryCollaborationStore({ initial: snap0 });
    store.setHead(snapshotRef("snap-S1"));
    expect(store.head()).toBe("snap-S1");
  });

  it("lists all snapshots and refs", () => {
    const store = new MemoryCollaborationStore({ initial: snap0 });
    store.putIfAbsent(snap1);
    expect(store.allSnapshots()).toHaveLength(2);
    expect(store.allRefs()).toContain("snap-S0");
    expect(store.allRefs()).toContain("snap-S1");
  });

  it("deeply detaches constructor and put ingress from caller-owned values", () => {
    const initialParticipant: Participant = {
      actorId: actorId("agent-a"),
      kind: "agent",
      status: "active",
    };
    const initialReviewers = ["reviewer-1"];
    const initialPolicy: PolicyContext = {
      approvalState: { kind: "awaiting_review", reviewers: initialReviewers },
      retryState: { kind: "idle" },
    };
    const initialSource = { actorId: actorId("agent-a"), kind: "agent" as const };
    const initialAudit: ObservationEntry[] = [
      {
        sequenceNo: 1,
        source: initialSource,
        payloadRef: contentRef("sha256:initial"),
        receivedAt: timestamp("2026-08-13T01:00:00Z"),
      },
    ];
    const initialParticipants = new Map([[initialParticipant.actorId, initialParticipant]]);
    const initial = mutableSnapshot(
      "snap-ingress-0",
      initialParticipants,
      initialPolicy,
      initialAudit,
    );
    const store = new MemoryCollaborationStore({ initial });

    initialParticipants.clear();
    (initialParticipant as { status: string }).status = "retired";
    initialReviewers.push("reviewer-2");
    (initialSource as { kind: string }).kind = "human";
    initialAudit.push(initialAudit[0]!);

    const storedInitial = store.get(snapshotRef("snap-ingress-0"))!;
    expect(storedInitial.participants.size).toBe(1);
    expect(storedInitial.policyContext).toEqual({
      approvalState: { kind: "awaiting_review", reviewers: ["reviewer-1"] },
      retryState: { kind: "idle" },
    });
    expect(storedInitial.auditTail).toHaveLength(1);
    expect(storedInitial.auditTail[0]?.source.kind).toBe("agent");

    const putParticipant: Participant = {
      actorId: actorId("agent-b"),
      kind: "agent",
      status: "active",
    };
    const putParticipants = new Map([[putParticipant.actorId, putParticipant]]);
    const putSnapshot = mutableSnapshot(
      "snap-ingress-1",
      putParticipants,
      { approvalState: { kind: "none" }, retryState: { kind: "idle" } },
      [],
    );
    store.put(putSnapshot);
    putParticipants.clear();
    (putParticipant as { status: string }).status = "done";

    expect(store.get(snapshotRef("snap-ingress-1"))?.participants.get(actorId("agent-b"))).toEqual({
      actorId: "agent-b",
      kind: "agent",
      status: "active",
    });
  });

  it("returns detached, deeply immutable egress values", () => {
    const participantValue: Participant = {
      actorId: actorId("agent-a"),
      kind: "agent",
      status: "active",
    };
    const store = new MemoryCollaborationStore({
      initial: mutableSnapshot(
        "snap-egress",
        new Map([[participantValue.actorId, participantValue]]),
        {
          approvalState: { kind: "awaiting_review", reviewers: ["reviewer-1"] },
          retryState: { kind: "idle" },
        },
        [],
      ),
    });

    const first = store.get(snapshotRef("snap-egress"))!;
    const second = store.get(snapshotRef("snap-egress"))!;
    expect(first).not.toBe(second);
    expect(first.participants).not.toBe(second.participants);
    expect((first.participants as unknown as Record<string, unknown>).set).toBeUndefined();
    expect(() => {
      (first.participants.get(actorId("agent-a")) as { status: string }).status = "retired";
    }).toThrow(TypeError);
    const approvalState = first.policyContext.approvalState;
    if (approvalState.kind === "awaiting_review") {
      expect(() => {
        (approvalState.reviewers as string[]).push("reviewer-2");
      }).toThrow(TypeError);
    }
    expect(second.participants.get(actorId("agent-a"))?.status).toBe("active");
    expect(
      store.get(snapshotRef("snap-egress"))?.participants.get(actorId("agent-a"))?.status,
    ).toBe("active");

    const all = store.allSnapshots();
    expect(Object.isFrozen(all)).toBe(true);
    expect(all[0]).not.toBe(first);
  });

  it("detaches putIfAbsent and compareAndSwapHead ingress", () => {
    const store = new MemoryCollaborationStore({ initial: snap0 });
    const absentParticipant: Participant = {
      actorId: actorId("agent-absent"),
      kind: "agent",
      status: "active",
    };
    const absentParticipants = new Map([[absentParticipant.actorId, absentParticipant]]);
    const absent = mutableSnapshot(
      "snap-absent",
      absentParticipants,
      { approvalState: { kind: "none" }, retryState: { kind: "idle" } },
      [],
    );

    expect(store.putIfAbsent(absent)).toBe(true);
    absentParticipants.clear();
    (absentParticipant as { status: string }).status = "retired";
    expect(store.get(snapshotRef("snap-absent"))?.participants.size).toBe(1);
    expect(
      store.get(snapshotRef("snap-absent"))?.participants.get(actorId("agent-absent"))?.status,
    ).toBe("active");

    store.setHead(snapshotRef("snap-absent"));
    const casParticipant: Participant = {
      actorId: actorId("agent-cas"),
      kind: "agent",
      status: "active",
    };
    const casParticipants = new Map([[casParticipant.actorId, casParticipant]]);
    const cas = mutableSnapshot(
      "snap-cas",
      casParticipants,
      { approvalState: { kind: "none" }, retryState: { kind: "idle" } },
      [],
    );

    expect(store.compareAndSwapHead(snapshotRef("snap-absent"), cas)).toBe(true);
    casParticipants.clear();
    (casParticipant as { status: string }).status = "done";
    expect(store.get(snapshotRef("snap-cas"))?.participants.size).toBe(1);
    expect(store.get(snapshotRef("snap-cas"))?.participants.get(actorId("agent-cas"))?.status).toBe(
      "active",
    );
  });
});

function mutableSnapshot(
  ref: string,
  participants: Map<ReturnType<typeof actorId>, Participant>,
  policyContext: PolicyContext,
  auditTail: ObservationEntry[],
): CollaborationSnapshot {
  return {
    snapshotRef: snapshotRef(ref),
    epochId: epochId("42"),
    participants,
    artifacts: new Map(),
    links: new Map(),
    sessions: new Map(),
    capabilities: new Map(),
    policyContext,
    auditTail,
    retiredEntities: [],
    heartbeatLog: [],
  };
}
