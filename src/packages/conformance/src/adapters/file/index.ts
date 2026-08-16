import { createFileEvidenceStore } from "./fileEvidenceStore.js";
import { createFileDecisionLog } from "./fileDecisionLog.js";
import { createFileTrustStore } from "./fileTrustStore.js";
import { createFileRevocationStore } from "./fileRevocationStore.js";
import { createFileVerificationCache } from "./fileVerificationCache.js";
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
    revocationStore: createFileRevocationStore({ dir: options.dir }),
    cache: createFileVerificationCache({ dir: options.dir }),
    audit: options.audit,
  });
  return { engine, evidenceStore, decisionLog };
}

export { createFileEvidenceStore } from "./fileEvidenceStore.js";
export { createFileDecisionLog } from "./fileDecisionLog.js";
export { createFileAuditSink } from "./fileAuditSink.js";
export { createFileTrustStore } from "./fileTrustStore.js";
export { createFileRevocationStore } from "./fileRevocationStore.js";
export { createFileVerificationCache } from "./fileVerificationCache.js";
export { acquireFileLock, withFileLock } from "./fileLock.js";
