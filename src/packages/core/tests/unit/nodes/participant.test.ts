import { describe, expect, it } from "vitest";
import { actorId } from "../../../src/primitives/ids.js";
import {
  actorRef,
  participant,
  resolveActorRef,
} from "../../../src/nodes/participant.js";

describe("participant", () => {
  it("creates a participant with default active status", () => {
    const p = participant(actorId("planner-p"), "agent");
    expect(p.kind).toBe("agent");
    expect(p.status).toBe("active");
  });

  it("creates actor refs for event-side attribution", () => {
    const ref = actorRef(actorId("human-1"), "human");
    expect(ref.actorId).toBe("human-1");
    expect(ref.kind).toBe("human");
  });

  it("resolves actor refs against the participant map", () => {
    const planner = participant(actorId("planner-p"), "agent");
    const registry = new Map([[planner.actorId, planner]]);
    const ref = actorRef(planner.actorId, "agent");
    expect(resolveActorRef(ref, registry)).toBe(planner);
    expect(resolveActorRef(actorRef(actorId("missing"), "agent"), registry)).toBeUndefined();
  });
});
