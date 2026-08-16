import type { ContentRef, CoordinationChange, OperationTypeId, SnapshotRef } from "@cantilune/core";

/**
 * System call interface: pure translation layer between LLM and Cantilune OS.
 *
 * No strategy, no policy, no decision-making. Just:
 * - serialize OS state → structured text for LLM (perceive)
 * - parse LLM output → runtime operations (act)
 * - read/write content (content)
 * - invoke external tools (tool)
 *
 * All methods are async for forward compatibility (perceive may need to read
 * content in future; availableActions may query remote MCP servers).
 *
 * Environment: Node.js only (inherits from runtime + content).
 */
export interface Syscall {
  /**
   * OS → LLM: serialize current world state into a structured perception.
   * Async to allow future content reading for artifact summaries.
   */
  perceive(): Promise<PerceptionResult>;

  /**
   * LLM → OS: execute an action (coordination intent).
   * Translates LLM's tool_call into admit → commit.
   */
  act(call: ActionCall): Promise<ActionResult>;

  /**
   * OS → LLM: read content by ref.
   */
  readContent(ref: ContentRef): Promise<ReadContentResult>;

  /**
   * LLM → OS: write content, get a ref back.
   */
  writeContent(content: string, options?: WriteContentOptions): Promise<ContentRef>;

  /**
   * LLM → external → OS: invoke an external tool via MCP or similar.
   * Result is stored in content and observed.
   */
  useTool(call: ToolCall): Promise<ToolResult>;

  /**
   * Retry only the runtime observation for a previously executed tool call.
   * The durable recovery receipt is verified before any observation is made;
   * the external tool executor is never invoked by this method.
   */
  retryToolObservation(recovery: ToolObservationRecovery): Promise<ToolObservationRetryResult>;

  /**
   * OS → LLM: available operations the LLM can perform right now.
   * Async to support remote MCP tool discovery.
   */
  availableActions(): Promise<ActionSchema[]>;
}

/**
 * The world as the LLM sees it.
 *
 * The structured fields (epochId, participantCount, artifactCount, auditTailLength)
 * are projections of the same coordination snapshot that `worldSummary` renders to
 * text. They carry no extra data the LLM could not derive from the summary; they
 * exist so deterministic controllers can read the world without parsing prose.
 * All optional and zeroable so existing consumers and empty worlds are unaffected.
 */
export interface PerceptionResult {
  readonly worldSummary: string;
  readonly recentObservations: string;
  readonly availableOperations: readonly OperationTypeId[];
  /**
   * Snapshot ref as plain string for LLM context.
   * This is intentionally string (not branded SnapshotRef) because it's for LLM display.
   */
  readonly headRef: string | undefined;
  /** Epoch id of the perceived snapshot, when a world exists. */
  readonly epochId?: string | undefined;
  /** Number of registered participants in the perceived snapshot. */
  readonly participantCount?: number | undefined;
  /** Number of work artifacts in the perceived snapshot. */
  readonly artifactCount?: number | undefined;
  /** Length of the audit tail in the perceived snapshot. */
  readonly auditTailLength?: number | undefined;
}

/**
 * An action call from the LLM (parsed from tool_call JSON).
 * Args are Record<string, string> for coordination ops (all schema properties are string).
 * For external tools (prefixed with "tool:"), args may contain non-string values.
 */
export interface ActionCall {
  readonly operation: string;
  readonly args: Record<string, string>;
}

export interface ActionResult {
  readonly ok: boolean;
  /** Human-readable result or error message for LLM to read. */
  readonly message: string;
  readonly newHeadRef: string | undefined;
}

export interface ReadContentResult {
  readonly found: boolean;
  readonly text: string | undefined;
  readonly mimeType: string | undefined;
}

export interface WriteContentOptions {
  readonly mimeType?: string;
}

/**
 * External tool invocation request.
 * Args are Record<string, unknown> because external tools have arbitrary schemas.
 */
export interface ToolCall {
  /** Stable id supplied by the LLM tool call. Required for automatic recovery. */
  readonly callId: string;
  readonly toolName: string;
  readonly args: Record<string, unknown>;
  /** Cooperative cancel for the in-flight executor (ADR-0012/0016). */
  readonly signal?: AbortSignal;
}

/** Durable identity of an external-tool output whose audit observation is pending. */
export interface ToolObservationRecovery {
  /** Raw executor tool name (without the `tool:` action prefix). */
  readonly toolName: string;
  readonly originalToolCallId: string;
  /** SHA-256 digest of the canonical JSON tool arguments. */
  readonly argumentsDigest: string;
  readonly outputRef: ContentRef;
  readonly receiptRef: ContentRef;
}

