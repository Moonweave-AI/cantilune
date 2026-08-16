import type {
  CollaborationSnapshot,
  CoordinationChange,
  SchemaEpochBinding,
  SnapshotRef,
} from "@cantilune/core";
import { snapshotSchemaEpochBinding } from "../engine/activeSchemaContext.js";
import { changeContinuesChain, isVerifiableUnloggedAdvance } from "../codec/observationBridge.js";
import type { DurableCommitInput, DurableCoordinator } from "../ports/durableCoordinator.js";
import { MemoryChangeLog } from "./memoryChangeLog.js";
import { MemoryCollaborationStore } from "./memoryStore.js";
import { RecipeSidecar } from "../replay/recipeSidecar.js";

export class MemoryDurableCoordinator implements DurableCoordinator {
  private activeBindingValue: SchemaEpochBinding | undefined;

  constructor(
    private readonly store: MemoryCollaborationStore,
    private readonly changelog: MemoryChangeLog,
    private readonly sidecar: RecipeSidecar,
    initialBinding?: SchemaEpochBinding | undefined,
  ) {
    this.activeBindingValue =
      initialBinding === undefined ? undefined : snapshotSchemaEpochBinding(initialBinding);
  }

  get(ref: SnapshotRef): CollaborationSnapshot | undefined {
    return this.store.get(ref);
  }

  head(): SnapshotRef | undefined {
    return this.store.head();
  }

  activeBinding(): SchemaEpochBinding | undefined {
    return this.activeBindingValue;
  }

  compareAndSwapHead(expected: SnapshotRef, snapshot: CollaborationSnapshot): boolean {
    return this.store.compareAndSwapHead(expected, snapshot);
  }

  /**
   * Atomically advance the head and replace the active binding. Observations
   * and other non-epoch head moves leave the binding unchanged; only an epoch
   * transition calls this so the bundle on disk always carries the binding
   * that matches its head (ADR-0014).
   */
  compareAndSwapHeadWithBinding(
    expected: SnapshotRef,
    snapshot: CollaborationSnapshot,
    binding: SchemaEpochBinding,
  ): boolean {
    if (!this.store.compareAndSwapHead(expected, snapshot)) {
      return false;
    }
    this.activeBindingValue = snapshotSchemaEpochBinding(binding);
    return true;
  }

  commit(input: DurableCommitInput) {
    if (this.store.head() !== input.expectedHead) {
      return { ok: false as const, reason: "head_mismatch" };
    }
    if (this.changelog.all().some((change) => change.changeId === input.change.changeId)) {
      return { ok: false as const, reason: "duplicate_change_id" };
    }
    // An observation between two commits advances the head without writing a
    // change, so the log is not required to be contiguous by raw ref equality;
    // the hop is accepted only if it reproduces as observations alone.
    const last = this.changelog.all().at(-1);
    if (
      last !== undefined &&
      !changeContinuesChain(last, input.change, (ref) => this.store.get(ref))
    ) {
      return { ok: false as const, reason: "chain_broken" };
    }
    if (last === undefined && input.change.beforeRef !== input.expectedHead) {
      return { ok: false as const, reason: "chain_broken" };
    }
    if (!this.store.putIfAbsent(input.after)) {
      return { ok: false as const, reason: "after_ref_collision" };
    }
    if (!this.changelog.append(input.change)) {
      this.store.remove(input.after.snapshotRef);
      return { ok: false as const, reason: "changelog_append_failed" };
    }
    this.sidecar.put(input.change.changeId, input.recipe);
    this.store.setHead(input.after.snapshotRef);
    return { ok: true as const };
  }

  changes(): readonly CoordinationChange[] {
    return this.changelog.all();
  }

  since(fromRef: SnapshotRef): readonly CoordinationChange[] {
    const direct = this.changelog.since(fromRef);
    if (direct.length > 0) {
      return direct;
    }

    // The first business change may follow observations and/or epoch
    // activation, neither of which is represented in ChangeLog. Recover the
    // first logged edge only when the stored before snapshot proves that
    // unlogged advance; then log order provides the remaining suffix.
    const from = this.store.get(fromRef);
    if (from === undefined) {
      return [];
    }
    const all = this.changelog.all();
    const anchor = all.findIndex((change) => change.afterRef === fromRef);
    const startAt = anchor >= 0 ? anchor + 1 : 0;
    const bridgedIndex = all.findIndex((change, index) => {
      if (index < startAt) return false;
      const before = this.store.get(change.beforeRef);
      return before !== undefined && isVerifiableUnloggedAdvance(from, before);
    });
    return bridgedIndex >= 0 ? all.slice(bridgedIndex) : [];
  }

  recipeForChange(change: CoordinationChange) {
    return this.sidecar.recipeForChange(change);
  }
}

export function createMemoryRuntimePersistence(options?: {
  initial?: CollaborationSnapshot;
  initialBinding?: SchemaEpochBinding | undefined;
}): {
  durable: MemoryDurableCoordinator;
  store: MemoryCollaborationStore;
  changelog: MemoryChangeLog;
  sidecar: RecipeSidecar;
} {
  const store = new MemoryCollaborationStore(options);
  const changelog = new MemoryChangeLog();
  const sidecar = new RecipeSidecar();
  const durable = new MemoryDurableCoordinator(store, changelog, sidecar, options?.initialBinding);
  return { durable, store, changelog, sidecar };
}
