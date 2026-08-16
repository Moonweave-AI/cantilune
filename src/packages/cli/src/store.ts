import type { SchemaAdmissionReceipt } from "@cantilune/core";
import type { ToolApprovalRequest } from "@cantilune/syscall";
import type { ThemeName } from "./theme/palette.js";

/** TUI 模式 */
export type TuiMode = "chat" | "command" | "view" | "picker" | "confirm" | "ask" | "approve";

/**
 * Layout preset.
 * - `focus`: Claude Code style — streaming prose fills the frame, tool calls collapse to one line.
 * - `observe`: orca style — chat shrinks and live world/graph panels dock beside it.
 */
export type LayoutMode = "focus" | "observe";

/** 视图类型标识符 */
export type ViewType =
  | "world"
  | "world-actors"
  | "world-tasks"
  | "world-sessions"
  | "world-caps"
  | "world-links"
  | "world-diff"
  | "world-retired"
  | "graph"
  | "graph-path"
  | "graph-forks"
  | "graph-stats"
  | "petri"
  | "petri-transitions"
  | "petri-fire"
  | "petri-reach"
  | "petri-invariants"
  | "trace"
  | "trace-obs"
  | "trace-rewrites"
  | "trace-search"
  | "trace-validate"
  | "replay"
  | "replay-recipe"
  | "replay-bundle"
  | "content-cat"
  | "content-ls"
  | "content-search"
  | "content-stats"
  | "content-gc"
  | "observe"
  | "observe-dependency"
  | "observe-resource"
  | "observe-communication"
  | "observe-structure"
  | "observe-spine"
  | "observe-diagnostic"
  | "schema"
  | "schema-ops"
  | "schema-epoch"
  | "schema-epoch-history"
  | "schema-diff"
  | "schema-validate"
  | "schema-admit"
  | "schema-commit"
  | "schema-rollout"
  | "eval-run"
  | "eval-list"
  | "eval-report"
  | "eval-compare"
  | "cluster"
  | "cluster-status"
  | "cluster-topology"
  | "swarm"
  | "swarm-status"
  | "swarm-schedule"
  | "tools"
  | "tools-test"
  | "mcp"
  | "mcp-connect"
  | "mcp-disconnect"
  | "config"
  | "session-list"
  | "status"
  | "export"
  | "help"
  | "events";

/**
 * One stage in an assistant message's lifecycle, rendered inline beneath the
 * prose so the transcript itself reads as a complete lifecycle view — turn
 * open, LLM thinking, each tool dispatch (with its coordination flag), any
 * diagnostics, and turn close. No slash-command switch is required: the
 * default transcript shows the whole intermediate process.
 *
 * `stage` is a closed union kept free of any boot dependency; the hook
 * (`useAgentLoop`) translates `AgentEvent`s into these lines.
 */
export interface LifecycleLine {
  readonly stage:
    "turn_open" | "llm" | "tool_start" | "tool_end" | "diagnostic" | "error" | "turn_close";
  readonly label: string;
  readonly ts: number;
  /** True for coordination (cluster-affecting) tool calls — coloured distinctly. */
  readonly coordination?: boolean;
  /** Optional detail, e.g. a diagnostic reason or tool failure output. */
  readonly detail?: string;
}

/** 聊天消息 */
export interface ChatMessage {
  readonly role: "user" | "assistant" | "system" | "error";
  readonly content: string;
  readonly toolCalls?: readonly ToolCallDisplay[];
  readonly timestamp: number;
  /** True while assistant text is still arriving; drives the streaming caret. */
  readonly streaming?: boolean;
  /** Turn number this message belongs to, for grouping in the transcript. */
  readonly turn?: number;
  /**
   * Ordered lifecycle stages for this assistant message — the always-on view of
   * the intermediate process. Populated by `useAgentLoop` as events arrive.
   */
  readonly lifecycle?: readonly LifecycleLine[];
}

export interface ToolCallDisplay {
  readonly id: string;
  readonly name: string;
  readonly args: Record<string, unknown>;
  readonly result?: { ok: boolean; output: string };
  readonly status: "pending" | "running" | "done" | "error";
  readonly startedAt?: number;
  readonly endedAt?: number;
  /**
   * True for coordination (cluster-affecting) tool calls — rendered with the
   * secondary accent colour so cluster activity is visually distinct from
   * ordinary read/write/tool dispatches. Absent for non-coordination calls.
   */
  readonly coordination?: boolean;
}

