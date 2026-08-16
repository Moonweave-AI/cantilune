import { describe, expect, it } from "vitest";
import {
  actorId,
  collaborationSnapshot,
  epochId,
  namespaceId,
  participant,
  snapshotRef,
  withParticipant,
} from "@cantilune/core";
import { toAgUiEvents, type AgUiEvent } from "../../../src/export/agUiEventAdapter.js";

function typesOf(events: readonly AgUiEvent[]): readonly string[] {
  return events.map((event) => event.type);
}

function snapshot() {
  return withParticipant(
    collaborationSnapshot({
      snapshotRef: snapshotRef("snap-S1"),
      epochId: epochId("7"),
    }),
    participant(actorId("writer"), "agent"),
  );
}

describe("toAgUiEvents", () => {
  it("emits RUN_STARTED, STATE_SNAPSHOT, and RUN_FINISHED for an empty run", () => {
    const events = toAgUiEvents({
      threadId: "thread-1",
      runId: "run-1",
      snapshot: snapshot(),
      visibleTranscripts: [],
    });
    expect(typesOf(events)).toEqual(["RUN_STARTED", "STATE_SNAPSHOT", "RUN_FINISHED"]);
    expect(events[0]).toMatchObject({ threadId: "thread-1", runId: "run-1" });
    expect(events[1]).toMatchObject({
      type: "STATE_SNAPSHOT",
      snapshot: { snapshotRef: "snap-S1", epochId: "7", linkCount: 0 },
    });
  });

  it("maps visible text, tools, and optional reasoning", () => {
    const events = toAgUiEvents({
      threadId: "thread-1",
      runId: "run-1",
      snapshot: snapshot(),
      timestamp: 1_700_000_000_000,
      visibleTranscripts: [
        {
          kind: "full",
          transcript: {
            actorId: "writer",
            messages: [
              { role: "user", content: "plan this" },
              {
                role: "assistant",
                content: "calling tool",
                reasoning: "need a lookup",
                toolCalls: [{ id: "call-1", name: "search", arguments: '{"q":"x"}' }],
              },
              { role: "tool", toolCallId: "call-1", content: "hits" },
              { role: "reasoning", content: "final check" },
              {
                role: "assistant",
                content: "",
                toolCalls: [{ id: "call-2", name: "noop", arguments: "" }],
              },
            ],
          },
        },
        { kind: "absent" },
      ],
    });
    expect(typesOf(events)).toEqual([
      "RUN_STARTED",
      "STATE_SNAPSHOT",
      "TEXT_MESSAGE_START",
      "TEXT_MESSAGE_CONTENT",
      "TEXT_MESSAGE_END",
      "REASONING_START",
      "REASONING_MESSAGE_START",
      "REASONING_MESSAGE_CONTENT",
      "REASONING_MESSAGE_END",
      "REASONING_END",
      "TEXT_MESSAGE_START",
      "TEXT_MESSAGE_CONTENT",
      "TEXT_MESSAGE_END",
      "TOOL_CALL_START",
      "TOOL_CALL_ARGS",
      "TOOL_CALL_END",
      "TOOL_CALL_RESULT",
      "REASONING_START",
      "REASONING_MESSAGE_START",
      "REASONING_MESSAGE_CONTENT",
      "REASONING_MESSAGE_END",
      "REASONING_END",
      "TOOL_CALL_START",
      "TOOL_CALL_END",
      "RUN_FINISHED",
    ]);
    expect(
      events.some((event) => event.type === "TOOL_CALL_RESULT" && event.content === "hits"),
    ).toBe(true);
    expect(events[0]?.timestamp).toBe(1_700_000_000_000);
  });

  it("emits RUN_ERROR with an optional code instead of RUN_FINISHED", () => {
    const events = toAgUiEvents({
      threadId: "thread-1",
      runId: "run-1",
      snapshot: snapshot(),
      visibleTranscripts: new Map(),
      error: { message: "boom", code: "E_STOP" },
    });
    expect(typesOf(events)).toEqual(["RUN_STARTED", "STATE_SNAPSHOT", "RUN_ERROR"]);
    expect(events[2]).toMatchObject({ type: "RUN_ERROR", message: "boom", code: "E_STOP" });
  });

  it("omits namespaceId and timestamps when they are absent", () => {
    const events = toAgUiEvents({
      threadId: "thread-1",
      runId: "run-1",
      snapshot: withParticipant(
        collaborationSnapshot({
          snapshotRef: snapshotRef("snap-S2"),
          epochId: epochId("8"),
        }),
        { actorId: actorId("anon"), kind: "agent", status: "active" },
      ),
      visibleTranscripts: [
        {
          kind: "full",
          transcript: {
            actorId: "anon",
            messages: [
              { role: "reasoning", content: "think" },
              {
                role: "assistant",
                content: "hi",
                toolCalls: [{ id: "c1", name: "ping", arguments: "{}" }],
              },
              { role: "tool", toolCallId: "c1", content: "pong" },
            ],
          },
        },
      ],
    });
    const state = events.find((event) => event.type === "STATE_SNAPSHOT");
    expect(state?.type === "STATE_SNAPSHOT" && state.snapshot.participants[0]?.namespaceId).toBe(
      "default",
    );
    expect(events.every((event) => event.timestamp === undefined)).toBe(true);
    expect(typesOf(events)).toContain("REASONING_START");
    expect(typesOf(events)).toContain("TOOL_CALL_ARGS");
    expect(typesOf(events)).toContain("TOOL_CALL_RESULT");
  });

  it("skips empty reasoning and accepts a Map of visible transcripts", () => {
    const events = toAgUiEvents({
      threadId: "thread-1",
      runId: "run-1",
      snapshot: snapshot(),
      visibleTranscripts: new Map([
        [
          actorId("writer"),
          {
            kind: "summary",
            transcript: {
              actorId: actorId("writer"),
              namespaceId: namespaceId("default"),
              revision: 1,
              messages: [
                { role: "assistant", content: "[assistant 4 chars]", reasoning: "" },
                { role: "reasoning", content: "" },
              ],
            },
          },
        ],
      ]),
      error: { message: "failed" },
    });
    expect(typesOf(events)).toEqual([
      "RUN_STARTED",
      "STATE_SNAPSHOT",
      "TEXT_MESSAGE_START",
      "TEXT_MESSAGE_CONTENT",
      "TEXT_MESSAGE_END",
      "RUN_ERROR",
    ]);
    expect(events.at(-1)).toMatchObject({ type: "RUN_ERROR", message: "failed" });
  });
});
