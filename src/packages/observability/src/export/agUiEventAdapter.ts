import {
  DEFAULT_NAMESPACE_ID,
  type CollaborationSnapshot,
  type TranscriptVisibility,
} from "@cantilune/core";

/**
 * AG-UI event type identifiers (docs.ag-ui.com). Implemented locally so
 * observability does not depend on the CopilotKit tree.
 */
export const AG_UI_EVENT_TYPES = [
  "RUN_STARTED",
  "RUN_FINISHED",
  "RUN_ERROR",
  "TEXT_MESSAGE_START",
  "TEXT_MESSAGE_CONTENT",
  "TEXT_MESSAGE_END",
  "TOOL_CALL_START",
  "TOOL_CALL_ARGS",
  "TOOL_CALL_END",
  "TOOL_CALL_RESULT",
  "STATE_SNAPSHOT",
  "REASONING_START",
  "REASONING_MESSAGE_START",
  "REASONING_MESSAGE_CONTENT",
  "REASONING_MESSAGE_END",
  "REASONING_END",
] as const;

export type AgUiEventType = (typeof AG_UI_EVENT_TYPES)[number];

export type AgUiMessageRole = "developer" | "system" | "assistant" | "user" | "tool";

export interface AgUiBaseEvent {
  readonly type: AgUiEventType;
  readonly timestamp?: number;
}

export interface AgUiRunStartedEvent extends AgUiBaseEvent {
  readonly type: "RUN_STARTED";
  readonly threadId: string;
  readonly runId: string;
}

export interface AgUiRunFinishedEvent extends AgUiBaseEvent {
  readonly type: "RUN_FINISHED";
  readonly threadId: string;
  readonly runId: string;
}

export interface AgUiRunErrorEvent extends AgUiBaseEvent {
  readonly type: "RUN_ERROR";
  readonly message: string;
  readonly code?: string;
}

export interface AgUiTextMessageStartEvent extends AgUiBaseEvent {
  readonly type: "TEXT_MESSAGE_START";
  readonly messageId: string;
  readonly role: AgUiMessageRole;
}

export interface AgUiTextMessageContentEvent extends AgUiBaseEvent {
  readonly type: "TEXT_MESSAGE_CONTENT";
  readonly messageId: string;
  readonly delta: string;
}

export interface AgUiTextMessageEndEvent extends AgUiBaseEvent {
  readonly type: "TEXT_MESSAGE_END";
  readonly messageId: string;
}

export interface AgUiToolCallStartEvent extends AgUiBaseEvent {
  readonly type: "TOOL_CALL_START";
  readonly toolCallId: string;
  readonly toolCallName: string;
  readonly parentMessageId?: string;
}

export interface AgUiToolCallArgsEvent extends AgUiBaseEvent {
  readonly type: "TOOL_CALL_ARGS";
  readonly toolCallId: string;
  readonly delta: string;
}

export interface AgUiToolCallEndEvent extends AgUiBaseEvent {
  readonly type: "TOOL_CALL_END";
  readonly toolCallId: string;
}

export interface AgUiToolCallResultEvent extends AgUiBaseEvent {
  readonly type: "TOOL_CALL_RESULT";
  readonly messageId: string;
  readonly toolCallId: string;
  readonly content: string;
  readonly role?: "tool";
}

export interface AgUiStateSnapshotEvent extends AgUiBaseEvent {
  readonly type: "STATE_SNAPSHOT";
  readonly snapshot: AgUiCommittedState;
}

export interface AgUiReasoningStartEvent extends AgUiBaseEvent {
  readonly type: "REASONING_START";
  readonly messageId: string;
}

export interface AgUiReasoningMessageStartEvent extends AgUiBaseEvent {
  readonly type: "REASONING_MESSAGE_START";
  readonly messageId: string;
  readonly role: "reasoning";
}

export interface AgUiReasoningMessageContentEvent extends AgUiBaseEvent {
  readonly type: "REASONING_MESSAGE_CONTENT";
  readonly messageId: string;
  readonly delta: string;
}

