import { describe, expect, it } from "vitest";
import { actorId, sessionId } from "../../../src/primitives/ids.js";
import { communicationSession } from "../../../src/nodes/communicationSession.js";

describe("communicationSession", () => {
  it("creates a private session by default", () => {
    const session = communicationSession(
      sessionId("session-s"),
      actorId("coder-c"),
      [actorId("coder-c"), actorId("planner-p")],
    );
    expect(session.visibility).toBe("private");
    expect(session.controller).toBe("coder-c");
    expect(session.participants).toHaveLength(2);
  });

  it("allows shared visibility", () => {
    const session = communicationSession(
      sessionId("session-shared"),
      actorId("planner-p"),
      [actorId("planner-p")],
      "shared",
    );
    expect(session.visibility).toBe("shared");
  });
});
