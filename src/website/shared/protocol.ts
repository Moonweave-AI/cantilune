/**
 * Shared WebSocket protocol + types for the Cantilune website harness bridge.
 *
 * The browser is a view + control surface; the Node backend is the authority.
 * This module is imported by both `@cantilune/website-server` and
 * `@cantilune/website-client`, so it must not import `node:*` or any
 * Cantilune package that does. It re-declares the shapes of the runtime types
 * the wire carries, so the client never needs to depend on `@cantilune/boot`.
 *
 * ADR-0030. Unverified until a real run streams these over the socket.
 */

/* ───────────────────────── Client → server ───────────────────────── */

export interface ConfigureRequest {
  readonly type: "configure";
  readonly provider: string;
  readonly model: string;
  readonly baseUrl?: string;
  /**
   * Sent to server memory on configure. It is never persisted by the browser.
   */
  readonly apiKey?: string;
  readonly durable?: "memory" | "file";
  readonly storagePath?: string;
  /** Explicit user-selected runtime workspace for filesystem/shell tools. */
  readonly workspace?: string;
  readonly principalId?: string;
  readonly maxTurns?: number;
  readonly maxTimeMs?: number;
  readonly maxContextMessages?: number;
  readonly systemPrompt?: string;
  readonly thresholds?: {
    readonly tauC?: number;
    readonly tauU?: number;
    readonly epsilon?: number;
    readonly lambda?: number;
    readonly mu?: number;
    readonly hardGate?: number;
  };
  readonly contractProvider?: string;
  readonly contractModel?: string;
  readonly judgeProvider?: string;
  readonly judgeModel?: string;
  readonly searchProvider?: "cloakbrowser" | "tavily" | "serper" | "brave" | "none";
  readonly mcpServers?: readonly string[];
}

export interface RunRequest {
  readonly type: "run";
  readonly instruction: string;
  readonly mode?: "execute" | "plan" | "observe";
}

export interface AskUserReply {
  readonly type: "askUser:reply";
  readonly answer: string;
}

export interface ApproveRequest {
  readonly type: "approve";
  readonly toolCallId: string;
  readonly decision: "allow" | "deny";
  /** Allow the rest of this run without further prompts. */
  readonly scope?: "once" | "always";
}

export interface SetModeRequest {
  readonly type: "setMode";
  readonly mode: "execute" | "plan" | "observe";
}

export interface PickWorkspaceRequest {
  readonly type: "pickWorkspace";
}

export interface StopRequest {
  readonly type: "stop";
}

export interface InspectRequest {
  readonly type: "inspect";
  readonly ref: string;
}

/* ───────────────────────── Swarm control (client → server) ───────────────────────── */

export interface SwarmStartRequest {
  readonly type: "swarm:start";
}

export interface SwarmStopRequest {
  readonly type: "swarm:stop";
}

export interface SwarmActivateRequest {
  readonly type: "swarm:activate";
  readonly agentId: string;
  readonly manifest?: {
    readonly assignedTask: string;
    readonly systemPrompt?: string;
    readonly model?: string;
    readonly provider?: string;
    readonly startCondition?: StartConditionExpressionWire;
    readonly maxTurns?: number;
    readonly maxTimeMs?: number;
    readonly heartbeatIntervalMs?: number;
  };
}

export interface SwarmStatusRequest {
  readonly type: "swarm:status";
}

/** Wire shape of a StartConditionExpression (atom/and/or/not tree). */
export type StartConditionExpressionWire =
  | {
      readonly operator: "atom";
      readonly atom: {
        readonly evaluator: string;
        readonly params: Readonly<Record<string, unknown>>;
      };
    }
  | { readonly operator: "and"; readonly operands: readonly StartConditionExpressionWire[] }
  | { readonly operator: "or"; readonly operands: readonly StartConditionExpressionWire[] }
  | { readonly operator: "not"; readonly operand: StartConditionExpressionWire };

export type ClientMessage =
  | ConfigureRequest
  | RunRequest
  | AskUserReply
  | ApproveRequest
  | SetModeRequest
  | PickWorkspaceRequest
  | StopRequest
  | InspectRequest
  | SwarmStartRequest
  | SwarmStopRequest
  | SwarmActivateRequest
  | SwarmStatusRequest;

