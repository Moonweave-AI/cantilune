/**
 * Conversation node model — ADR-0030 §4.2.
 *
 * Turns the wire `AgentEvent` stream into an ordered list of renderable nodes.
 * One node per logical item: a user instruction, an assistant reply, a reasoning
 * block (fed by llm_delta), a tool call (start→end pair), a control verdict, an
 * ask_user, a diagnostic, a turn boundary, or an error.
 */

import type {
  AgentEventWire,
  ApprovalRequestEvent,
  ControlVerdictKindWire,
  RunResultEvent,
  TerminationAuditWire,
} from "@shared/protocol";

export type NodeKind =
  | "user"
  | "assistant"
  | "reasoning"
  | "tool_call"
  | "control_verdict"
  | "ask_user"
  | "diagnostic"
  | "turn"
  | "error"
  | "approval"
  | "run_result";

export interface ConversationNode {
  readonly id: string;
  readonly kind: NodeKind;
  readonly turn: number;
  readonly text?: string;
  readonly toolName?: string;
  readonly toolCallId?: string;
  readonly arguments?: Record<string, unknown>;
  readonly output?: string;
  readonly ok?: boolean;
  readonly coordination?: boolean;
  readonly verdictKind?: ControlVerdictKindWire;
  readonly verdictReason?: string;
  readonly audit?: TerminationAuditWire;
  readonly missingEvidence?: readonly string[];
  readonly question?: string;
  readonly options?: readonly string[];
  readonly phase?: string;
  readonly message?: string;
  readonly retryable?: boolean;
  readonly detail?: string;
  readonly lastAction?: string;
  readonly elapsedMs?: number;
  readonly usage?: { readonly prompt: number; readonly completion: number; readonly total: number };
  readonly pending?: boolean;
  readonly approval?: {
    readonly toolCallId: string;
    readonly name: string;
    readonly arguments: Record<string, unknown>;
    readonly tier: string;
  };
  readonly runResult?: RunResultEvent;
}

let nodeSeq = 0;
function nextId(prefix: string): string {
  nodeSeq += 1;
  return `${prefix}-${nodeSeq}`;
}

export interface ConversationState {
  readonly nodes: readonly ConversationNode[];
}

export function createConversationState(): ConversationState {
  return { nodes: [] };
}

export function appendUserInstruction(
  state: ConversationState,
  instruction: string,
): ConversationState {
  const node: ConversationNode = { id: nextId("user"), kind: "user", turn: 0, text: instruction };
  return { nodes: [...state.nodes, node] };
}

/**
 * Reduce an incoming agent event into the node list. Reasoning deltas are
 * accumulated into the most recent reasoning node for the same turn; tool_end
 * merges into the matching tool_start node; everything else appends.
 */
