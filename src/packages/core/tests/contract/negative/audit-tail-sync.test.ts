import { describe, expect, it } from "vitest";
import { collaborationSnapshot } from "../../../src/coordination/collaborationSnapshot.js";
import { validateAuditTailMatchesHistory } from "../../../src/coordination/validation.js";
import { epochId } from "../../../src/primitives/ids.js";
import { contentRef, snapshotRef } from "../../../src/primitives/refs.js";
import { timestamp } from "../../../src/primitives/time.js";
import { actorRef } from "../../../src/nodes/participant.js";
import { actorId } from "../../../src/primitives/ids.js";
import {
  appendObservationSegment,
  emptyRunHistory,
} from "../../../src/structure/trace.js";

describe("N4 auditTail and RunHistory must stay aligned", () => {
  it("rejects when snapshot auditTail and history observation segments diverge", () => {
    const snapshot = collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S0"),
      epochId: epochId("42"),
      auditTail: [
        {
          sequenceNo: 1,
          source: actorRef(actorId("human-1"), "human"),
          payloadRef: contentRef("content://obs-A"),
          receivedAt: timestamp("2026-08-07T10:00:00Z"),
        },
      ],
    });

    const history = appendObservationSegment(emptyRunHistory(), {
      sequenceNo: 1,
      source: actorRef(actorId("human-1"), "human"),
      payloadRef: contentRef("content://obs-B"),
      receivedAt: timestamp("2026-08-07T10:00:00Z"),
    });

    expect(() => validateAuditTailMatchesHistory(snapshot, history)).toThrow(
      /observation mismatch/,
    );
  });
});