/* ───────────────────────── Server → client ───────────────────────── */

/**
 * The wire shape of an `AgentEvent` from `@cantilune/boot`. Fields are a
 * verbatim projection; the client renders them. Defined here so the client
 * does not depend on `@cantilune/boot` (which is Node-only).
 */
export type AgentEventWire =
  | { readonly kind: "turn_start"; readonly turn: number; readonly elapsedMs: number }
  | { readonly kind: "llm_start"; readonly turn: number; readonly model?: string }
  | { readonly kind: "llm_delta"; readonly turn: number; readonly text: string }
  | {
      readonly kind: "llm_end";
      readonly turn: number;
      readonly text: string;
      readonly toolCalls: readonly ToolCallWire[];
      readonly usage?: {
        readonly prompt: number;
        readonly completion: number;
        readonly total: number;
      };
    }
  | {
      readonly kind: "tool_start";
      readonly turn: number;
      readonly toolCallId: string;
      readonly name: string;
      readonly arguments: Record<string, unknown>;
      readonly coordination?: boolean;
    }
  | {
      readonly kind: "tool_end";
      readonly turn: number;
      readonly toolCallId: string;
      readonly name: string;
      readonly ok: boolean;
      readonly output: string;
      readonly coordination?: boolean;
    }
  | {
      readonly kind: "turn_end";
      readonly turn: number;
      readonly elapsedMs: number;
      readonly lastAction: string;
    }
  | {
      readonly kind: "error";
      readonly turn: number;
      readonly phase: "configuration" | "llm" | "tool" | "perceive" | "available_actions";
      readonly message: string;
      readonly retryable: boolean;
      readonly detail?: string;
    }
  | {
      readonly kind: "control_verdict";
      readonly turn: number;
      readonly verdict: ControlVerdictWire;
    }
  | {
      readonly kind: "ask_user";
      readonly turn: number;
      readonly question: string;
      readonly options?: readonly string[];
    }
  | {
      readonly kind: "diagnostic";
      readonly turn: number;
      readonly phase:
        "configuration" | "llm" | "tool" | "perceive" | "available_actions" | "stream";
      readonly message: string;
      readonly detail?: string;
    };

export interface ToolCallWire {
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
}

export type ControlVerdictKindWire =
  "DONE" | "CONTINUE" | "VERIFY" | "ASK_USER" | "REPLAN" | "STALLED";

export interface ControlVerdictWire {
  readonly kind: ControlVerdictKindWire;
  readonly reason?: string;
  readonly audit?: TerminationAuditWire;
  readonly missingEvidence?: readonly string[];
  readonly options?: readonly string[];
}

export interface TerminationAuditWire {
  readonly H: number;
  readonly C: number;
  readonly U: number;
  readonly VOCstar: number;
  readonly residual: readonly string[];
  readonly criterionEvals: readonly CriterionEvalWire[];
  readonly decisionChain: readonly string[];
}

export interface CriterionEvalWire {
  readonly id: string;
  readonly satisfied: boolean;
  readonly weight: number;
  readonly rho?: number;
  readonly kind: "hard" | "soft";
}

/** Server pushes when a side-effecting tool needs a human (ADR-0016 tiers). */
export interface ApprovalRequestEvent {
  readonly type: "approval_request";
  readonly toolCallId: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
  /** ADR-0016 tool execution tier; "read" never asks. */
  readonly tier: string;
}

export interface AgentEventEnvelope {
  readonly type: "agent_event";
  readonly event: AgentEventWire;
}

export interface ClusterEventEnvelope {
  readonly type: "cluster_event";
  readonly event: ClusterEventWire;
}

/** Wire shape of a `ClusterEvent` from `@cantilune/boot`. */
export type ClusterEventWire =
  | { readonly kind: "agent_started"; readonly actorId: string }
  | { readonly kind: "agent_done"; readonly actorId: string; readonly summary: string }
  | { readonly kind: "agent_stale"; readonly actorId: string; readonly lastHeartbeatMs: number }
  | { readonly kind: "agent_retired"; readonly actorId: string }
  | { readonly kind: "condition_met"; readonly actorId: string }
  | { readonly kind: "heartbeat_received"; readonly actorId: string; readonly seq: number }
  | { readonly kind: "agent_queued"; readonly actorId: string; readonly priority: number }
  | { readonly kind: "manifest_unresolved"; readonly actorId: string; readonly detail: string }
  | { readonly kind: "swarm_stalled"; readonly detail: string }
  | {
      readonly kind: "budget_exhausted";
      readonly limit: "agents" | "turns" | "wallClock";
      readonly detail: string;
    }
  | { readonly kind: "cluster_complete" };

