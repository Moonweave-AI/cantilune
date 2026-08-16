import { describe, it, expect } from "vitest";
import { translateClusterEvent } from "../../src/tui/clusterEvents.js";
import type { ClusterEvent } from "@cantilune/boot";

describe("cluster event translation", () => {
  it("translates agent_started to the cluster accent", () => {
    const t = translateClusterEvent({ kind: "agent_started", actorId: "a1" as never });
    expect(t?.color).toBe("accentAlt");
    expect(t?.label).toContain("a1");
    expect(t?.stage).toBe("diagnostic");
  });

  it("translates agent_done with summary detail and success color", () => {
    const t = translateClusterEvent({
      kind: "agent_done",
      actorId: "a2" as never,
      summary: "all good",
    });
    expect(t?.color).toBe("success");
    expect(t?.detail).toBe("all good");
  });

  it("translates agent_stale with a staleness detail", () => {
    const t = translateClusterEvent({
      kind: "agent_stale",
      actorId: "a3" as never,
      lastHeartbeatMs: 5000,
    });
    expect(t?.color).toBe("warning");
    expect(t?.detail).toContain("5000");
  });

  it("translates agent_retired to danger", () => {
    const t = translateClusterEvent({ kind: "agent_retired", actorId: "a4" as never });
    expect(t?.color).toBe("danger");
  });

  it("translates condition_met to the cluster accent", () => {
    const t = translateClusterEvent({ kind: "condition_met", actorId: "a6" as never });
    expect(t?.color).toBe("accentAlt");
  });

  it("translates heartbeat_received to info", () => {
    const t = translateClusterEvent({
      kind: "heartbeat_received",
      actorId: "a7" as never,
      seq: 3,
    });
    expect(t?.color).toBe("info");
    expect(t?.label).toContain("#3");
  });

  it("returns undefined for cluster_complete (owned by turn close)", () => {
    const t = translateClusterEvent({ kind: "cluster_complete" });
    expect(t).toBeUndefined();
  });

  it("translates agent_queued with priority detail", () => {
    const t = translateClusterEvent({
      kind: "agent_queued",
      actorId: "a8" as never,
      priority: 3,
    });
    expect(t?.color).toBe("muted");
    expect(t?.detail).toContain("3");
  });

  it("translates manifest_unresolved to danger", () => {
    const t = translateClusterEvent({
      kind: "manifest_unresolved",
      actorId: "a9" as never,
      detail: "wrong agentId",
    });
    expect(t?.color).toBe("danger");
    expect(t?.detail).toBe("wrong agentId");
  });

  it("translates swarm_stalled and budget_exhausted", () => {
    const stalled = translateClusterEvent({ kind: "swarm_stalled", detail: "no progress" });
    expect(stalled?.color).toBe("danger");
    const budget = translateClusterEvent({
      kind: "budget_exhausted",
      limit: "turns",
      detail: "max turns",
    });
    expect(budget?.color).toBe("warning");
    expect(budget?.label).toContain("turns");
  });

  it("omits agent_done detail when the summary is empty", () => {
    const t = translateClusterEvent({
      kind: "agent_done",
      actorId: "a10" as never,
      summary: "",
    });
    expect(t?.detail).toBeUndefined();
  });

  it("every translated event surfaces as a diagnostic stage for the lifecycle rail", () => {
    const events: ClusterEvent[] = [
      { kind: "agent_started", actorId: "x" as never },
      { kind: "agent_done", actorId: "x" as never, summary: "" },
      { kind: "agent_stale", actorId: "x" as never, lastHeartbeatMs: 1 },
      { kind: "agent_retired", actorId: "x" as never },
      { kind: "condition_met", actorId: "x" as never },
      { kind: "heartbeat_received", actorId: "x" as never, seq: 1 },
      { kind: "agent_queued", actorId: "x" as never, priority: 1 },
      { kind: "manifest_unresolved", actorId: "x" as never, detail: "bad" },
      { kind: "swarm_stalled", detail: "stuck" },
      { kind: "budget_exhausted", limit: "agents", detail: "cap" },
    ];
    for (const e of events) {
      const t = translateClusterEvent(e);
      expect(t?.stage).toBe("diagnostic");
    }
  });
});
