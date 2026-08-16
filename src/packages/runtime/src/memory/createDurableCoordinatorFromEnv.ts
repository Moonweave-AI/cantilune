import type { CollaborationSnapshot } from "@cantilune/core";
import type { DurableCoordinator } from "../ports/durableCoordinator.js";
import { createPostgresDurableCoordinator } from "./postgresDurableCoordinator.js";
import type { SqlExecutor } from "./postgresSqlExecutor.js";

export interface DurableCoordinatorFromEnvOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly executor?: SqlExecutor;
  readonly initial?: CollaborationSnapshot;
  readonly schema?: string;
  readonly leaseOwner?: string;
  readonly leaseToken?: string;
}

/**
 * ADR-0023: when `CANTILUNE_DURABLE_DATABASE_URL` is set, return a Postgres
 * durable coordinator. Absent or blank URL returns undefined so single-host
 * `bootFileOS` stays file-backed. Multi-replica callers must fail-closed
 * themselves when this returns undefined.
 */
export function createDurableCoordinatorFromEnv(
  options: DurableCoordinatorFromEnvOptions = {},
): DurableCoordinator | undefined {
  const env = options.env ?? process.env;
  const raw = env.CANTILUNE_DURABLE_DATABASE_URL;
  if (raw === undefined) {
    return undefined;
  }
  const connectionString = raw.trim();
  if (connectionString.length === 0) {
    return undefined;
  }
  return createPostgresDurableCoordinator({
    connectionString,
    ...(options.schema !== undefined ? { schema: options.schema } : {}),
    ...(options.executor !== undefined ? { executor: options.executor } : {}),
    ...(options.initial !== undefined ? { initial: options.initial } : {}),
    ...(options.leaseOwner !== undefined ? { leaseOwner: options.leaseOwner } : {}),
    ...(options.leaseToken !== undefined ? { leaseToken: options.leaseToken } : {}),
  });
}