export function reduceAgentEvent(
  state: ConversationState,
  event: AgentEventWire,
): ConversationState {
  switch (event.kind) {
    case "turn_start":
      return {
        nodes: [
          ...state.nodes,
          {
            id: nextId("turn"),
            kind: "turn",
            turn: event.turn,
            lastAction: "turn_start",
            elapsedMs: event.elapsedMs,
          },
        ],
      };

    case "llm_start":
      // a new LLM turn begins; reasoning deltas will follow.
      return state;

    case "llm_delta": {
      const idx = [...state.nodes]
        .reverse()
        .findIndex((n) => n.kind === "reasoning" && n.turn === event.turn);
      if (idx === -1) {
        const node: ConversationNode = {
          id: nextId("reason"),
          kind: "reasoning",
          turn: event.turn,
          text: event.text,
          pending: true,
        };
        return { nodes: [...state.nodes, node] };
      }
      const realIdx = state.nodes.length - 1 - idx;
      const existing = state.nodes[realIdx];
      if (existing === undefined) return state;
      const merged: ConversationNode = {
        ...existing,
        text: (existing.text ?? "") + event.text,
        pending: true,
      };
      const nodes = [...state.nodes];
      nodes[realIdx] = merged;
      return { nodes };
    }

    case "llm_end": {
      // mark the reasoning node done; if there's text, add an assistant node.
      const nodes = [...state.nodes];
      const rIdx = [...nodes]
        .reverse()
        .findIndex((n) => n.kind === "reasoning" && n.turn === event.turn);
      if (rIdx !== -1) {
        const realIdx = nodes.length - 1 - rIdx;
        const r = nodes[realIdx];
        if (r !== undefined) nodes[realIdx] = { ...r, pending: false };
      }
      const next: ConversationNode[] = [];
      if (event.text.length > 0) {
        const asst: ConversationNode = {
          id: nextId("asst"),
          kind: "assistant",
          turn: event.turn,
          text: event.text,
          ...(event.usage !== undefined ? { usage: event.usage } : {}),
        };
        next.push(asst);
      }
      for (const call of event.toolCalls) {
        next.push({
          id: nextId("tool"),
          kind: "tool_call",
          turn: event.turn,
          toolName: call.name,
          toolCallId: call.id,
          arguments: call.arguments,
          pending: true,
        });
      }
      return { nodes: [...nodes, ...next] };
    }

    case "tool_start": {
      // match a pending tool_call node from llm_end by toolCallId, else append.
      const idx = state.nodes.findIndex(
        (n) => n.kind === "tool_call" && n.toolCallId === event.toolCallId,
      );
      if (idx !== -1) {
        const nodes = [...state.nodes];
        const existing = nodes[idx];
        if (existing !== undefined) {
          nodes[idx] = {
            ...existing,
            toolName: event.name,
            arguments: event.arguments,
            ...(event.coordination !== undefined ? { coordination: event.coordination } : {}),
            pending: true,
          };
        }
        return { nodes };
      }
      return {
        nodes: [
          ...state.nodes,
          {
            id: nextId("tool"),
            kind: "tool_call",
            turn: event.turn,
            toolCallId: event.toolCallId,
            toolName: event.name,
            arguments: event.arguments,
            ...(event.coordination !== undefined ? { coordination: event.coordination } : {}),
            pending: true,
          },
        ],
      };
    }

    case "tool_end": {
      const idx = state.nodes.findIndex(
        (n) => n.kind === "tool_call" && n.toolCallId === event.toolCallId,
      );
      if (idx === -1) return state;
      const nodes = [...state.nodes];
      const existing = nodes[idx];
      if (existing === undefined) return state;
      nodes[idx] = {
        ...existing,
        ok: event.ok,
        output: event.output,
        ...(event.coordination !== undefined ? { coordination: event.coordination } : {}),
        pending: false,
      };
      return { nodes };
    }

    case "turn_end":
      return {
        nodes: [
          ...state.nodes,
          {
            id: nextId("turn"),
            kind: "turn",
            turn: event.turn,
            lastAction: event.lastAction,
            elapsedMs: event.elapsedMs,
          },
        ],
      };

    case "control_verdict":
      return {
        nodes: [
          ...state.nodes,
          {
            id: nextId("verd"),
            kind: "control_verdict",
            turn: event.turn,
            verdictKind: event.verdict.kind,
            ...(event.verdict.reason !== undefined ? { verdictReason: event.verdict.reason } : {}),
            ...(event.verdict.audit !== undefined ? { audit: event.verdict.audit } : {}),
            ...(event.verdict.missingEvidence !== undefined
              ? { missingEvidence: event.verdict.missingEvidence }
              : {}),
          },
        ],
      };

    case "ask_user":
      return {
        nodes: [
          ...state.nodes,
          {
            id: nextId("ask"),
            kind: "ask_user",
            turn: event.turn,
            question: event.question,
            ...(event.options !== undefined ? { options: event.options } : {}),
            pending: true,
          },
        ],
      };

    case "diagnostic":
      return {
        nodes: [
          ...state.nodes,
          {
            id: nextId("diag"),
            kind: "diagnostic",
            turn: event.turn,
            phase: event.phase,
            message: event.message,
            ...(event.detail !== undefined ? { detail: event.detail } : {}),
          },
        ],
      };

    case "error":
      return {
        nodes: [
          ...state.nodes,
          {
            id: nextId("err"),
            kind: "error",
            turn: event.turn,
            phase: event.phase,
            message: event.message,
            retryable: event.retryable,
            ...(event.detail !== undefined ? { detail: event.detail } : {}),
          },
        ],
      };
  }
}

export function appendApproval(
  state: ConversationState,
  approval: ApprovalRequestEvent,
): ConversationState {
  const node: ConversationNode = {
    id: nextId("appr"),
    kind: "approval",
    turn: 0,
    pending: true,
    approval: {
      toolCallId: approval.toolCallId,
      name: approval.name,
      arguments: approval.arguments,
      tier: approval.tier,
    },
  };
  return { nodes: [...state.nodes, node] };
}

export function resolveApproval(state: ConversationState, toolCallId: string): ConversationState {
  const nodes = state.nodes.map((n) =>
    n.kind === "approval" && n.approval?.toolCallId === toolCallId ? { ...n, pending: false } : n,
  );
  return { nodes };
}

export function resolveAskUser(state: ConversationState, answer: string): ConversationState {
  const idx = [...state.nodes].reverse().findIndex((n) => n.kind === "ask_user" && n.pending);
  if (idx === -1) return state;
  const realIdx = state.nodes.length - 1 - idx;
  const nodes = [...state.nodes];
  const existing = nodes[realIdx];
  if (existing === undefined) return state;
  nodes[realIdx] = { ...existing, text: answer, pending: false };
  return { nodes };
}

export function appendRunResult(
  state: ConversationState,
  result: RunResultEvent,
): ConversationState {
  const node: ConversationNode = {
    id: nextId("res"),
    kind: "run_result",
    turn: 0,
    runResult: result,
  };
  return { nodes: [...state.nodes, node] };
}

export function appendError(state: ConversationState, message: string): ConversationState {
  const node: ConversationNode = { id: nextId("syserr"), kind: "error", turn: 0, message };
  return { nodes: [...state.nodes, node] };
}
