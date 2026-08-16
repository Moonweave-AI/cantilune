import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createFileContentAddressedStore } from "./fileContentAddressedStore.js";
import { createFileRunStore } from "./fileRunStore.js";
import { createFileClaimLedger } from "./fileClaimLedger.js";
import { createFileLeaseCoordinator } from "./fileLeaseCoordinator.js";
import { createEvaluationEngine, type EvaluationEnginePorts } from "../../execution/evaluationEngine.js";
import type { LeaseCoordinator } from "../../ports/executionPorts.js";
import {
  ok,
  violations,
  violation,
  type EvaluationResult,
} from "../../foundation/evaluationResult.js";

export interface FileEvaluationEngineOptions {
  readonly baseDir: string;
  readonly ports: Omit<EvaluationEnginePorts, "runStore" | "cas" | "leaseCoordinator"> & {
    readonly leaseCoordinator?: LeaseCoordinator;
  };
}

/**
 * File-durable evaluation engine path (ADR-0011).
 * Requires a LeaseCoordinator with fencing — defaults to createFileLeaseCoordinator.
 */
export function createFileEvaluationEngine(options: FileEvaluationEngineOptions) {
  const { baseDir, ports } = options;
  const leaseCoordinator = ports.leaseCoordinator ?? createFileLeaseCoordinator(baseDir);
  if (leaseCoordinator === undefined) {
    throw new Error(
      "createFileEvaluationEngine requires a LeaseCoordinator (fencing). " +
        "Pass ports.leaseCoordinator or rely on the default file lease coordinator.",
    );
  }

  return createEvaluationEngine({
    ...ports,
    runStore: createFileRunStore(baseDir),
    cas: createFileContentAddressedStore(path.join(baseDir, "cas")),
    leaseCoordinator,
  });
}

export interface FileEvaluationStores {
  readonly runStore: ReturnType<typeof createFileRunStore>;
  readonly cas: ReturnType<typeof createFileContentAddressedStore>;
  readonly claimLedger: ReturnType<typeof createFileClaimLedger>;
  readonly leaseCoordinator: LeaseCoordinator;
}

export async function openFileEvaluationStores(
  baseDir: string,
): Promise<EvaluationResult<FileEvaluationStores>> {
  try {
    await fs.mkdir(baseDir, { recursive: true });
    return ok({
      runStore: createFileRunStore(baseDir),
      cas: createFileContentAddressedStore(path.join(baseDir, "cas")),
      claimLedger: createFileClaimLedger(baseDir),
      leaseCoordinator: createFileLeaseCoordinator(baseDir),
    });
  } catch (err) {
    return violations([
      violation(
        "store_write_failed",
        "baseDir",
        `Failed to open file evaluation stores: ${err instanceof Error ? err.message : String(err)}`,
      ),
    ]);
  }
}
