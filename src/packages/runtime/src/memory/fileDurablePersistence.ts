import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  CollaborationSnapshot,
  CoordinationChange,
  SchemaEpochBinding,
  SnapshotRef,
} from "@cantilune/core";
import type {
  DurableCommitInput,
  DurableCommitResult,
  DurableCoordinator,
} from "../ports/durableCoordinator.js";
import type { ReplayRecipe } from "../replay/recipe.js";
import {
  exportDurableBundle,
  importDurableBundleTyped,
  serializeDurableBundle,
  type DurableWireBundle,
} from "./durableBundle.js";
import { atomicWriteFileSync } from "./atomicWrite.js";
import { FileResourceLockTable } from "./fileResourceLockTable.js";
import { withFileLock } from "./fileLock.js";
import { createMemoryRuntimePersistence } from "./memoryDurableCoordinator.js";
import type { MemoryChangeLog } from "./memoryChangeLog.js";
import type { MemoryCollaborationStore } from "./memoryStore.js";
import type { RecipeSidecar } from "../replay/recipeSidecar.js";

const BUNDLE_FILE = "durable.bundle.json";

type MemoryPersistence = ReturnType<typeof createMemoryRuntimePersistence>;

export interface FileRuntimePersistence {
  readonly durable: FileDurableCoordinator;
  readonly store: MemoryCollaborationStore;
  readonly changelog: MemoryChangeLog;
  readonly sidecar: RecipeSidecar;
  readonly t0Ref: SnapshotRef;
  readonly dir: string;
  readonly locks: FileResourceLockTable;
}

export interface FileRuntimePersistenceOptions {
  readonly dir: string;
  readonly initial?: CollaborationSnapshot;
}

/** Immutable identity of one file-backed coordination-world generation. */
export interface FileRuntimeIdentity {
  readonly genesisRef: SnapshotRef;
}

/**
 * Writes only bytes that decode back into the same world.
 *
 * Without this check the store could accept a write it was unable to read: a
 * participant status the encoder emitted but the validator rejected persisted
 * fine, and the next head read — inside the very next operation — threw while
 * parsing the bundle, leaving the durable world permanently unloadable. Failing
 * here instead keeps the last good bundle intact and surfaces the defect at the
 * commit that introduced it.
 */