/**
 * One entry in the live event timeline — the always-on, per-event view of the
 * agent loop's intermediate process. Mirrors the `AgentEvent` stream from the
 * boot layer so the user can observe every turn/llm/tool step as it happens,
 * complementing the post-hoc aggregated `observe` four-view bundle.
 *
 * `kind` is a string-literal union (not a direct `AgentEvent` reference) so
 * the store stays free of a boot dependency; the two are kept in sync by hand.
 */
export interface TimelineEntry {
  readonly seq: number;
  readonly ts: number;
  readonly turn: number;
  readonly kind:
    | "turn_start"
    | "llm_start"
    | "llm_delta"
    | "llm_end"
    | "tool_start"
    | "tool_end"
    | "turn_end"
    | "error"
    | "control_verdict"
    | "ask_user"
    | "diagnostic";
  readonly label: string;
  readonly detail?: string;
}

/** Max entries retained in the live event timeline (ring buffer). */
const EVENT_LOG_CAPACITY = 500;

/** What the agent is doing right now, surfaced in the status line. */
export type AgentPhase =
  | { readonly kind: "idle" }
  | { readonly kind: "perceiving"; readonly turn: number }
  | { readonly kind: "thinking"; readonly turn: number; readonly since: number }
  | {
      readonly kind: "tool";
      readonly turn: number;
      readonly name: string;
      readonly since: number;
    }
  | { readonly kind: "asking"; readonly turn: number };

/** Session 状态 */
export interface SessionState {
  readonly messages: readonly ChatMessage[];
  readonly turnCount: number;
  readonly startTime: number;
  readonly tokenUsage: { prompt: number; completion: number; total: number };
  readonly costUsd: number;
}

/**
 * A pending controller-initiated question awaiting the user's answer.
 *
 * Emitted when the termination controller verdicts ASK_USER and the loop pauses
 * on the `onAskUser` promise. The TUI renders the question (an option picker when
 * `options` are provided, a free-text input otherwise) and resolves `answer` with
 * the user's reply, which the loop injects as a new user message before resuming.
 */
export interface PendingAsk {
  readonly question: string;
  readonly options?: readonly string[];
  readonly answer: (reply: string) => void;
}

/**
 * A side-effecting tool invocation paused on the operator's authorization.
 *
 * The syscall layer holds the dispatch until `decide` resolves, so nothing has
 * run yet and a denial leaves no journal entry (ADR-0016). `decide` is called
 * exactly once.
 */
/**
 * MCP tool-surface change scheduled for the next turn (ADR-0026).
 * The current LLM turn keeps the old tools until `applyPendingMcpAttach`.
 */
export interface PendingToolSurface {
  readonly action: "connect" | "disconnect";
  readonly servers: readonly string[];
  readonly currentEpoch: string;
  readonly admissionId?: string;
  readonly admissionReceipt?: SchemaAdmissionReceipt;
}

export interface PendingApproval {
  readonly request: ToolApprovalRequest;
  readonly decide: (choice: "once" | "always" | "deny") => void;
}

export interface SnapshotData {
  readonly snapshotRef: string;
  readonly epochId: string;
  readonly participants: readonly { id: string; kind: string; status: string }[];
  readonly artifacts: readonly {
    id: string;
    kind: string;
    lifecycle: string;
    contentRef: string;
  }[];
  readonly sessions: readonly { id: string; initiator: string; status: string }[];
  readonly capabilities: readonly { id: string; kind: string; holder: string }[];
  readonly links: readonly { from: string; to: string; kind: string }[];
  readonly auditTail: readonly { source: string; payloadRef: string; timestamp: string }[];
  readonly retired: readonly { id: string; kind: string; retiredAt: string }[];
}

export interface ChangeLogEntry {
  readonly changeId: string;
  readonly operationTypeId: string;
  readonly initiator: string;
  readonly beforeRef: string;
  readonly afterRef: string;
  readonly timestamp: string;
}

