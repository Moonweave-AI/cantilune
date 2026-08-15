import { createFileEvidenceStore } from "./fileEvidenceStore.js";
import { createFileDecisionLog } from "./fileDecisionLog.js";
import { createFileTrustStore } from "./fileTrustStore.js";
import { createMemoryRevocationStore } from "../memory/memoryRevocationStore.js";
import { createMemoryVerificationCache } from "../memory/memoryVerificationCache.js";
import { createConformanceEngine } from "../../engine/conformanceEngine.js";
import type { AuditSink } from "../../ports/auditSink.js";
import type { DecisionStore } from "../../ports/decisionStore.js";

export interface FileConformanceEngineOptions {
  readonly dir: string;
  readonly audit: AuditSink;
}

export interface FileConformanceEngine {
  readonly engine: ReturnType<typeof createConformanceEngine>;
  readonly evidenceStore: ReturnType<typeof createFileEvidenceStore>;
  readonly decisionLog: DecisionStore;
}

export function createFileConformanceEngine(
  options: FileConformanceEngineOptions,
): FileConformanceEngine {
  const evidenceStore = createFileEvidenceStore({ dir: options.dir });
  const decisionLog = createFileDecisionLog({ dir: options.dir });
  const engine = createConformanceEngine({
    evidenceStore,
    trustStore: createFileTrustStore({ dir: options.dir }),
    revocationStore: createMemoryRevocationStore(),
    cache: createMemoryVerificationCache(),
    audit: options.audit,
  });
  return { engine, evidenceStore, decisionLog };
}

export { createFileEvidenceStore } from "./fileEvidenceStore.js";
export { createFileDecisionLog } from "./fileDecisionLog.js";
export { createFileAuditSink } from "./fileAuditSink.js";
export { createFileTrustStore } from "./fileTrustStore.js";
export { acquireFileLock, withFileLock } from "./fileLock.js";
