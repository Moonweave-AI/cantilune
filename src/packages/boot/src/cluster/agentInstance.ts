/**
 * AgentInstance — encapsulates a single agent's lifecycle within a cluster.
 *
 * Each instance owns:
 * - A private LLM message history
 * - A heartbeat timer (active liveness emission)
 * - An abort controller for lifecycle management
 * - A reference to its assigned manifest
 */
import type { ActorId, AgentManifest } from "@cantilune/core";
import type { Syscall } from "@cantilune/syscall";
import type { LlmAdapter, RunResult } from "../types.js";
import type { SharedResources } from "./sharedResources.js";
import { runAgentLoop } from "../agentLoop.js";
import { createTerminationController } from "../termination/index.js";

export interface AgentInstanceConfig {
  readonly actorId: ActorId;
  readonly manifest: AgentManifest;
  readonly llmAdapter: LlmAdapter;
  readonly syscall: Syscall;
  readonly shared: SharedResources;
  /**
   * Dedicated LLM adapter for goal-contract compilation. The contract compiler
   * must not share the loop's adapter: a shared adapter consumes one of the
   * loop's LLM calls and shifts every scripted response sequence. When absent
   * the controller compiles the default system contract with no LLM call.
   */
  readonly contractLlm?: LlmAdapter;
}

export class AgentInstance {
  readonly actorId: ActorId;
  readonly manifest: AgentManifest;

  private readonly llmAdapter: LlmAdapter;
  private readonly contractLlm: LlmAdapter | undefined;
  private readonly syscall: Syscall;
  private readonly shared: SharedResources;
  private readonly abortController = new AbortController();

  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private turns = 0;
  private lastAction = "init";
  private runPromise: Promise<RunResult> | undefined;

  constructor(config: AgentInstanceConfig) {
    this.actorId = config.actorId;
    this.manifest = config.manifest;
    this.llmAdapter = config.llmAdapter;
    this.contractLlm = config.contractLlm;
    this.syscall = config.syscall;
    this.shared = config.shared;
  }

  /** Start the agent loop + heartbeat timer. Returns the run promise. */
  start(): Promise<RunResult> {
    this.startHeartbeatTimer();
    this.runPromise = this.executeLoop();
    return this.runPromise;
  }

  /** Abort the agent loop. */
  abort(): void {
    this.abortController.abort();
    this.stopHeartbeatTimer();
  }

  /** Check if this agent is still running. */
  get isRunning(): boolean {
    return this.runPromise !== undefined && !this.abortController.signal.aborted;
  }

  private startHeartbeatTimer(): void {
    const intervalMs = this.manifest.heartbeatIntervalMs;
    this.heartbeatTimer = setInterval(() => {
      void this.emitHeartbeat();
    }, intervalMs);
  }

  private stopHeartbeatTimer(): void {
    if (this.heartbeatTimer !== undefined) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private async emitHeartbeat(): Promise<void> {
    let result: Awaited<ReturnType<Syscall["act"]>>;
    try {
      result = await this.syscall.act({
        operation: "emit_heartbeat",
        args: {
          from: this.actorId as string,
          turnCount: String(this.turns),
          lastAction: this.lastAction,
        },
      });
    } catch {
      // A transport exception is transient; the next timer tick can retry.
      return;
    }

    try {
      if (result.ok !== true) {
        this.abort();
      }
    } catch {
      // A malformed structured result is not a transient transport failure.
      this.abort();
    }
  }

  private async executeLoop(): Promise<RunResult> {
    const terminationController = createTerminationController(
      this.contractLlm === undefined ? {} : { llm: this.contractLlm },
    );

    const systemPrompt = this.buildAgentSystemPrompt();

    try {
      const result = await runAgentLoop(
        this.syscall,
        this.llmAdapter,
        this.manifest.assignedTask,
        terminationController,
        {
          maxTurns: this.manifest.maxTurns ?? 100,
          maxTimeMs: this.manifest.maxTimeMs ?? 600_000,
          maxContextMessages: 40,
          systemPrompt,
        },
        {
          signal: this.abortController.signal,
          onProgress: (event) => {
            this.turns = event.turn;
            this.lastAction = event.lastAction;
          },
        },
      );
      return result;
    } finally {
      this.stopHeartbeatTimer();
    }
  }

  private buildAgentSystemPrompt(): string {
    return [
      this.manifest.systemPrompt,
      "",
      "## Experimental Cluster Boundary",
      "- Use only tools that are actually present in the current tool schema.",
      "- `register_participant` records a participant; it does not itself launch a process.",
      "- Finish the local Agent loop with `done`; local completion does not imply a shared-world lifecycle transition.",
      "- Heartbeats are attempted automatically; do not infer acceptance without a committed world record.",
    ].join("\n");
  }
}