export interface ToolResult {
  readonly ok: boolean;
  readonly output: string;
  readonly contentRef: ContentRef | undefined;
  /** If observe failed after tool execution, contains the warning. */
  readonly observeWarning: string | undefined;
  /** Present only when a stored output can be retried without re-executing the tool. */
  readonly observationRecovery: ToolObservationRecovery | undefined;
  /**
   * Present (as `"ambiguous"`) only when a non-idempotent tool left a
   * `dispatched` journal entry with no durable output, so the run must NOT
   * re-dispatch (ADR-0016). Operators resolve the side effect out of band.
   */
  readonly disposition?: "ambiguous";
}

export interface ToolObservationRetryResult {
  readonly ok: boolean;
  readonly outputRef: ContentRef | undefined;
  readonly message: string;
  readonly observeWarning: string | undefined;
}

/**
 * Schema for one available action — used to generate LLM tool definitions.
 */
export interface ActionSchema {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

/**
 * External tool executor interface (MCP bridge or custom tools).
 *
 * `tier` and `reconcile` are optional exactly-once primitives (ADR-0016). An
 * executor that omits `tier` defaults to the fail-safe Tier 2
 * ("non-idempotent"): after a crash with a dispatched-but-incomplete journal
 * entry the run reports `ambiguous` rather than re-dispatching. An executor
 * that declares `tier: "idempotent"` MUST supply `reconcile`, which the run
 * calls instead of re-executing when it finds a dispatched entry with no
 * durable output.
 */
export interface ToolExecutor {
  execute(
    toolName: string,
    args: Record<string, unknown>,
    options?: { readonly signal?: AbortSignal },
  ): Promise<{ ok: boolean; output: string }>;
  listTools(): Promise<ToolSchema[]>;
  /**
   * Side-effect tier of the tools this executor serves (ADR-0016). Defaults to
   * `"non-idempotent"` when omitted so undeclared tools fail safe. When an
   * executor serves tools of mixed tiers (e.g. a filesystem executor with both
   * read and write tools), set `tier` to the fail-safe default and override per
   * tool via `tierFor`.
   */
  readonly tier?: ToolExecutionTier;
  /**
   * Per-tool tier override (ADR-0016). Resolves the side-effect tier for a
   * specific tool name; takes precedence over `tier` when present. Use this for
   * executors that serve mixed-tier tools (a filesystem executor serving both
   * `read_file` (Tier 0) and `write_file`/`edit_file` (Tier 1/2)). Returns
   * `undefined` to fall back to `tier` (and then to the fail-safe default).
   */
  tierFor?(toolName: string): ToolExecutionTier | undefined;
  /**
   * Outcome query for an idempotent side-effect tool. The run reaches this only
   * when `tier === "idempotent"` and a `dispatched` journal entry exists with no
   * durable output. `reconcile` either returns the prior output (reuse it, do not
   * re-execute) or reports `unknown` (safe to re-dispatch). Required when
   * `tier === "idempotent"`; never called otherwise.
   */
  reconcile?(key: ToolInvocationKey): Promise<ToolReconcileResult>;
}

/**
 * Side-effect tier of an external tool (ADR-0016).
 * - `"read"`: no side effect; a crash at any boundary is closed by re-dispatch.
 * - `"idempotent"`: side effect with an outcome query (`reconcile`).
 * - `"non-idempotent"`: side effect with no outcome query; the run must NOT
 *   re-dispatch after a `dispatched` journal entry with no durable output.
 */
export type ToolExecutionTier = "read" | "idempotent" | "non-idempotent";

/**
 * Stable identity of an external-tool invocation used as the idempotency key
 * (ADR-0016). The tuple matches the integrity contract already used by the
 * observation-recovery receipt, so one key validates both journal and receipt.
 */
export interface ToolInvocationKey {
  /** The principal that owns the invocation (matches the journal principal). */
  readonly principal: { readonly actorId: string; readonly kind: string };
  readonly toolName: string;
  /** SHA-256 digest of the canonical JSON tool arguments. */
  readonly argumentsDigest: string;
  /** The LLM tool-call id the journal was written under. */
  readonly originalToolCallId: string;
}

/** Result of an idempotent executor's outcome query (ADR-0016). */
export type ToolReconcileResult =
  { readonly status: "known"; readonly output: string } | { readonly status: "unknown" };

/** One external-tool invocation presented to a human for authorization. */
export interface ToolApprovalRequest {
  readonly toolName: string;
  /** Canonicalized arguments, so the human sees exactly what will be dispatched. */
  readonly args: Record<string, unknown>;
  readonly tier: ToolExecutionTier;
  readonly key: ToolInvocationKey;
}

export type ToolApprovalDecision =
  { readonly allowed: true } | { readonly allowed: false; readonly reason: string };

/**
 * Human authorization gate for external-tool dispatch.
 *
 * The gate is consulted only for a **fresh** invocation, before the
 * pre-invocation journal entry is written. A recovery path (a `dispatched`
 * entry already exists) never re-asks: the side effect may already have landed,
 * so a denial there would be a decision about the past, not the future, and the
 * ADR-0016 tier rules already govern that case.
 *
 * When no approver is configured every tool dispatches, which preserves the
 * behaviour of every existing embedding.
 */
export interface ToolApprover {
  requestApproval(request: ToolApprovalRequest): Promise<ToolApprovalDecision>;
  /**
   * Tiers that require authorization. Omitted means the fail-safe set: both
   * side-effecting tiers ask, and `read` never does.
   */
  readonly requiresApprovalFor?: readonly ToolExecutionTier[];
}

/** Tiers that ask for authorization when an approver declares no preference. */
export const DEFAULT_APPROVAL_TIERS: readonly ToolExecutionTier[] = [
  "idempotent",
  "non-idempotent",
];

export interface ToolSchema {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

/**
 * Provides the current list of available operations from runtime schema.
 * Allows dynamic updates when control-plane performs epoch transitions.
 */
export interface OperationSchemaProvider {
  getTemplates(): AvailableTemplate[];
}

/** Declares one ordered ContentRef argument exposed in an LLM tool schema. */
export interface ContentRefInputDeclaration {
  readonly name: string;
  readonly description?: string;
  /** Content inputs are required unless explicitly marked optional. */
  readonly required?: boolean;
}

/** Scalar kinds accepted at the string-only LLM coordination boundary. */
export type ScalarInputType = "string" | "nonNegativeInteger";

/**
 * Declares a named inline scalar that is replayed with the operation recipe.
 * Rich or large values must use `contentRefInputs` instead.
 */
export interface ScalarInputDeclaration {
  readonly name: string;
  readonly type: ScalarInputType;
  readonly description?: string;
  /** Scalar inputs are required unless explicitly marked optional. */
  readonly required?: boolean;
}

export interface AvailableTemplate {
  readonly operationTypeId: OperationTypeId;
  readonly description: string;
  readonly requiredRoles: readonly string[];
  /** Ordered separately from entity-role bindings and forwarded as inputContentRefs. */
  readonly contentRefInputs?: readonly ContentRefInputDeclaration[];
  /** Named typed scalars forwarded into the replay recipe, never into ContentRef slots. */
  readonly scalarInputs?: readonly ScalarInputDeclaration[];
}

/**
 * Dependencies needed to construct a Syscall instance.
 */
export interface SyscallDependencies {
  readonly runtime: SyscallRuntime;
  readonly contentStore: SyscallContentStore;
  readonly principal: SyscallPrincipal;
  readonly schemaProvider: OperationSchemaProvider;
  readonly toolExecutor?: ToolExecutor;
  /**
   * Human authorization gate for side-effecting tools. Absent means every tool
   * dispatches unattended, which is the behaviour of every embedding written
   * before this port existed.
   */
  readonly toolApprover?: ToolApprover;
}

/**
 * Minimal runtime interface needed by syscall.
 * Avoids tight coupling to full CoordinationRuntime — only the shape matters.
 */
export interface SyscallRuntime {
  getHead():
    | {
        snapshotRef: unknown;
        epochId: unknown;
        participants: ReadonlyMap<unknown, unknown>;
        artifacts: ReadonlyMap<unknown, unknown>;
        links: ReadonlyMap<unknown, unknown>;
        sessions: ReadonlyMap<unknown, unknown>;
        capabilities: ReadonlyMap<unknown, unknown>;
        auditTail: readonly unknown[];
      }
    | undefined;
  observe(
    input: { source: unknown; payloadRef: unknown },
    options?: { principal?: unknown },
  ): ObserveResult;
  /**
   * Committed-change feed (ADR-0015). Returns every committed change after the
   * given cursor snapshot ref, in commit order; with no cursor, all committed
   * changes. A swarm supervisor consumes this trusted feed instead of polling
   * a snapshot. Syscall itself does not use it; it is exposed so the boot layer
   * can pass the same runtime object to a supervisor without a second handle.
   */
  changes(since?: SnapshotRef): readonly CoordinationChange[];
  proposeAndCommit(intent: unknown, options?: unknown): ProposeResult;
}

export interface ObserveResult {
  readonly ok: boolean;
  readonly message?: string;
}

export type ProposeResult =
  | {
      readonly ok: true;
      /** Snapshot committed by the same authoritative operation receipt. */
      readonly newHeadRef: string;
    }
  | {
      readonly ok: false;
      readonly message?: string;
    };

export interface SyscallContentStore {
  put(
    content: string | Uint8Array,
    options?: { mimeType?: string; createdBy?: string },
  ): Promise<ContentRef>;
  get(ref: ContentRef): Promise<
    | {
        ref: ContentRef;
        bytes: Uint8Array;
        metadata: {
          size: number;
          mimeType: string;
          createdAt: string;
          createdBy: string | undefined;
        };
      }
    | undefined
  >;
  exists(ref: ContentRef): Promise<boolean>;
}

export interface SyscallPrincipal {
  readonly actorId: string;
  readonly kind: string;
}