function writeBundleAtomic(dir: string, bundle: DurableWireBundle): void {
  const payload = JSON.stringify(serializeDurableBundle(bundle));
  try {
    importDurableBundleTyped(JSON.parse(payload) as DurableWireBundle);
  } catch (error) {
    throw new Error(
      `refusing to persist an unreadable durable bundle: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  atomicWriteFileSync(join(dir, BUNDLE_FILE), payload);
}

function readBundle(dir: string): MemoryPersistence & { readonly t0: CollaborationSnapshot } {
  const raw = readFileSync(join(dir, BUNDLE_FILE), "utf8");
  const imported = importDurableBundleTyped(JSON.parse(raw) as DurableWireBundle);
  return {
    durable: imported.durable,
    store: imported.store,
    changelog: imported.changelog,
    sidecar: imported.sidecar,
    t0: imported.t0,
  };
}

/**
 * Read and validate the immutable generation identity of a file-backed world.
 *
 * This is intentionally fail-closed: a missing, unreadable, or invalid bundle
 * has no usable identity. Callers must not infer one from a directory name.
 */
export function readFileRuntimeIdentity(dir: string): FileRuntimeIdentity | undefined {
  try {
    const loaded = readBundle(dir);
    const headRef = loaded.durable.head();
    if (headRef === undefined || loaded.durable.get(headRef) === undefined) return undefined;
    return { genesisRef: loaded.t0.snapshotRef };
  } catch {
    return undefined;
  }
}

/**
 * Read the active schema epoch binding carried atomically with the head, or
 * undefined for a legacy bundle (ADR-0014). A boot layer uses this to restart
 * under the correct epoch after a crash that left the in-memory holders gone
 * but the durable head+binding intact.
 */
export function readFileRuntimeActiveBinding(dir: string): SchemaEpochBinding | undefined {
  try {
    const loaded = readBundle(dir);
    return loaded.durable.activeBinding();
  } catch {
    return undefined;
  }
}

/** File-backed durable: lock + reload + memory commit + atomic bundle write. */
export class FileDurableCoordinator implements DurableCoordinator {
  private memory: MemoryPersistence;
  private readonly t0Ref: SnapshotRef;

  constructor(
    private readonly dir: string,
    memory: MemoryPersistence,
    t0Ref: SnapshotRef,
  ) {
    this.memory = memory;
    this.t0Ref = t0Ref;
  }

  get(ref: SnapshotRef): CollaborationSnapshot | undefined {
    return this.withReload(() => this.memory.durable.get(ref));
  }

  head(): SnapshotRef | undefined {
    return this.withReload(() => this.memory.durable.head());
  }

  activeBinding(): SchemaEpochBinding | undefined {
    return this.withReload(() => this.memory.durable.activeBinding());
  }

  compareAndSwapHead(expected: SnapshotRef, snapshot: CollaborationSnapshot): boolean {
    return this.withMutate(() => this.memory.durable.compareAndSwapHead(expected, snapshot));
  }

  compareAndSwapHeadWithBinding(
    expected: SnapshotRef,
    snapshot: CollaborationSnapshot,
    binding: SchemaEpochBinding,
  ): boolean {
    return this.withMutate(() =>
      this.memory.durable.compareAndSwapHeadWithBinding(expected, snapshot, binding),
    );
  }

  commit(input: DurableCommitInput): DurableCommitResult {
    return this.withMutate(() => this.memory.durable.commit(input));
  }

  changes(): readonly CoordinationChange[] {
    return this.withReload(() => this.memory.durable.changes());
  }

  since(fromRef: SnapshotRef): readonly CoordinationChange[] {
    return this.withReload(() => this.memory.durable.since(fromRef));
  }

  recipeForChange(change: CoordinationChange): ReplayRecipe | undefined {
    return this.withReload(() => this.memory.durable.recipeForChange(change));
  }

  snapshotMemory(): MemoryPersistence {
    return this.withReload(() => this.memory);
  }

  private withReload<T>(fn: () => T): T {
    return withFileLock(this.dir, () => {
      this.reloadMemory();
      return fn();
    });
  }

  private withMutate<T>(fn: () => T): T {
    return withFileLock(this.dir, () => {
      this.reloadMemory();
      const result = fn();
      this.persistMemory();
      return result;
    });
  }

  private reloadMemory(): void {
    const loaded = readBundle(this.dir);
    if (loaded.t0.snapshotRef !== this.t0Ref) {
      throw new Error(
        `file runtime generation changed: expected ${String(this.t0Ref)}, found ${String(loaded.t0.snapshotRef)}`,
      );
    }
    this.memory = loaded;
  }

  private persistMemory(): void {
    writeBundleAtomic(
      this.dir,
      exportDurableBundle(this.memory.durable, this.memory.store, this.memory.sidecar, this.t0Ref),
    );
  }
}

export function createFileRuntimePersistence(
  options: FileRuntimePersistenceOptions,
): FileRuntimePersistence {
  mkdirSync(options.dir, { recursive: true });
  const bundlePath = join(options.dir, BUNDLE_FILE);

  // The missing-bundle check and first publication are one cross-process
  // critical section. Without this, two first boots each returned their own
  // in-memory T0 while the last atomic rename silently chose a different disk
  // winner, so both callers could believe they owned the same new world.
  const initialized = withFileLock(options.dir, () => {
    try {
      readFileSync(bundlePath, "utf8");
      const loaded = readBundle(options.dir);
      return { memory: loaded, t0Ref: loaded.t0.snapshotRef };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        throw error;
      }
      if (options.initial === undefined) {
        throw new Error("createFileRuntimePersistence: bundle missing and no initial snapshot");
      }
      const memory = createMemoryRuntimePersistence({ initial: options.initial });
      const t0Ref = options.initial.snapshotRef;
      writeBundleAtomic(
        options.dir,
        exportDurableBundle(memory.durable, memory.store, memory.sidecar, t0Ref),
      );
      return { memory, t0Ref };
    }
  });

  const { memory, t0Ref } = initialized;

  const durable = new FileDurableCoordinator(options.dir, memory, t0Ref);
  const locks = new FileResourceLockTable(options.dir);
  return {
    durable,
    get store() {
      return durable.snapshotMemory().store;
    },
    get changelog() {
      return durable.snapshotMemory().changelog;
    },
    get sidecar() {
      return durable.snapshotMemory().sidecar;
    },
    t0Ref,
    dir: options.dir,
    locks,
  };
}

export type { MemoryDurableCoordinator } from "./memoryDurableCoordinator.js";
