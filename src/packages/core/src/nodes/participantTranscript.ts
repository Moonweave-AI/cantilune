import type { ActorId, NamespaceId } from "../primitives/ids.js";
import { DEFAULT_NAMESPACE_ID } from "../primitives/ids.js";

/**
 * One LLM turn row stored on the shared world (ADR-0021).
 * Shape is the production chat contract used by boot adapters.
 */
export type TranscriptMessage =
  | { readonly role: "system"; readonly content: string }
  | { readonly role: "user"; readonly content: string }
  | {
      readonly role: "assistant";
      readonly content: string;
      readonly toolCalls?: readonly TranscriptToolCall[];
    }
  | { readonly role: "tool"; readonly toolCallId: string; readonly content: string };

export interface TranscriptToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
}

/**
 * Private-to-the-agent conversation that now lives on CollaborationSnapshot.
 * Visibility is not implied by presence: readers must pass Namespace / grant checks.
 */
export interface ParticipantTranscript {
  readonly actorId: ActorId;
  readonly namespaceId: NamespaceId;
  readonly messages: readonly TranscriptMessage[];
  readonly revision: number;
}

export function participantTranscript(
  actorId: ActorId,
  messages: readonly TranscriptMessage[],
  options?: { readonly namespaceId?: NamespaceId; readonly revision?: number },
): ParticipantTranscript {
  return {
    actorId,
    namespaceId: options?.namespaceId ?? DEFAULT_NAMESPACE_ID,
    messages,
    revision: options?.revision ?? 0,
  };
}

/** Cross-namespace default: role + length only, no body. */
export function summarizeTranscript(transcript: ParticipantTranscript): ParticipantTranscript {
  return {
    ...transcript,
    messages: transcript.messages.map((message) => {
      if (message.role === "tool") {
        return { role: "tool", toolCallId: message.toolCallId, content: "[redacted]" };
      }
      return { role: message.role, content: `[${message.role} ${message.content.length} chars]` };
    }),
  };
}
