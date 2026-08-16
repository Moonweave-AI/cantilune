import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { CollaborationSnapshot } from "@cantilune/core";
import type { DurableCoordinator } from "../ports/durableCoordinator.js";
import type { ResourceLockTable } from "../ports/resourceLockTable.js";
import { createDurableCoordinatorFromEnv } from "./createDurableCoordinatorFromEnv.js";
import { createRaftDurableFromEnv } from "./createRaftDurableFromEnv.js";
import { createFileRuntimePersistence } from "./fileDurablePersistence.js";
import { FileResourceLockTable } from "./fileResourceLockTable.js";
import { postgresHaRequired, readDurableDatabaseUrl } from "./postgresHostProbe.js";
import type { SqlExecutor } from "./postgresSqlExecutor.js";
import { raftConfigured, raftRequired } from "./raftHostProbe.js";
import type { RaftKv } from "./raftKv.js";

export type ProductionDurableBackend = "postgres" | "file" | "raft";

export interface ResolveProductionDurableOptions {
  readonly storagePath: string;
  readonly initial: CollaborationSnapshot;
  readonly env?: NodeJS.ProcessEnv;
  readonly executor?: SqlExecutor;
  readonly raftKv?: RaftKv;
}

export interface ProductionDurableBackends {
  readonly durable: DurableCoordinator;
  readonly locks: ResourceLockTable;
  readonly backend: ProductionDurableBackend;
  dispose?(): void;
}

/**
 * Single-host default is file durable.
 * `CANTILUNE_DURABLE_DATABASE_URL` selects Postgres (ADR-0023).
 * `CANTILUNE_RAFT_ENDPOINTS` / `CANTILUNE_RAFT_EMBED=1` selects official etcd Raft (ADR-0029).
 * `CANTILUNE_DURABLE_BACKEND=file|postgres|raft` pins the backend and wins over auto-detect,
 * so an isolated world (eval, one-shot `--storage-path`) can stay file-local even when
 * the host env advertises HA.
 * Multi-host without either fail-closed — never silently stay on a local file head.
 */
export function resolveProductionDurable(
  options: ResolveProductionDurableOptions,
): ProductionDurableBackends {
  const env = options.env ?? process.env;
  const url = readDurableDatabaseUrl(env);
  const raftForcedFlag = raftRequired(env);
  const raftAvailable = options.raftKv !== undefined || raftConfigured(env);
  const pin = readDurableBackendPin(env);
  const runtimeDir = join(options.storagePath, "runtime");
  mkdirSync(runtimeDir, { recursive: true });

  if (pin === "file") {
    if (postgresHaRequired(env) || raftRequired(env)) {
      throw new Error(
        "CANTILUNE_DURABLE_BACKEND=file conflicts with CANTILUNE_REQUIRE_POSTGRES_HA or CANTILUNE_REQUIRE_RAFT",
      );
    }
    return openFileDurable(runtimeDir, options.initial);
  }
  assertDurableSelection(env, url, raftAvailable);
  if (pin === "postgres") {
    if (url === undefined) {
      throw new Error("CANTILUNE_DURABLE_BACKEND=postgres requires CANTILUNE_DURABLE_DATABASE_URL");
    }
    return openPostgresDurable(options, env, runtimeDir);
  }
  if (pin === "raft") {
    if (!raftAvailable) {
      throw new Error(
        "CANTILUNE_DURABLE_BACKEND=raft requires CANTILUNE_RAFT_ENDPOINTS, CANTILUNE_RAFT_EMBED=1, or an injected kv",
      );
    }
    return openRaftDurable(options, env);
  }

  if (url !== undefined && !raftForcedFlag) {
    return openPostgresDurable(options, env, runtimeDir);
  }
  if (raftAvailable) {
    return openRaftDurable(options, env);
  }
  return openFileDurable(runtimeDir, options.initial);
}

function readDurableBackendPin(env: NodeJS.ProcessEnv): ProductionDurableBackend | undefined {
  const raw = env.CANTILUNE_DURABLE_BACKEND?.trim().toLowerCase();
  if (raw === "file" || raw === "postgres" || raw === "raft") return raw;
  return undefined;
}

function assertDurableSelection(
  env: NodeJS.ProcessEnv,
  url: string | undefined,
  raftAvailable: boolean,
): void {
  const postgresForced = postgresHaRequired(env);
  const raftForcedFlag = raftRequired(env);
  if (postgresForced && raftForcedFlag) {
    throw new Error("CANTILUNE_REQUIRE_POSTGRES_HA and CANTILUNE_REQUIRE_RAFT cannot both be set");
  }
  if (postgresForced && url === undefined) {
    throw new Error(
      "CANTILUNE_DURABLE_DATABASE_URL required when CANTILUNE_REQUIRE_POSTGRES_HA=1 (ADR-0023)",
    );
  }
  if (raftForcedFlag && !raftAvailable) {
    throw new Error(
      "CANTILUNE_RAFT_ENDPOINTS or CANTILUNE_RAFT_EMBED=1 required when CANTILUNE_REQUIRE_RAFT=1 (ADR-0029)",
    );
  }
  if (env.CANTILUNE_HOST_MODE === "multi" && url === undefined && !raftAvailable) {
    throw new Error(
      "multi-host production requires CANTILUNE_DURABLE_DATABASE_URL or CANTILUNE_RAFT_ENDPOINTS / CANTILUNE_RAFT_EMBED=1 (ADR-0023 / ADR-0029)",
    );
  }
}

function openPostgresDurable(
  options: ResolveProductionDurableOptions,
  env: NodeJS.ProcessEnv,
  runtimeDir: string,
): ProductionDurableBackends {
  const postgres = createDurableCoordinatorFromEnv({
    env,
    initial: options.initial,
    ...(options.executor !== undefined ? { executor: options.executor } : {}),
  });
  if (postgres === undefined) {
    throw new Error("CANTILUNE_DURABLE_DATABASE_URL was set but Postgres durable did not open");
  }
  return {
    durable: postgres,
    locks: new FileResourceLockTable(runtimeDir),
    backend: "postgres",
    dispose() {
      const closable = postgres as DurableCoordinator & { close?: () => void };
      closable.close?.();
    },
  };
}

function openFileDurable(
  runtimeDir: string,
  initial: CollaborationSnapshot,
): ProductionDurableBackends {
  const file = createFileRuntimePersistence({
    dir: runtimeDir,
    initial,
  });
  return {
    durable: file.durable,
    locks: file.locks,
    backend: "file",
  };
}

function openRaftDurable(
  options: ResolveProductionDurableOptions,
  env: NodeJS.ProcessEnv,
): ProductionDurableBackends {
  const raft = createRaftDurableFromEnv({
    env,
    initial: options.initial,
    storagePath: options.storagePath,
    ...(options.raftKv !== undefined ? { kv: options.raftKv } : {}),
  });
  if (raft === undefined) {
    throw new Error("Raft durable was selected but did not open (ADR-0029)");
  }
  return {
    durable: raft.durable,
    locks: raft.locks,
    backend: "raft",
    dispose() {
      raft.dispose();
    },
  };
}
