/**
 * Conversation node model — ADR-0030 §4.2.
 *
 * Turns the wire `AgentEvent` stream into an ordered list of renderable nodes.
 * One node per logical item: a user instruction, an assistant reply (fed by
 * llm_delta / llm_end — the same visible stream the CLI grows), a tool call
 * (start→end pair), a control verdict, an ask_user, a diagnostic, a turn
 * boundary, or an error. `llm_delta` is assistant tokens, not hidden CoT.
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
  readonly startedAt?: number;
  readonly endedAt?: number;
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

function createNode(
  prefix: string,
  fields: Omit<ConversationNode, "id" | "startedAt">,
): ConversationNode {
  return { id: nextId(prefix), startedAt: Date.now(), ...fields };
}

function finishNode(
  node: ConversationNode,
  extra: Partial<ConversationNode> = {},
): ConversationNode {
  const endedAt = extra.endedAt ?? Date.now();
  const elapsedMs =
    extra.elapsedMs ??
    (node.startedAt !== undefined ? Math.max(0, endedAt - node.startedAt) : node.elapsedMs);
  return {
    ...node,
    ...extra,
    endedAt,
    ...(elapsedMs !== undefined ? { elapsedMs } : {}),
  };
}

export interface ConversationState {
  readonly nodes: readonly ConversationNode[];
}

export function createConversationState(): ConversationState {
  return { nodes: [] };
}

/** Keep `nextId` ahead of restored nodes so refresh does not collide. */
export function adoptNodeSeq(nodes: readonly ConversationNode[]): void {
  for (const node of nodes) {
    const match = /-(\d+)$/.exec(node.id);
    if (match?.[1] === undefined) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value)) nodeSeq = Math.max(nodeSeq, value);
  }
}

const MAX_STORED_NODES = 100;
const MAX_STORED_CHARS = 8_000;
const SKIP_STORED_KINDS: ReadonlySet<NodeKind> = new Set(["turn", "diagnostic"]);

function clipText(value: string): string {
  if (value.length <= MAX_STORED_CHARS) return value;
  return `${value.slice(0, MAX_STORED_CHARS)}…`;
}

function clipArgs(args: Record<string, unknown>): Record<string, unknown> {
  try {
    const json = JSON.stringify(args);
    if (json.length <= MAX_STORED_CHARS) return args;
    return { preview: json.slice(0, MAX_STORED_CHARS) };
  } catch {
    return { preview: "[unserializable]" };
  }
}

/** Drop noisy / oversized fields so a saved session cannot freeze the next load. */
export function compactConversation(state: ConversationState): ConversationState {
  const kept = state.nodes.filter((node) => !SKIP_STORED_KINDS.has(node.kind)).map((node) => {
    const next: ConversationNode = {
      ...node,
      pending: false,
      ...(node.text !== undefined ? { text: clipText(node.text) } : {}),
      ...(node.output !== undefined ? { output: clipText(node.output) } : {}),
      ...(node.detail !== undefined ? { detail: clipText(node.detail) } : {}),
      ...(node.message !== undefined ? { message: clipText(node.message) } : {}),
      ...(node.question !== undefined ? { question: clipText(node.question) } : {}),
      ...(node.arguments !== undefined ? { arguments: clipArgs(node.arguments) } : {}),
      ...(node.runResult !== undefined
        ? { runResult: { ...node.runResult, summary: clipText(node.runResult.summary) } }
        : {}),
    };
    return next;
  });
  return { nodes: kept.length > MAX_STORED_NODES ? kept.slice(-MAX_STORED_NODES) : kept };
}

/** Restore a persisted transcript; in-flight pending flags are stale after reload. */
export function thawConversation(state: ConversationState): ConversationState {
  const compacted = compactConversation(state);
  adoptNodeSeq(compacted.nodes);
  return {
    nodes: compacted.nodes.map((node) =>
      node.kind === "reasoning" ? { ...node, kind: "assistant" } : node,
    ),
  };
}

function lastIndexOf(
  nodes: readonly ConversationNode[],
  predicate: (node: ConversationNode) => boolean,
): number {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    if (predicate(nodes[index]!)) return index;
  }
  return -1;
}

export function appendUserInstruction(
  state: ConversationState,
  instruction: string,
): ConversationState {
  return {
    nodes: [...state.nodes, createNode("user", { kind: "user", turn: 0, text: instruction })],
  };
}