export interface EpochInfo {
  readonly epochId: string;
  readonly ordinal: number;
  readonly schemaId: string;
}

export interface RuntimeState {
  readonly snapshot: SnapshotData | null;
  readonly changeLog: ChangeLogEntry[];
  readonly epoch: EpochInfo | null;
}

export function createEmptyRuntime(): RuntimeState {
  return {
    snapshot: null,
    changeLog: [],
    epoch: null,
  };
}

/** 全局 store */
export interface AppStore {
  mode: TuiMode;
  layout: LayoutMode;
  /** Active colour theme; `null` means "use whatever the terminal detection picked". */
  theme: ThemeName | null;
  activeView: ViewType | null;
  viewArgs: Record<string, unknown>;
  session: SessionState;
  provider: string;
  model: string;
  baseUrl: string | undefined;
  durable: "memory" | "file";
  storagePath: string | undefined;
  principalId: string | undefined;
  compatibleEpochIds: readonly string[] | undefined;
  maxTurns: number | undefined;
  contractProvider: string | undefined;
  contractModel: string | undefined;
  judgeProvider: string | undefined;
  judgeModel: string | undefined;
  judgeQuorumModels: readonly string[] | undefined;
  mcpServers: readonly string[] | undefined;
  searchProvider: "tavily" | "serper" | "brave" | "none" | undefined;
  connected: boolean;
  agentRunning: boolean;
  phase: AgentPhase;
  runtime: RuntimeState;
  /** Transient notice shown in the status line (errors, confirmations). */
  notice: { readonly level: "info" | "warn" | "error"; readonly text: string } | null;
  /** Controller-initiated question the loop is paused on, or null when idle. */
  pendingAsk: PendingAsk | null;
  /** Tool invocation awaiting operator authorization, or null when idle. */
  pendingApproval: PendingApproval | null;
  /** Epoch-bound MCP attach waiting for the next turn (ADR-0026). */
  pendingToolSurface: PendingToolSurface | null;
  /** Live per-event timeline of the agent loop; ring-buffered to {@link EVENT_LOG_CAPACITY}. */
  eventLog: readonly TimelineEntry[];
}

export function createEmptySession(): SessionState {
  return {
    messages: [],
    turnCount: 0,
    startTime: Date.now(),
    tokenUsage: { prompt: 0, completion: 0, total: 0 },
    costUsd: 0,
  };
}

export function createStore(overrides?: Partial<AppStore>): AppStore {
  return {
    mode: "chat",
    layout: "focus",
    theme: null,
    activeView: null,
    viewArgs: {},
    session: createEmptySession(),
    provider: "openai",
    model: "gpt-4o",
    baseUrl: undefined,
    durable: "file",
    storagePath: "./.cantilune/os",
    principalId: undefined,
    compatibleEpochIds: undefined,
    maxTurns: undefined,
    contractProvider: undefined,
    contractModel: undefined,
    judgeProvider: undefined,
    judgeModel: undefined,
    judgeQuorumModels: undefined,
    mcpServers: undefined,
    searchProvider: undefined,
    connected: false,
    agentRunning: false,
    phase: { kind: "idle" },
    runtime: createEmptyRuntime(),
    notice: null,
    pendingAsk: null,
    pendingApproval: null,
    pendingToolSurface: null,
    eventLog: [],
    ...overrides,
  };
}

/**
 * Reactive wrapper around {@link AppStore}.
 *
 * The TUI previously mutated a ref and hand-called `rerender()` at every call
 * site, so any missed call silently froze the UI. This makes the store the
 * single source of change notification: mutate through {@link ReactiveStore.set}
 * and every subscriber re-renders.
 */
export class ReactiveStore {
  private state: AppStore;
  private readonly listeners = new Set<() => void>();
  private version = 0;
  /** Monotonic sequence for timeline entries; survives ring-buffer eviction. */
  private timelineSeq = 0;

  constructor(initial?: Partial<AppStore>) {
    this.state = createStore(initial);
  }

  /**
   * Wrap an existing state object without copying it.
   *
   * Used when a caller already owns a complete {@link AppStore} (tests,
   * one-shot renders) and expects reads to return that exact reference.
   */
  static fromSnapshot(state: AppStore): ReactiveStore {
    const store = new ReactiveStore();
    store.state = state;
    return store;
  }

