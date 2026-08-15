import type { CoordinationChange, Result, SnapshotRef } from "@cantilune/core";

export interface DpoReplayRequest {
  readonly fromSnapshotRef: SnapshotRef;
  readonly toSnapshotRef: SnapshotRef;
  readonly changes: readonly CoordinationChange[];
  readonly recipeRef: string;
}

export interface DpoReplayExecutionResult {
  readonly terminalSnapshotRef: SnapshotRef;
  readonly stepCount: number;
}

export interface DpoReplayFailure {
  readonly code: string;
  readonly message: string;
}

/** Runtime-backed endpoint-free DPO replay — injected via port, not imported directly. */
export interface DpoReplayPort {
  execute(request: DpoReplayRequest): Promise<Result<DpoReplayExecutionResult, DpoReplayFailure>>;
}
