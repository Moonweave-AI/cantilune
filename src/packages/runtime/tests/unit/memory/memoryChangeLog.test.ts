import { describe, expect, it } from "vitest";
import {
  actorId,
  actorRef,
  changeId,
  contentRef,
  coordinationChange,
  epochId,
  evidenceId,
  evidenceRef,
  matchBinding,
  operationTypeId,
  operationTemplateRef,
  sessionId,
  snapshotRef,
  timestamp,
  type CoordinationChange,
  type MatchBinding,
} from "@cantilune/core";
import { MemoryChangeLog } from "../../../src/memory/memoryChangeLog.js";

describe("MemoryChangeLog", () => {
  const changeA = coordinationChange({
    changeId: changeId("chg-a"),
    recordedAt: timestamp("2026-08-07T10:00:00Z"),
    epochId: epochId("42"),
    operationTypeId: operationTypeId("introduce_artifact"),
    beforeRef: snapshotRef("snap-S0"),
    afterRef: snapshotRef("snap-S1"),
    matchBindings: [],
    initiator: actorRef(actorId("planner-p"), "agent"),
    visibility: "external",
  });
  const changeB = coordinationChange({
    changeId: changeId("chg-b"),
    recordedAt: timestamp("2026-08-07T10:01:00Z"),
    epochId: epochId("42"),
    operationTypeId: operationTypeId("delegate"),
    beforeRef: snapshotRef("snap-S1"),
    afterRef: snapshotRef("snap-S2"),
    matchBindings: [],
    initiator: actorRef(actorId("planner-p"), "agent"),
    visibility: "external",
  });

  it("appends changes and rejects duplicate changeId", () => {
    const log = new MemoryChangeLog();
    expect(log.append(changeA)).toBe(true);
    expect(log.append(changeA)).toBe(false);
    expect(log.all()).toHaveLength(1);
  });

  it("gets change by id", () => {
    const log = new MemoryChangeLog();
    log.append(changeA);
    expect(log.get(changeId("chg-a"))?.afterRef).toBe("snap-S1");
    expect(log.get(changeId("missing"))).toBeUndefined();
  });

  it("returns slice from matching beforeRef", () => {
    const log = new MemoryChangeLog();
    log.append(changeA);
    log.append(changeB);
    const slice = log.since(snapshotRef("snap-S1"));
    expect(slice).toHaveLength(1);
    expect(slice[0]?.changeId).toBe("chg-b");
  });

  it("builds chain via fallback when beforeRef is not at index zero", () => {
    const log = new MemoryChangeLog();
    log.append(changeB);
    log.append(changeA);
    const slice = log.since(snapshotRef("snap-S0"));
    expect(slice.some((c) => c.changeId === "chg-a")).toBe(true);
  });

  it("returns empty chain for unknown fromRef", () => {
    const log = new MemoryChangeLog();
    log.append(changeA);
    expect(log.since(snapshotRef("snap-unknown"))).toHaveLength(0);
  });

  it("deeply detaches append ingress from caller-owned change data", () => {
    const fromBinding = matchBinding("from", "agent-a");
    const initiator = actorRef(actorId("agent-a"), "agent");
    const involved = actorRef(actorId("agent-b"), "agent");
    const authorization = evidenceRef(
      evidenceId("approval-1"),
      "approval",
      contentRef("sha256:approval-1"),
    );
    const external = evidenceRef(
      evidenceId("observation-1"),
      "observation",
      contentRef("sha256:observation-1"),
    );
    const input = coordinationChange({
      changeId: changeId("chg-ingress"),
      recordedAt: timestamp("2026-08-13T10:00:00Z"),
      epochId: epochId("42"),
      operationTypeId: operationTypeId("emit_heartbeat"),
      templateRef: operationTemplateRef("emit_heartbeat", "1"),
      beforeRef: snapshotRef("snap-ingress-before"),
      afterRef: snapshotRef("snap-ingress-after"),
      matchBindings: [fromBinding],
      initiator,
      involved: [involved],
      authorization: [authorization],
      external: [external],
      createdSessionRefs: [sessionId("session-ingress")],
      visibility: "external",
    });
    const log = new MemoryChangeLog();

    expect(log.append(input)).toBe(true);
    (input as unknown as { afterRef: string }).afterRef = "snap-poisoned";
    (input.templateRef as unknown as { revision: string }).revision = "poisoned";
    (fromBinding as unknown as { actorId: string }).actorId = "agent-poisoned";
    (initiator as unknown as { kind: string }).kind = "human";
    (involved as unknown as { actorId: string }).actorId = "agent-poisoned";
    (authorization as unknown as { contentRef: string }).contentRef = "sha256:poisoned";
    (external as unknown as { kind: string }).kind = "receipt";
    (input.matchBindings as MatchBinding[]).push(matchBinding("from", "agent-extra"));

    const stored = log.get(changeId("chg-ingress"));
    expect(stored).toMatchObject({
      afterRef: "snap-ingress-after",
      templateRef: { operationTypeId: "emit_heartbeat", revision: "1" },
      initiator: { actorId: "agent-a", kind: "agent" },
      involved: [{ actorId: "agent-b", kind: "agent" }],
      authorization: [{ contentRef: "sha256:approval-1" }],
      external: [{ kind: "observation" }],
    });
    expect(stored?.matchBindings).toEqual([{ role: "from", actorId: "agent-a" }]);
    expect(stored?.targets).toEqual([{ kind: "participant", id: "agent-a" }]);
  });

  it("returns independent, deeply frozen get/all/since egress", () => {
    const log = new MemoryChangeLog();
    log.append(changeA);
    log.append(changeB);

    const first = log.get(changeId("chg-a"))!;
    const second = log.get(changeId("chg-a"))!;
    expect(first).not.toBe(second);
    expect(first.initiator).not.toBe(second.initiator);
    expect(first.matchBindings).not.toBe(second.matchBindings);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.initiator)).toBe(true);
    expect(Object.isFrozen(first.matchBindings)).toBe(true);
    expect(() => {
      (first as unknown as { afterRef: string }).afterRef = "snap-poisoned";
    }).toThrow(TypeError);
    expect(() => {
      (first.initiator as unknown as { kind: string }).kind = "human";
    }).toThrow(TypeError);
    expect(() => {
      (first.matchBindings as MatchBinding[]).push(matchBinding("from", "agent-poisoned"));
    }).toThrow(TypeError);

    const all = log.all();
    expect(Object.isFrozen(all)).toBe(true);
    expect(all[0]).not.toBe(first);
    expect(() => {
      (all as CoordinationChange[]).pop();
    }).toThrow(TypeError);

    const since = log.since(snapshotRef("snap-S1"));
    expect(Object.isFrozen(since)).toBe(true);
    expect(since[0]).not.toBe(log.get(changeId("chg-b")));
    expect(() => {
      (since[0] as unknown as { beforeRef: string }).beforeRef = "snap-poisoned";
    }).toThrow(TypeError);

    expect(second.afterRef).toBe("snap-S1");
    expect(second.initiator.kind).toBe("agent");
    expect(log.get(changeId("chg-a"))?.afterRef).toBe("snap-S1");
    expect(log.get(changeId("chg-b"))?.beforeRef).toBe("snap-S1");
  });
});