  get(): AppStore {
    return this.state;
  }

  /** Monotonic change counter — cheap identity for `useSyncExternalStore`. */
  getVersion(): number {
    return this.version;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Apply a partial update and notify subscribers. */
  set(patch: Partial<AppStore> | ((current: AppStore) => Partial<AppStore>)): void {
    const resolved = typeof patch === "function" ? patch(this.state) : patch;
    this.state = { ...this.state, ...resolved };
    this.version++;
    this.emit();
  }

  /** Replace the session wholesale, keeping the rest of the store intact. */
  setSession(
    patch: Partial<SessionState> | ((current: SessionState) => Partial<SessionState>),
  ): void {
    const resolved = typeof patch === "function" ? patch(this.state.session) : patch;
    this.set({ session: { ...this.state.session, ...resolved } });
  }

  /** Append a message to the transcript. */
  appendMessage(message: ChatMessage): void {
    this.setSession((session) => ({ messages: [...session.messages, message] }));
  }

  /**
   * Rewrite the last message in place. Used by streaming to grow the assistant
   * bubble without pushing a new entry per token.
   */
  updateLastMessage(update: (message: ChatMessage) => ChatMessage): void {
    this.setSession((session) => {
      if (session.messages.length === 0) return {};
      const messages = session.messages.slice();
      const last = messages.at(-1);
      if (last === undefined) return {};
      messages[messages.length - 1] = update(last);
      return { messages };
    });
  }

  /**
   * Rewrite the most recent assistant bubble. Tool cards are appended as
   * later system messages, so {@link updateLastMessage} is not the turn owner.
   */
  updateLastAssistant(update: (message: ChatMessage) => ChatMessage): void {
    this.setSession((session) => {
      const messages = session.messages.slice();
      for (let i = messages.length - 1; i >= 0; i--) {
        const current = messages[i];
        if (current?.role === "assistant") {
          messages[i] = update(current);
          return { messages };
        }
      }
      return {};
    });
  }

  /**
   * Append one entry to the live event timeline. The buffer is a ring: once
   * it reaches {@link EVENT_LOG_CAPACITY} the oldest entry is evicted, so a
   * long run cannot grow the store unboundedly while recent context is kept.
   */
  appendTimelineEntry(
    turn: number,
    kind: TimelineEntry["kind"],
    label: string,
    detail?: string,
  ): void {
    this.timelineSeq += 1;
    const entry: TimelineEntry = {
      seq: this.timelineSeq,
      ts: Date.now(),
      turn,
      kind,
      label,
      ...(detail !== undefined ? { detail } : {}),
    };
    const current = this.state.eventLog;
    const next =
      current.length >= EVENT_LOG_CAPACITY
        ? [...current.slice(current.length - EVENT_LOG_CAPACITY + 1), entry]
        : [...current, entry];
    this.set({ eventLog: next });
  }

  /**
   * Append a lifecycle line to a specific assistant message (located by its
   * `timestamp` anchor), so the transcript renders the intermediate process
   * inline beneath that turn's prose. Tool dispatches create their own system
   * messages after the assistant bubble, so "last message" is not reliably the
   * turn owner — the caller tracks the anchor (`useAgentLoop` records the
   * assistant message timestamp at `llm_delta`) and passes it here.
   *
   * If no assistant message matches the anchor the line is dropped: lifecycle
   * lines are only meaningful inside an assistant turn's bubble.
   */
  appendLifecycleLine(anchorTimestamp: number, line: LifecycleLine): void {
    this.setSession((session) => {
      let index = -1;
      for (let i = session.messages.length - 1; i >= 0; i--) {
        const m = session.messages[i];
        if (m !== undefined && m.role === "assistant" && m.timestamp === anchorTimestamp) {
          index = i;
          break;
        }
      }
      if (index === -1) return {};
      const messages = session.messages.slice();
      const target = messages[index];
      if (target === undefined) return {};
      messages[index] = {
        ...target,
        lifecycle: [...(target.lifecycle ?? []), line],
      };
      return { messages };
    });
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
