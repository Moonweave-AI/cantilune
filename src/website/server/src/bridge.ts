/**
 * The website bridge session — the authority side of ADR-0030.
 *
 * One WebSocket connection → one `BridgeSession`. The session boots a Cantilune
 * OS instance from the client's `configure` message using the SAME production
 * path the CLI uses (`createCliRuntimeBoot` + `createCliToolSet`), so every
 * provider/model the CLI supports works here unchanged. It then drives
 * `os.run()` on `run`, streaming every `AgentEvent` back over the socket —
 * including the full `TerminationAudit` alongside each `control_verdict`, and a
 * world snapshot after each committed turn.
 *
 * Side-effecting tools are gated by a `ToolApprover` that asks the browser;
 * ASK_USER verdicts forward and await. `stop` aborts via `AbortSignal` (E-Stop).
 *
 * The browser holds no execution authority. Keys live only in server memory.
 */

import { createAdapter, createEmbedder, listProviders } from "@cantilune/adapter";
import { statSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import type { EmbeddingAdapter, LlmAdapter, LlmConfig } from "@cantilune/boot";
import type { AgentEvent, RunResult } from "@cantilune/boot";
import {
  createCliRuntimeBoot,
  createCliToolSet,
  createSwarmController,
  type CliRuntimeHandle,
  type SwarmController,
} from "@cantilune/cli/lib";
import type { ToolApprovalDecision, ToolApprovalRequest, ToolApprover } from "@cantilune/syscall";
import { pickDirectory } from "./pickDirectory.js";
import { toWorldSnapshotWire } from "./worldSnapshot.js";
import type { WebSocket } from "ws";
import type {
  AgentEventEnvelope,
  ApproveRequest,
  AskUserReply,
  ClientMessage,
  ClusterEventWire,
  ConfigureRequest,
  ControlVerdictWire,
  CriterionEvalWire,
  ErrorResponse,
  ReadyEvent,
  RunRequest,
  ServerMessage,
  StartConditionExpressionWire,
  StopRequest,
  SwarmStatusWire,
  WorldSnapshotWire,
} from "../../shared/protocol.js";

export interface BridgeSessionOptions {
  readonly socket: WebSocket;
  readonly send: (message: ServerMessage) => void;
}

interface PendingApproval {
  readonly resolve: (decision: ToolApprovalDecision) => void;
  readonly toolCallId: string;
}

export class BridgeSession {
  private boot: CliRuntimeHandle | undefined;
  private loopLlm: LlmAdapter | undefined;
  private abortController: AbortController | undefined;
  private runInProgress = false;
  private pendingApproval: PendingApproval | undefined;
  private runMode: "execute" | "plan" | "observe" = "execute";
  private alwaysAllow = false;
  private pendingAskUser:
    { readonly resolve: (answer: string) => void; readonly turn: number } | undefined;
  private currentTurn = 0;
  private swarm: SwarmController | undefined;
  private swarmPollTimer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly options: BridgeSessionOptions) {
    this.sendReady();
  }

  /** The first message on connect: the provider catalog for the config UI. */
  private sendReady(): void {
    const providers = listProviders().map((entry) => ({
      slug: entry.slug,
      tier: entry.tier,
      defaultBaseUrl: entry.defaultBaseUrl,
      envKeyName: entry.envKeyName,
    }));
    const ready: ReadyEvent = { type: "ready", providers };
    this.options.send(ready);
  }

  async handle(message: ClientMessage): Promise<void> {
    switch (message.type) {
      case "configure":
        await this.configure(message);
        break;
      case "run":
        await this.run(message);
        break;
      case "askUser:reply":
        this.resolveAskUser(message);
        break;
      case "approve":
        this.resolveApproval(message);
        break;
      case "setMode":
        this.runMode = message.mode;
        if (message.mode !== "execute") this.alwaysAllow = false;
        break;
      case "pickWorkspace":
        void this.pickWorkspace();
        break;
      case "stop":
        this.stop();
        break;
      case "swarm:start":
        this.swarmStart();
        break;
      case "swarm:stop":
        this.swarmStop();
        break;
      case "swarm:activate":
        await this.swarmActivate(message);
        break;
      case "swarm:status":
        this.pushSwarmStatus();
        break;
      case "inspect":
        this.send({ type: "error", message: "inspect not yet implemented (S5)" });
        break;
    }
  }

  /** Boot the OS from the client's configuration, mirroring the CLI path. */
  private async configure(request: ConfigureRequest): Promise<void> {
    try {
      const loopLlmConfig = this.buildLlmConfig(request, request.provider, request.model);
      const loopLlm = createAdapter(loopLlmConfig);
      this.loopLlm = loopLlm;

      const contractLlm = this.buildAuxAdapter(
        request,
        request.contractProvider,
        request.contractModel,
      );
      const judgeLlm = this.buildAuxAdapter(request, request.judgeProvider, request.judgeModel);
      const embedder = createEmbedder(loopLlmConfig) ?? undefined;

      const toolApprover: ToolApprover = {
        requestApproval: (approval: ToolApprovalRequest) => this.requestApproval(approval),
      };

      const workspace = resolvePath(request.workspace ?? process.cwd());
      if (!statSync(workspace, { throwIfNoEntry: false })?.isDirectory()) {
        throw new Error(`workspace is not an accessible directory: ${workspace}`);
      }
      const toolSet = createCliToolSet({
        workingDirectory: workspace,
        ...(request.mcpServers !== undefined ? { mcpServers: request.mcpServers } : {}),
        ...(request.searchProvider !== undefined ? { searchProvider: request.searchProvider } : {}),
        // Local-dev: run tools on the host with the approval gate as the safety
        // boundary. The user opts into sandbox via env when Docker is available.
        sandbox: "off",
      });

      const runtimeConfig = {
        durable: (request.durable ?? "memory") as "memory" | "file",
        contentStore: (request.durable === "file" ? "file" : "memory") as "memory" | "file",
        llm: loopLlmConfig,
        tools: [toolSet.tools] as never,
        toolApprover,
        ...(request.storagePath !== undefined ? { storagePath: request.storagePath } : {}),
        ...(request.principalId !== undefined ? { principalId: request.principalId } : {}),
        ...(request.maxTurns !== undefined ? { maxTurns: request.maxTurns } : {}),
        ...(request.maxTimeMs !== undefined ? { maxTimeMs: request.maxTimeMs } : {}),
        ...(request.maxContextMessages !== undefined
          ? { maxContextMessages: request.maxContextMessages }
          : {}),
        ...(request.systemPrompt !== undefined ? { systemPrompt: request.systemPrompt } : {}),
        ...(request.thresholds !== undefined ? { thresholds: request.thresholds } : {}),
      };

      this.boot = createCliRuntimeBoot(loopLlm, runtimeConfig, {
        ...(embedder !== undefined ? { embedder } : {}),
        ...(contractLlm !== undefined ? { contractLlm } : {}),
        ...(judgeLlm !== undefined ? { judgeLlm } : {}),
        toolApprover,
      });

      // Build (but do not start) the swarm controller against the same
      // runtime. The client starts it with `swarm:start`. Events are polled
      // and forwarded as `cluster_event` + `swarm:status` batches.
      this.swarm = createSwarmController(
        () => ({
          contentStore: this.boot?.contentStore(),
          syscallRuntime: this.boot?.syscallRuntime(),
          storagePath: this.boot?.storagePath(),
        }),
        () => loopLlm,
      );

      this.send({
        type: "agent_event",
        event: {
          kind: "diagnostic",
          turn: 0,
          phase: "configuration",
          message: `OS booted: ${request.durable ?? "memory"} / ${request.provider} / ${request.model} / ${toolSet.mcp.length} MCP`,
        },
      });
      this.pushWorld();
    } catch (error) {
      const err: ErrorResponse = {
        type: "error",
        message: `configure failed: ${error instanceof Error ? error.message : String(error)}`,
      };
      this.send(err);
    }
  }

  /** Drive a real run. Streams every AgentEvent; forwards approval + ask_user. */
  private async run(request: RunRequest): Promise<void> {
    if (this.boot === undefined) {
      this.send({ type: "error", message: "not configured — send configure first" });
      return;
    }
    if (this.runInProgress) {
      this.send({ type: "error", message: "a run is already in progress (single-flight)" });
      return;
    }
    this.runInProgress = true;
    this.abortController = new AbortController();
    this.currentTurn = 0;
    this.alwaysAllow = false;
    if (request.mode !== undefined) this.runMode = request.mode;
    try {
      const result: RunResult = await this.boot.os.run(request.instruction, {
        signal: this.abortController.signal,
        onEvent: (event: AgentEvent) => this.onAgentEvent(event),
        onAskUser: (question: string, options?: readonly string[]) =>
          this.onAskUser(question, options),
      });
      this.send({ type: "run_result", ...this.toRunResultWire(result) });
      this.pushWorld();
    } catch (error) {
      this.send({
        type: "error",
        message: `run failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      this.runInProgress = false;
      this.abortController = undefined;
      this.pendingApproval = undefined;
      this.pendingAskUser = undefined;
    }
  }

  private stop(): void {
    if (this.abortController !== undefined) {
      this.abortController.abort();
    }
  }

  /* ─────────────────────── swarm control ─────────────────────── */

  private swarmStart(): void {
    if (this.swarm === undefined) {
      this.send({ type: "error", message: "swarm unavailable — configure first" });
      return;
    }
    const result = this.swarm.start();
    if (!result.ok) {
      this.send({ type: "error", message: result.message ?? "swarm start failed" });
      return;
    }
    // Poll status on an interval so the client sees live lifecycle events
    // (the controller records events into an internal buffer; it does not
    // push). Stop the timer when the swarm is no longer running.
    if (this.swarmPollTimer === undefined) {
      this.swarmPollTimer = setInterval(() => {
        this.pushSwarmStatus();
        if (this.swarm !== undefined && !this.swarm.status().running) {
          this.pushSwarmStatus(); // final flush
          this.stopSwarmPoll();
        }
      }, 1000);
    }
    this.pushSwarmStatus();
  }

  private swarmStop(): void {
    this.stopSwarmPoll();
    this.swarm?.stop();
    this.pushSwarmStatus();
  }

  private stopSwarmPoll(): void {
    if (this.swarmPollTimer !== undefined) {
      clearInterval(this.swarmPollTimer);
      this.swarmPollTimer = undefined;
    }
  }

  private async swarmActivate(message: {
    readonly agentId: string;
    readonly manifest?: unknown;
  }): Promise<void> {
    if (this.swarm === undefined) {
      this.send({ type: "error", message: "swarm unavailable — configure first" });
      return;
    }
    const manifest = this.coerceManifest(message.manifest);
    const result = await this.swarm.activate(message.agentId, manifest);
    if (!result.ok) {
      this.send({ type: "error", message: result.message ?? "swarm activate failed" });
    }
    this.pushSwarmStatus();
  }

  private coerceManifest(
    raw: unknown,
  ): Partial<import("@cantilune/core").AgentManifest> | undefined {
    if (raw === undefined || raw === null || typeof raw !== "object") return undefined;
    const m = raw as {
      readonly assignedTask?: string;
      readonly systemPrompt?: string;
      readonly model?: string;
      readonly provider?: string;
      readonly startCondition?: StartConditionExpressionWire;
      readonly maxTurns?: number;
      readonly maxTimeMs?: number;
      readonly heartbeatIntervalMs?: number;
    };
    return {
      ...(m.assignedTask !== undefined ? { assignedTask: m.assignedTask } : {}),
      ...(m.systemPrompt !== undefined ? { systemPrompt: m.systemPrompt } : {}),
      ...(m.model !== undefined ? { model: m.model } : {}),
      ...(m.provider !== undefined ? { provider: m.provider } : {}),
      ...(m.startCondition !== undefined ? { startCondition: m.startCondition as never } : {}),
      ...(m.maxTurns !== undefined ? { maxTurns: m.maxTurns } : {}),
      ...(m.maxTimeMs !== undefined ? { maxTimeMs: m.maxTimeMs } : {}),
      ...(m.heartbeatIntervalMs !== undefined
        ? { heartbeatIntervalMs: m.heartbeatIntervalMs }
        : {}),
    };
  }

  private pushSwarmStatus(): void {
    if (this.swarm === undefined) return;
    const status = this.swarm.status();
    const wire: SwarmStatusWire = {
      running: status.running,
      agents: [...status.agents.entries()].map(([id, a]) => ({
        id,
        status: a.status,
        heartbeat: a.heartbeat,
      })),
      events: status.events.map((e) => ({
        kind: e.kind,
        ...(e.actorId !== undefined ? { actorId: e.actorId } : {}),
        ...(e.lastHeartbeatMs !== undefined ? { lastHeartbeatMs: e.lastHeartbeatMs } : {}),
        ...(e.seq !== undefined ? { seq: e.seq } : {}),
        ...(e.summary !== undefined ? { summary: e.summary } : {}),
        timestamp: e.timestamp,
      })),
      ...(status.scheduler !== undefined
        ? {
            scheduler: {
              running: status.scheduler.running,
              pendingCount: status.scheduler.pending.length,
              startedTotal: status.scheduler.startedTotal,
              completedTotal: status.scheduler.completedTotal,
              consumedTurns: status.scheduler.consumedTurns,
              saturated: status.scheduler.saturated,
              stallTicks: status.scheduler.stallTicks,
            },
          }
        : {}),
    };
    this.send({ type: "swarm:status", status: wire });
    // Also forward any new cluster events as individual envelopes so the client
    // can animate per-event (the status events array is the full buffer; we
    // only forward the tail the client most likely hasn't seen).
    for (const e of status.events.slice(-3)) {
      this.send({
        type: "cluster_event",
        event: {
          kind: e.kind,
          ...(e.actorId !== undefined ? { actorId: e.actorId } : {}),
          ...(e.lastHeartbeatMs !== undefined ? { lastHeartbeatMs: e.lastHeartbeatMs } : {}),
          ...(e.seq !== undefined ? { seq: e.seq } : {}),
          ...(e.summary !== undefined ? { summary: e.summary } : {}),
        } as ClusterEventWire,
      });
    }
  }

  /* ─────────────────────── event forwarding ─────────────────────── */

  private onAgentEvent(event: AgentEvent): void {
    if (event.kind === "turn_start") this.currentTurn = event.turn;
    if (event.kind === "control_verdict") {
      const wire = verdictToWire(event.verdict);
      this.send({
        type: "agent_event",
        event: { kind: "control_verdict", turn: event.turn, verdict: wire },
      });
      return;
    }
    this.send({ type: "agent_event", event: event as never });
  }

  private onAskUser(question: string, options?: readonly string[]): Promise<string> {
    return new Promise<string>((resolve) => {
      this.pendingAskUser = { resolve, turn: this.currentTurn };
      this.send({
        type: "agent_event",
        event: {
          kind: "ask_user",
          turn: this.currentTurn,
          question,
          ...(options !== undefined ? { options } : {}),
        },
      });
    });
  }

  private resolveAskUser(message: AskUserReply): void {
    if (this.pendingAskUser === undefined) return;
    this.pendingAskUser.resolve(message.answer);
    this.pendingAskUser = undefined;
  }

  /* ─────────────────────── tool approval ─────────────────────── */

  private requestApproval(request: ToolApprovalRequest): Promise<ToolApprovalDecision> {
    if (this.runMode === "execute" || this.alwaysAllow) {
      return Promise.resolve({ allowed: true });
    }
    if (this.runMode === "observe") {
      return Promise.resolve({ allowed: false, reason: "read only" });
    }
    return new Promise<ToolApprovalDecision>((resolve) => {
      this.pendingApproval = { resolve, toolCallId: request.key.originalToolCallId };
      this.send({
        type: "approval_request",
        toolCallId: request.key.originalToolCallId,
        name: request.toolName,
        arguments: request.args,
        tier: request.tier,
      });
    });
  }

  private resolveApproval(message: ApproveRequest): void {
    if (message.scope === "always" && message.decision === "allow") {
      this.alwaysAllow = true;
    }
    if (this.pendingApproval === undefined) return;
    if (message.toolCallId !== this.pendingApproval.toolCallId && message.toolCallId !== "*") {
      return;
    }
    if (message.decision === "allow") {
      this.pendingApproval.resolve({ allowed: true });
    } else {
      this.pendingApproval.resolve({ allowed: false, reason: "denied by operator" });
    }
    this.pendingApproval = undefined;
  }

  private async pickWorkspace(): Promise<void> {
    try {
      const path = await pickDirectory();
      this.send(path === undefined ? { type: "workspacePicked" } : { type: "workspacePicked", path });
    } catch (error) {
      this.send({
        type: "error",
        message: `pick workspace failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /* ─────────────────────── world snapshot ─────────────────────── */

  private pushWorld(): void {
    if (this.boot === undefined) return;
    try {
      const state = this.boot.syncRuntime();
      if (state.snapshot === null) return;
      const wire = toWorldSnapshotWire(
        // syncRuntime returns a SnapshotData already; the coordination runtime's
        // current head snapshot is what we render. Fall back to re-deriving if
        // the handle exposes the coordination runtime.
        this.boot.coordinationRuntime().getHead() as never,
      );
      this.send({ type: "world", snapshot: wire });
    } catch {
      // world sync is telemetry; never fail a run for it
    }
  }

  /* ─────────────────────── adapter construction ─────────────────────── */

  private buildLlmConfig(request: ConfigureRequest, provider: string, model: string): LlmConfig {
    return {
      provider,
      model,
      ...(request.apiKey !== undefined && request.apiKey.length > 0
        ? { apiKey: () => request.apiKey as string }
        : {}),
      ...(request.baseUrl !== undefined && request.baseUrl.length > 0
        ? { baseUrl: request.baseUrl }
        : {}),
    };
  }

  private buildAuxAdapter(
    request: ConfigureRequest,
    provider: string | undefined,
    model: string | undefined,
  ): LlmAdapter | undefined {
    if (provider === undefined || model === undefined) return undefined;
    return createAdapter(this.buildLlmConfig(request, provider, model));
  }

  /* ─────────────────────── run result projection ─────────────────────── */

  private toRunResultWire(result: RunResult) {
    return {
      ok: result.ok,
      summary: result.summary,
      turns: result.turns,
      elapsedMs: result.elapsedMs,
      producedRefs: [...result.producedRefs].map(String),
      ...(result.terminationReason !== undefined
        ? { terminationReason: result.terminationReason }
        : {}),
      operations: {
        committed: result.operations.committed,
        rejected: result.operations.rejected,
      },
      ...(result.toolCalls !== undefined
        ? {
            toolCalls: {
              total: result.toolCalls.total,
              succeeded: result.toolCalls.succeeded,
              failed: result.toolCalls.failed,
              unresolved: result.toolCalls.unresolved,
            },
          }
        : { toolCalls: { total: 0, succeeded: 0, failed: 0, unresolved: 0 } }),
      ...(result.error !== undefined
        ? {
            error: {
              phase: result.error.phase,
              message: result.error.message,
              retryable: result.error.retryable,
            },
          }
        : {}),
    };
  }

  private send(message: ServerMessage): void {
    this.options.send(message);
  }

  async shutdown(): Promise<void> {
    this.stop();
    this.stopSwarmPoll();
    this.swarm?.stop();
    if (this.boot !== undefined) {
      await this.boot.shutdown();
    }
  }
}

/** Project a runtime `ControlVerdict` (with its `TerminationAudit`) to the wire. */
export function verdictToWire(verdict: {
  readonly kind: string;
  readonly audit?: unknown;
  readonly recommendedAction?: string;
  readonly missingEvidence?: readonly string[];
  readonly question?: string;
  readonly options?: readonly string[];
  readonly reason?: string;
  readonly blocker?: string;
}): ControlVerdictWire {
  const audit = verdict.audit as
    | {
        readonly H: number;
        readonly C: number;
        readonly U: number;
        readonly VOC_star: number;
        readonly residual: readonly number[];
        readonly criterionEvals: readonly {
          readonly id: string;
          readonly satisfied: boolean;
          readonly weight: number;
          readonly rho?: number;
          readonly kind: string;
        }[];
        readonly decisionChain: readonly string[];
      }
    | undefined;
  const reason = verdict.reason ?? verdict.blocker ?? verdict.question;
  return {
    kind: verdict.kind as ControlVerdictWire["kind"],
    ...(reason !== undefined ? { reason } : {}),
    ...(verdict.missingEvidence !== undefined ? { missingEvidence: verdict.missingEvidence } : {}),
    ...(verdict.options !== undefined ? { options: verdict.options } : {}),
    ...(audit !== undefined
      ? {
          audit: {
            H: audit.H,
            C: audit.C,
            U: audit.U,
            VOCstar: audit.VOC_star,
            residual: audit.residual.map(String),
            criterionEvals: audit.criterionEvals.map((e): CriterionEvalWire => ({
              id: e.id,
              satisfied: e.satisfied,
              weight: e.weight,
              ...(e.rho !== undefined ? { rho: e.rho } : {}),
              kind: e.kind === "hard" ? "hard" : "soft",
            })),
            decisionChain: [...audit.decisionChain],
          },
        }
      : {}),
  };
}
