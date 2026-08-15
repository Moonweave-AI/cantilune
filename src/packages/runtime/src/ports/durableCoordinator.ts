import type {
  ChangeId,
  CollaborationSnapshot,
  CoordinationChange,
  SchemaEpochBinding,
  SnapshotRef,
} from "@cantilune/core";
import type { ReplayRecipe } from "../replay/recipe.js";

export interface DurableCommitInput {
  readonly expectedHead: SnapshotRef;
  readonly after: CollaborationSnapshot;
  readonly change: CoordinationChange;
  readonly recipe: ReplayRecipe;
  readonly idempotencyKey?: ChangeId;
}

export type DurableCommitResult =
  { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * Single transactional boundary for snapshot head, changelog, and replay
 * recipe sidecar. Since ADR-0014 it also carries the active schema epoch
 * binding, so a crash after an epoch head CAS is recoverable from the bundle.
 */
export interface DurableCoordinator {
  get(ref: SnapshotRef): CollaborationSnapshot | undefined;
  head(): SnapshotRef | undefined;
  /** Active schema epoch binding for the current head, or undefined for a legacy/unbound world. */
  activeBinding(): SchemaEpochBinding | undefined;
  compareAndSwapHead(expected: SnapshotRef, snapshot: CollaborationSnapshot): boolean;
  /**
   * Atomically advance the head and replace the active binding in the same
   * durable transaction. Returns false if the head CAS fails (binding is
   * left unchanged). Used only by epoch transition commit.
   */
  compareAndSwapHeadWithBinding(
    expected: SnapshotRef,
    snapshot: CollaborationSnapshot,
    binding: SchemaEpochBinding,
  ): boolean;
  commit(input: DurableCommitInput): DurableCommitResult;
  changes(): readonly CoordinationChange[];
  since(fromRef: SnapshotRef): readonly CoordinationChange[];
  recipeForChange(change: CoordinationChange): ReplayRecipe | undefined;
}