export interface AgUiReasoningMessageEndEvent extends AgUiBaseEvent {
  readonly type: "REASONING_MESSAGE_END";
  readonly messageId: string;
}

export interface AgUiReasoningEndEvent extends AgUiBaseEvent {
  readonly type: "REASONING_END";
  readonly messageId: string;
}

export type AgUiEvent =
  | AgUiRunStartedEvent
  | AgUiRunFinishedEvent
  | AgUiRunErrorEvent
  | AgUiTextMessageStartEvent
  | AgUiTextMessageContentEvent
  | AgUiTextMessageEndEvent
  | AgUiToolCallStartEvent
  | AgUiToolCallArgsEvent
  | AgUiToolCallEndEvent
  | AgUiToolCallResultEvent
  | AgUiStateSnapshotEvent
  | AgUiReasoningStartEvent
  | AgUiReasoningMessageStartEvent
  | AgUiReasoningMessageContentEvent
  | AgUiReasoningMessageEndEvent
  | AgUiReasoningEndEvent;

export interface AgUiCommittedState {
  readonly snapshotRef: string;
  readonly epochId: string;
  readonly participants: readonly {
    readonly actorId: string;
    readonly kind: string;
    readonly status: string;
    readonly namespaceId?: string;
  }[];
  readonly artifactIds: readonly string[];
  readonly sessionIds: readonly string[];
  readonly linkCount: number;
}

export type AgUiTranscriptMessage =
  | { readonly role: "system"; readonly content: string; readonly reasoning?: string }
  | { readonly role: "user"; readonly content: string; readonly reasoning?: string }
  | {
      readonly role: "assistant";
      readonly content: string;
      readonly toolCalls?: readonly {
        readonly id: string;
        readonly name: string;
        readonly arguments: string;
      }[];
      readonly reasoning?: string;
    }
  | {
      readonly role: "tool";
      readonly toolCallId: string;
      readonly content: string;
      readonly reasoning?: string;
    }
  | { readonly role: "reasoning"; readonly content: string };

export interface AgUiVisibleTranscript {
  readonly kind: "full" | "summary" | "absent";
  readonly transcript?: {
    readonly actorId: string;
    readonly messages: readonly AgUiTranscriptMessage[];
  };
}

export interface AgUiCommittedRun {
  readonly threadId: string;
  readonly runId: string;
  readonly snapshot: CollaborationSnapshot;
  readonly visibleTranscripts:
    | readonly AgUiVisibleTranscript[]
    | ReadonlyMap<string, AgUiVisibleTranscript | TranscriptVisibility>;
  readonly error?: { readonly message: string; readonly code?: string };
  readonly timestamp?: number;
}

function asVisibleList(
  visible: AgUiCommittedRun["visibleTranscripts"],
): readonly AgUiVisibleTranscript[] {
  if (Array.isArray(visible)) {
    return visible;
  }
  return [...visible.values()];
}

function committedState(snapshot: CollaborationSnapshot): AgUiCommittedState {
  return {
    snapshotRef: snapshot.snapshotRef,
    epochId: snapshot.epochId,
    participants: [...snapshot.participants.values()].map((participant) => ({
      actorId: participant.actorId,
      kind: participant.kind,
      status: participant.status,
      namespaceId: participant.namespaceId ?? DEFAULT_NAMESPACE_ID,
    })),
    artifactIds: [...snapshot.artifacts.keys()],
    sessionIds: [...snapshot.sessions.keys()],
    linkCount: snapshot.links.size,
  };
}

function pushReasoning(
  events: AgUiEvent[],
  messageId: string,
  content: string,
  timestamp: number | undefined,
): void {
  const stamp = timestamp !== undefined ? { timestamp } : {};
  events.push({ type: "REASONING_START", messageId, ...stamp });
  events.push({ type: "REASONING_MESSAGE_START", messageId, role: "reasoning", ...stamp });
  events.push({ type: "REASONING_MESSAGE_CONTENT", messageId, delta: content, ...stamp });
  events.push({ type: "REASONING_MESSAGE_END", messageId, ...stamp });
  events.push({ type: "REASONING_END", messageId, ...stamp });
}

