/**
 * Remote agent handle (ADR-0019 S4): supervisor does not run the LLM loop
 * locally. Liveness is observed from the shared world; abort signals E-Stop
 * via the agent's CommsServices (caller stops the pump separately).
 */
import type { ActorId } from "@cantilune/core";
import type { RunResult } from "../types.js";
import type { SwarmAgentHandle } from "./clusterTypes.js";
import type { MeshHostEntry } from "./meshHostDirectory.js";

export interface RemoteAgentHandleConfig {
  readonly actorId: ActorId;
  readonly hostEntry: MeshHostEntry;
  /** Called when the supervisor wants the remote worker to stop. */
  readonly onAbort?: () => void;
}

export class RemoteAgentHandle implements SwarmAgentHandle {
  private running = false;
  private resolveStart: ((result: RunResult) => void) | undefined;
  private readonly onAbort: (() => void) | undefined;

  constructor(private readonly config: RemoteAgentHandleConfig) {
    this.onAbort = config.onAbort;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get hostEntry(): MeshHostEntry {
    return this.config.hostEntry;
  }

  async start(): Promise<RunResult> {
    if (this.running) {
      throw new Error(`Remote agent ${this.config.actorId as string} already started`);
    }
    this.running = true;
    // Completes when the supervisor observes signal_done / retire in the world
    // and calls completeFromWorld — or when abort() fires.
    return new Promise<RunResult>((resolve) => {
      this.resolveStart = resolve;
    });
  }

  abort(): void {
    if (!this.running) return;
    this.running = false;
    this.onAbort?.();
    this.resolveStart?.({
      ok: false,
      summary: `Remote agent ${this.config.actorId as string} aborted by supervisor`,
      turns: 0,
      elapsedMs: 0,
      producedRefs: [],
      terminationReason: "aborted",
      operations: { committed: 0, rejected: 0 },
    });
    this.resolveStart = undefined;
  }

  /** Resolve start() when the world shows the remote agent completed. */
  completeFromWorld(result: RunResult): void {
    if (!this.running) return;
    this.running = false;
    this.resolveStart?.(result);
    this.resolveStart = undefined;
  }
}
