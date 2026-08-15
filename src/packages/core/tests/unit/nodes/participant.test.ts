import { describe, expect, it } from "vitest";
import {
  actorRef,
  lookupParticipantById,
  participant,
  resolveActorRef,
} from "../../../src/nodes/participant.js";
import { actorId } from "../../../src/primitives/ids.js";
import { isErr, isOk } from "../../../src/primitives/result.js";

describe("participant", () => {
  it("creates a participant with default active status", () => {
    expect(participant(actorId("planner-p"), "agent").status).toBe("active");
  });

  it("creates actor refs for event-side attribution", () => {
    expect(actorRef(actorId("planner-p"), "agent")).toEqual({
      actorId: actorId("planner-p"),
      kind: "agent",
    });
  });

  it("resolves actor refs with kind consistency", () => {
    const planner = participant(actorId("planner-p"), "agent");
    const registry = new Map([[planner.actorId, planner]]);
    const ref = actorRef(planner.actorId, "agent");
    const resolved = resolveActorRef(ref, registry);
    expect(isOk(resolved)).toBe(true);
    if (isOk(resolved)) {
      expect(resolved.value).toBe(planner);
    }
    const mismatch = resolveActorRef(actorRef(planner.actorId, "human"), registry);
    expect(isErr(mismatch)).toBe(true);
    expect(lookupParticipantById(actorId("missing"), registry)).toBeUndefined();
  });
});
