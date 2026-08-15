import { storeSequence } from "@cantilune/core";
import { mkdirSync, readFileSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import type { MemoryControlPlaneStore } from "../memory/memoryControlPlaneStore.js";
import type { ActiveBindingCas, ControlPlaneSnapshot } from "../ports/controlPlaneStore.js";
import { encodeSchemaRevision, decodeSchemaRevision } from "../schema/schemaWireCodec.js";
import type { SchemaRevision } from "../schema/schemaRevision.js";
import { withFileLock } from "./fileLock.js";
import { atomicWriteFileSync } from "./atomicWrite.js";

const SNAPSHOT_FILE = "control-plane.snapshot.json";
const JOURNAL_FILE = "control-plane.journal.json";

export interface FileControlPlaneStoreOptions {
  readonly dir: string;
  readonly memory: MemoryControlPlaneStore;
}

function serializeSnapshot(snapshot: ControlPlaneSnapshot): string {
  return JSON.stringify({
    frozen: snapshot.frozen,
    lastSequence: snapshot.lastSequence,
    revisions: [...snapshot.revisions.entries()].map(([key, revision]) => [
      key,
      encodeSchemaRevision(revision),
    ]),
    policies: [...snapshot.policies.entries()],
    activeBindings: [...snapshot.activeBindings.entries()],
    admissions: [...snapshot.admissions.entries()],
    preparedAdmissions: [...snapshot.preparedAdmissions.entries()],
    commitDecisions: [...snapshot.commitDecisions.entries()],
    commitReceipts: [...snapshot.commitReceipts.entries()],
    idempotency: [...snapshot.idempotency.entries()],
    events: snapshot.events,
  });
}

function hydrateSnapshot(raw: ReturnType<typeof JSON.parse>): ControlPlaneSnapshot {
  const revisions = new Map<string, SchemaRevision>();
  for (const [key, wire] of raw.revisions as [string, unknown][]) {
    revisions.set(key, decodeSchemaRevision(wire as Parameters<typeof decodeSchemaRevision>[0]));
  }
  return {
    frozen: Boolean(raw.frozen),
    lastSequence: storeSequence(raw.lastSequence ?? 0),
    revisions,
    policies: new Map(raw.policies),
    activeBindings: new Map(raw.activeBindings),
    admissions: new Map(raw.admissions),
    preparedAdmissions: new Map(raw.preparedAdmissions ?? []),
    commitDecisions: new Map(raw.commitDecisions ?? []),
    commitReceipts: new Map(raw.commitReceipts ?? []),
    idempotency: new Map(raw.idempotency),
    events: raw.events ?? [],
  };
}

export class FileControlPlaneStore {
  readonly dir: string;
  private readonly memory: MemoryControlPlaneStore;

  constructor(options: FileControlPlaneStoreOptions) {
    this.dir = options.dir;
    this.memory = options.memory;
    mkdirSync(this.dir, { recursive: true });
    this.load();
  }

  get delegate(): MemoryControlPlaneStore {
    return this.memory;
  }

  persist(): void {
    withFileLock(this.dir, () => {
      this.persistUnlocked();
    });
  }

  /** Reload + CAS + persist under cross-process file lock. */
  casActiveBindingDurable(cas: ActiveBindingCas): boolean {
    return withFileLock(this.dir, () => {
      this.load();
      const ok = this.memory.casActiveBinding(cas);
      if (ok) {
        this.persistUnlocked();
      }
      return ok;
    });
  }

  private persistUnlocked(): void {
    const snapshot = this.memory.snapshot();
    atomicWriteFileSync(join(this.dir, SNAPSHOT_FILE), serializeSnapshot(snapshot));
  }

  appendJournal(entry: unknown): void {
    const path = join(this.dir, JOURNAL_FILE);
    const prior = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : [];
    prior.push(entry);
    atomicWriteFileSync(path, JSON.stringify(prior));
  }

  loadJournal(): readonly unknown[] {
    const path = join(this.dir, JOURNAL_FILE);
    if (!existsSync(path)) {
      return [];
    }
    return JSON.parse(readFileSync(path, "utf8")) as unknown[];
  }

  /**
   * Restores persisted state, refusing to continue if it cannot be read.
   *
   * Swallowing the failure here started the control plane on empty in-memory
   * state that looked legitimate — no epoch bindings, no admissions, nothing
   * frozen — and the next `persist` then overwrote the last good file with that
   * emptiness. Quarantining the unreadable file and throwing keeps the evidence
   * and stops a governance plane from running with no governance in it.
   */
  load(): void {
    const path = join(this.dir, SNAPSHOT_FILE);
    if (!existsSync(path)) {
      return;
    }
    try {
      const raw = JSON.parse(readFileSync(path, "utf8"));
      const snapshot = hydrateSnapshot(raw);
      this.memory.restoreSnapshot(snapshot);
    } catch (error) {
      const quarantine = join(this.dir, `${SNAPSHOT_FILE}.corrupt.${String(Date.now())}`);
      try {
        renameSync(path, quarantine);
      } catch {
        // Best-effort quarantine; the throw below is what protects the caller.
      }
      throw new Error(
        `control plane snapshot corrupt or unreadable — quarantined at ${quarantine}; ` +
          `refusing to start with empty governance state: ${
            error instanceof Error ? error.message : String(error)
          }`,
        { cause: error },
      );
    }
  }

  recover(): ControlPlaneSnapshot {
    this.load();
    return this.memory.snapshot();
  }
}

export function createFileControlPlaneStore(
  dir: string,
  memory: MemoryControlPlaneStore,
): FileControlPlaneStore {
  return new FileControlPlaneStore({ dir, memory });
}