function pushText(
  events: AgUiEvent[],
  messageId: string,
  role: AgUiMessageRole,
  content: string,
  timestamp: number | undefined,
): void {
  const stamp = timestamp !== undefined ? { timestamp } : {};
  events.push({ type: "TEXT_MESSAGE_START", messageId, role, ...stamp });
  events.push({ type: "TEXT_MESSAGE_CONTENT", messageId, delta: content, ...stamp });
  events.push({ type: "TEXT_MESSAGE_END", messageId, ...stamp });
}

function pushToolCalls(
  events: AgUiEvent[],
  parentMessageId: string,
  toolCalls: readonly { readonly id: string; readonly name: string; readonly arguments: string }[],
  timestamp: number | undefined,
): void {
  const stamp = timestamp !== undefined ? { timestamp } : {};
  for (const toolCall of toolCalls) {
    events.push({
      type: "TOOL_CALL_START",
      toolCallId: toolCall.id,
      toolCallName: toolCall.name,
      parentMessageId,
      ...stamp,
    });
    if (toolCall.arguments.length > 0) {
      events.push({
        type: "TOOL_CALL_ARGS",
        toolCallId: toolCall.id,
        delta: toolCall.arguments,
        ...stamp,
      });
    }
    events.push({ type: "TOOL_CALL_END", toolCallId: toolCall.id, ...stamp });
  }
}

function appendMessageEvents(
  events: AgUiEvent[],
  actorId: string,
  index: number,
  message: AgUiTranscriptMessage,
  timestamp: number | undefined,
): void {
  const messageId = `${actorId}:${String(index)}`;
  if (message.role === "reasoning") {
    if (message.content.length > 0) {
      pushReasoning(events, `${messageId}:reasoning`, message.content, timestamp);
    }
    return;
  }
  const extraReasoning = message.reasoning;
  if (extraReasoning !== undefined && extraReasoning.length > 0) {
    pushReasoning(events, `${messageId}:reasoning`, extraReasoning, timestamp);
  }
  if (message.role === "tool") {
    events.push({
      type: "TOOL_CALL_RESULT",
      messageId,
      toolCallId: message.toolCallId,
      content: message.content,
      role: "tool",
      ...(timestamp !== undefined ? { timestamp } : {}),
    });
    return;
  }
  if (message.content.length > 0) {
    pushText(events, messageId, message.role, message.content, timestamp);
  }
  if (
    message.role === "assistant" &&
    message.toolCalls !== undefined &&
    message.toolCalls.length > 0
  ) {
    pushToolCalls(events, messageId, message.toolCalls, timestamp);
  }
}

/**
 * Map a committed run plus already-visible transcripts to AG-UI events.
 * Callers must pass transcripts from `redactFourViewBundle` / `visibleTranscript`.
 */
export function toAgUiEvents(run: AgUiCommittedRun): readonly AgUiEvent[] {
  const timestamp = run.timestamp;
  const stamp = timestamp !== undefined ? { timestamp } : {};
  const events: AgUiEvent[] = [
    { type: "RUN_STARTED", threadId: run.threadId, runId: run.runId, ...stamp },
    { type: "STATE_SNAPSHOT", snapshot: committedState(run.snapshot), ...stamp },
  ];
  for (const visible of asVisibleList(run.visibleTranscripts)) {
    if (visible.kind === "absent" || visible.transcript === undefined) {
      continue;
    }
    const transcript = visible.transcript;
    for (const [index, message] of transcript.messages.entries()) {
      appendMessageEvents(events, transcript.actorId, index, message, timestamp);
    }
  }
  if (run.error !== undefined) {
    events.push({
      type: "RUN_ERROR",
      message: run.error.message,
      ...(run.error.code !== undefined ? { code: run.error.code } : {}),
      ...stamp,
    });
    return events;
  }
  events.push({ type: "RUN_FINISHED", threadId: run.threadId, runId: run.runId, ...stamp });
  return events;
}