/**
 * Reduce an incoming agent event into the node list. Streamed `llm_delta`
 * tokens grow the pending assistant node for that turn; `llm_end` finalizes
 * it (and supplies the full text when the adapter did not stream). tool_end
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
          createNode("turn", {
            kind: "turn",
            turn: event.turn,
            lastAction: "turn_start",
            elapsedMs: event.elapsedMs,
          }),
        ],
      };

    case "llm_start":
      return state;

    case "llm_delta": {
      const idx = lastIndexOf(
        state.nodes,
        (node) => node.kind === "assistant" && node.turn === event.turn && node.pending === true,
      );
      if (idx === -1) {
        return {
          nodes: [
            ...state.nodes,
            createNode("asst", {
              kind: "assistant",
              turn: event.turn,
              text: event.text,
              pending: true,
            }),
          ],
        };
      }
      const existing = state.nodes[idx];
      if (existing === undefined) return state;
      const nodes = [...state.nodes];
      nodes[idx] = { ...existing, text: (existing.text ?? "") + event.text, pending: true };
      return { nodes };
    }

    case "llm_end": {
      const nodes = [...state.nodes];
      const idx = lastIndexOf(
        nodes,
        (node) => node.kind === "assistant" && node.turn === event.turn,
      );
      const usage = event.usage !== undefined ? { usage: event.usage } : {};
      if (idx !== -1) {
        const existing = nodes[idx];
        if (existing !== undefined) {
          const streamed = existing.text ?? "";
          const text =
            event.text.length > 0 && (streamed.length === 0 || event.text.length >= streamed.length)
              ? event.text
              : streamed;
          nodes[idx] = finishNode(existing, { pending: false, text, ...usage });
        }
      } else if (event.text.length > 0) {
        nodes.push(
          createNode("asst", {
            kind: "assistant",
            turn: event.turn,
            text: event.text,
            ...usage,
          }),
        );
      }
      for (const call of event.toolCalls) {
        nodes.push(
          createNode("tool", {
            kind: "tool_call",
            turn: event.turn,
            toolName: call.name,
            toolCallId: call.id,
            arguments: call.arguments,
            pending: true,
          }),
        );
      }
      return { nodes };
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
          createNode("tool", {
            kind: "tool_call",
            turn: event.turn,
            toolCallId: event.toolCallId,
            toolName: event.name,
            arguments: event.arguments,
            ...(event.coordination !== undefined ? { coordination: event.coordination } : {}),
            pending: true,
          }),
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
      nodes[idx] = finishNode(existing, {
        ok: event.ok,
        output: event.output,
        ...(event.coordination !== undefined ? { coordination: event.coordination } : {}),
        pending: false,
      });
      return { nodes };
    }

    case "turn_end":
      return {
        nodes: [
          ...state.nodes,
          createNode("turn", {
            kind: "turn",
            turn: event.turn,
            lastAction: event.lastAction,
            elapsedMs: event.elapsedMs,
          }),
        ],
      };

    case "control_verdict":
      return {
        nodes: [
          ...state.nodes,
          createNode("verd", {
            kind: "control_verdict",
            turn: event.turn,
            verdictKind: event.verdict.kind,
            ...(event.verdict.reason !== undefined ? { verdictReason: event.verdict.reason } : {}),
            ...(event.verdict.audit !== undefined ? { audit: event.verdict.audit } : {}),
            ...(event.verdict.missingEvidence !== undefined
              ? { missingEvidence: event.verdict.missingEvidence }
              : {}),
          }),
        ],
      };

    case "ask_user":
      return {
        nodes: [
          ...state.nodes,
          createNode("ask", {
            kind: "ask_user",
            turn: event.turn,
            question: event.question,
            ...(event.options !== undefined ? { options: event.options } : {}),
            pending: true,
          }),
        ],
      };

    case "diagnostic":
      return {
        nodes: [
          ...state.nodes,
          createNode("diag", {
            kind: "diagnostic",
            turn: event.turn,
            phase: event.phase,
            message: event.message,
            ...(event.detail !== undefined ? { detail: event.detail } : {}),
          }),
        ],
      };

    case "error":
      return {
        nodes: [
          ...state.nodes,
          createNode("err", {
            kind: "error",
            turn: event.turn,
            phase: event.phase,
            message: event.message,
            retryable: event.retryable,
            ...(event.detail !== undefined ? { detail: event.detail } : {}),
          }),
        ],
      };
  }
}

export function appendApproval(
  state: ConversationState,
  approval: ApprovalRequestEvent,
): ConversationState {
  return {
    nodes: [
      ...state.nodes,
      createNode("appr", {
        kind: "approval",
        turn: 0,
        pending: true,
        approval: {
          toolCallId: approval.toolCallId,
          name: approval.name,
          arguments: approval.arguments,
          tier: approval.tier,
        },
      }),
    ],
  };
}

export function resolveApproval(state: ConversationState, toolCallId: string): ConversationState {
  const nodes = state.nodes.map((n) => {
    if (n.kind !== "approval" || n.pending !== true) return n;
    if (toolCallId !== "*" && n.approval?.toolCallId !== toolCallId) return n;
    return finishNode(n, { pending: false });
  });
  return { nodes };
}

export function resolveAskUser(state: ConversationState, answer: string): ConversationState {
  const idx = [...state.nodes].reverse().findIndex((n) => n.kind === "ask_user" && n.pending);
  if (idx === -1) return state;
  const realIdx = state.nodes.length - 1 - idx;
  const nodes = [...state.nodes];
  const existing = nodes[realIdx];
  if (existing === undefined) return state;
  nodes[realIdx] = finishNode(existing, { text: answer, pending: false });
  return { nodes };
}

export function appendRunResult(
  state: ConversationState,
  result: RunResultEvent,
): ConversationState {
  return {
    nodes: [...state.nodes, createNode("res", { kind: "run_result", turn: 0, runResult: result })],
  };
}

export function appendError(state: ConversationState, message: string): ConversationState {
  return { nodes: [...state.nodes, createNode("syserr", { kind: "error", turn: 0, message })] };
}
