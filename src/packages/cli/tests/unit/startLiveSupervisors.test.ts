import { describe, it, expect, vi } from "vitest";
import { startLiveSupervisors } from "../../src/wiring/startLiveSupervisors.js";

describe("startLiveSupervisors", () => {
  it("starts swarm then cluster and reports both live", () => {
    const swarm = { start: vi.fn(() => ({ ok: true as const })) };
    const cluster = { start: vi.fn(() => ({ ok: true as const })) };
    expect(startLiveSupervisors(swarm, cluster)).toEqual({
      ok: true,
      message: "cluster and swarm supervisors are live",
    });
    expect(swarm.start).toHaveBeenCalledOnce();
    expect(cluster.start).toHaveBeenCalledOnce();
  });

  it("fails closed when neither controller exists", () => {
    expect(startLiveSupervisors(undefined, undefined).ok).toBe(false);
  });

  it("keeps the swarm up when only swarm starts", () => {
    const swarm = { start: vi.fn(() => ({ ok: true as const, message: "already running" })) };
    const cluster = { start: vi.fn(() => ({ ok: false as const, message: "no runtime" })) };
    const result = startLiveSupervisors(swarm, cluster);
    expect(result.ok).toBe(true);
    expect(result.message).toBe("already running");
  });
});