/** One agent in the swarm status. */
export interface SwarmAgentWire {
  readonly id: string;
  readonly status: string;
  readonly heartbeat: unknown;
}

/** Wire shape of `SwarmControllerStatus` (the full swarm projection). */
export interface SwarmStatusWire {
  readonly running: boolean;
  readonly agents: readonly SwarmAgentWire[];
  readonly events: readonly {
    readonly kind: ClusterEventWire["kind"];
    readonly actorId?: string;
    readonly lastHeartbeatMs?: number;
    readonly seq?: number;
    readonly summary?: string;
    readonly timestamp: number;
  }[];
  readonly scheduler?: {
    readonly running: number;
    readonly pendingCount: number;
    readonly startedTotal: number;
    readonly completedTotal: number;
    readonly consumedTurns: number;
    readonly saturated: boolean;
    readonly stallTicks: number;
  };
}

export interface SwarmStatusEvent {
  readonly type: "swarm:status";
  readonly status: SwarmStatusWire;
}

export interface RunResultEvent {
  readonly type: "run_result";
  readonly ok: boolean;
  readonly summary: string;
  readonly turns: number;
  readonly elapsedMs: number;
  readonly producedRefs: readonly string[];
  readonly terminationReason?:
    "done" | "controller" | "max_turns" | "max_time" | "aborted" | "error";
  readonly operations: { readonly committed: number; readonly rejected: number };
  readonly toolCalls: {
    readonly total: number;
    readonly succeeded: number;
    readonly failed: number;
    readonly unresolved: number;
  };
  readonly error?: {
    readonly phase: string;
    readonly message: string;
    readonly retryable: boolean;
  };
}

export interface WorldSnapshotEvent {
  readonly type: "world";
  readonly snapshot: WorldSnapshotWire;
}

export interface WorldSnapshotWire {
  readonly snapshotRef: string;
  readonly epochId: string;
  readonly participants: readonly {
    readonly id: string;
    readonly kind: string;
    readonly status: string;
  }[];
  readonly artifacts: readonly {
    readonly id: string;
    readonly kind: string;
    readonly lifecycle: string;
    readonly contentRef: string;
  }[];
  readonly sessions: readonly {
    readonly id: string;
    readonly initiator: string;
    readonly status: string;
  }[];
  readonly capabilities: readonly {
    readonly id: string;
    readonly kind: string;
    readonly holder: string;
  }[];
  readonly links: readonly { readonly from: string; readonly to: string; readonly kind: string }[];
  readonly auditTail: readonly {
    readonly source: string;
    readonly payloadRef: string;
    readonly timestamp: string;
  }[];
  readonly retired: readonly {
    readonly id: string;
    readonly kind: string;
    readonly retiredAt: string;
  }[];
}

export interface ReadyEvent {
  readonly type: "ready";
  readonly providers: readonly {
    readonly slug: string;
    readonly tier: string;
    readonly defaultBaseUrl: string;
    readonly envKeyName: string;
  }[];
}

/** Sent only after the server has successfully built the configured runtime. */
export interface ConfiguredEvent {
  readonly type: "configured";
  readonly provider: string;
  readonly model: string;
}

export interface ErrorResponse {
  readonly type: "error";
  /** Which operation failed; only configuration failure invalidates the runtime. */
  readonly scope: "configuration" | "run" | "workspace" | "swarm" | "transport";
  readonly message: string;
}

export interface WorkspacePickedEvent {
  readonly type: "workspacePicked";
  readonly path?: string;
}

export type ServerMessage =
  | ReadyEvent
  | ConfiguredEvent
  | AgentEventEnvelope
  | ApprovalRequestEvent
  | ClusterEventEnvelope
  | SwarmStatusEvent
  | RunResultEvent
  | WorldSnapshotEvent
  | WorkspacePickedEvent
  | ErrorResponse;
