import { describe, expect, it } from "vitest";
import {
  actorId,
  actorRef,
  contentRef,
  coordinationIntent,
  evidenceId,
  evidenceRef,
  matchBinding,
  operationTypeId,
} from "@cantilune/core";
import { normalizeCoordinationIntent } from "../../../src/admission/normalizeIntent.js";

describe("normalizeCoordinationIntent", () => {
  it("copies content inputs without deriving them from external evidence", () => {
    const inputRef = contentRef(
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    const evidenceContentRef = contentRef(
      "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );
    const intent = coordinationIntent(
      actorRef(actorId("planner-p"), "agent"),
      operationTypeId("introduce_artifact"),
      [matchBinding("task", "task-T"), matchBinding("from", "planner-p")],
      [evidenceRef(evidenceId("ev-1"), "observation", evidenceContentRef)],
      [inputRef],
      { turnCount: 8, lastAction: "write_content" },
    );

    const normalized = normalizeCoordinationIntent(intent);

    expect(normalized.inputContentRefs).toEqual([inputRef]);
    expect(normalized.external?.map((item) => item.contentRef)).toEqual([evidenceContentRef]);
    expect(normalized.inputContentRefs).not.toBe(intent.inputContentRefs);
    expect(normalized.scalarInputs).toEqual({ turnCount: 8, lastAction: "write_content" });
    expect(normalized.scalarInputs).not.toBe(intent.scalarInputs);
    expect(normalized.external).not.toBe(intent.external);
  });
});
