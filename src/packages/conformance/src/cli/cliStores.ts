import {
  createMemoryEvidenceStore,
  createMemoryRevocationStore,
  createMemoryTrustStore,
  createMemoryVerificationCache,
  createMemoryConformanceEngine,
  createNoopAuditSink,
} from "../adapters/memory/index.js";
import { createFileAuditSink, createFileConformanceEngine } from "../adapters/file/index.js";
import { createConformanceEngine } from "../engine/conformanceEngine.js";
import type { AuditSink } from "../ports/auditSink.js";
import type { EvidenceStore } from "../ports/evidenceStore.js";
import { optionalStoreDir } from "./cliArgs.js";

export function createCliAuditSink(flags: ReadonlyMap<string, string | true>): AuditSink {
  const dir = optionalStoreDir(flags);
  if (dir === undefined) {
    return createNoopAuditSink();
  }
  return createFileAuditSink({ dir });
}

export function createCliConformanceEngine(flags: ReadonlyMap<string, string | true>) {
  const dir = optionalStoreDir(flags);
  if (dir === undefined) {
    return createMemoryConformanceEngine({ audit: createNoopAuditSink() });
  }
  return createFileConformanceEngine({ dir, audit: createFileAuditSink({ dir }) }).engine;
}

export interface CliVerificationContext {
  readonly engine: ReturnType<typeof createConformanceEngine>;
  readonly evidenceStore: EvidenceStore;
  readonly audit: AuditSink;
}

export function createCliVerificationContext(
  flags: ReadonlyMap<string, string | true>,
): CliVerificationContext {
  const dir = optionalStoreDir(flags);
  if (dir === undefined) {
    const evidenceStore = createMemoryEvidenceStore();
    const audit = createNoopAuditSink();
    return {
      evidenceStore,
      audit,
      engine: createConformanceEngine({
        evidenceStore,
        trustStore: createMemoryTrustStore(),
        revocationStore: createMemoryRevocationStore(),
        cache: createMemoryVerificationCache(),
        audit,
      }),
    };
  }
  const audit = createFileAuditSink({ dir });
  const { engine, evidenceStore } = createFileConformanceEngine({ dir, audit });
  return { evidenceStore, audit, engine };
}
