import { createRequire } from "node:module";
import net from "node:net";
import type { Client } from "pg";

const require = createRequire(import.meta.url);

interface PgModule {
  readonly Client: new (config: {
    readonly connectionString: string;
    readonly connectionTimeoutMillis?: number;
  }) => Client;
}

export const DEFAULT_POSTGRES_HOST = "127.0.0.1";
export const DEFAULT_POSTGRES_PORT = 5432;

export interface PostgresEndpoint {
  readonly host: string;
  readonly port: number;
}

export interface PostgresHaFacts {
  readonly inRecovery: boolean;
  readonly replicaCount: number;
  readonly synchronousStandbyNames: string;
}

export interface TcpDialer {
  connect(host: string, port: number, timeoutMs?: number): Promise<boolean>;
}

export interface PostgresHaQuerier {
  query(connectionString: string, timeoutMs?: number): Promise<PostgresHaFacts>;
}

export interface PostgresHaProbe {
  readonly urlConfigured: boolean;
  readonly host: string;
  readonly port: number;
  readonly tcpReachable: boolean;
  readonly haReady: boolean;
  readonly inRecovery?: boolean;
  readonly replicaCount?: number;
  readonly synchronousStandbyNames?: string;
  readonly reason?: string;
}

export interface ProbePostgresHaOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly connectionString?: string;
  readonly dialer?: TcpDialer;
  readonly querier?: PostgresHaQuerier;
  readonly timeoutMs?: number;
}

export function postgresHaRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CANTILUNE_REQUIRE_POSTGRES_HA === "1";
}

export function readDurableDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const raw = env.CANTILUNE_DURABLE_DATABASE_URL;
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export function parsePostgresEndpoint(connectionString: string | undefined): PostgresEndpoint {
  if (connectionString === undefined) {
    return { host: DEFAULT_POSTGRES_HOST, port: DEFAULT_POSTGRES_PORT };
  }
  try {
    const normalized = connectionString.replace(/^postgres(?:ql)?:/i, "http:");
    const url = new URL(normalized);
    const parsedPort = url.port === "" ? DEFAULT_POSTGRES_PORT : Number(url.port);
    return {
      host: url.hostname.length > 0 ? url.hostname : DEFAULT_POSTGRES_HOST,
      port: Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_POSTGRES_PORT,
    };
  } catch {
    return { host: DEFAULT_POSTGRES_HOST, port: DEFAULT_POSTGRES_PORT };
  }
}

export function createTcpDialer(): TcpDialer {
  return {
    connect(host, port, timeoutMs = 1_500) {
      return new Promise((resolve) => {
        const socket = net.connect({ host, port });
        const finish = (reachable: boolean): void => {
          socket.removeAllListeners();
          socket.destroy();
          resolve(reachable);
        };
        const timer = setTimeout(() => finish(false), timeoutMs);
        socket.once("connect", () => {
          clearTimeout(timer);
          finish(true);
        });
        socket.once("error", () => {
          clearTimeout(timer);
          finish(false);
        });
      });
    },
  };
}

export function scalarString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  return "";
}

export function asBoolean(value: unknown): boolean {
  return value === true || value === "t" || value === "true";
}

export function firstRowValue(rows: readonly Record<string, unknown>[], key: string): unknown {
  const row = rows[0];
  if (row === undefined) {
    return undefined;
  }
  if (key in row) {
    return row[key];
  }
  const values = Object.values(row);
  return values[0];
}

export function decodePostgresHaFacts(input: {
  readonly recoveryRows: readonly Record<string, unknown>[];
  readonly replicaRows: readonly Record<string, unknown>[];
  readonly syncRows: readonly Record<string, unknown>[];
}): PostgresHaFacts {
  return {
    inRecovery: asBoolean(firstRowValue(input.recoveryRows, "in_recovery")),
    replicaCount: Number(firstRowValue(input.replicaRows, "replica_count") ?? 0),
    synchronousStandbyNames: scalarString(
      firstRowValue(input.syncRows, "synchronous_standby_names"),
    ),
  };
}

export async function queryPostgresHaFacts(
  connectionString: string,
  timeoutMs = 1_500,
): Promise<PostgresHaFacts> {
  const pg = require("pg") as PgModule;
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: timeoutMs,
  });
  await client.connect();
  try {
    const recovery = await client.query("SELECT pg_is_in_recovery() AS in_recovery");
    const replicas = await client.query(
      "SELECT count(*)::int AS replica_count FROM pg_stat_replication",
    );
    const sync = await client.query("SHOW synchronous_standby_names");
    return decodePostgresHaFacts({
      recoveryRows: recovery.rows as Record<string, unknown>[],
      replicaRows: replicas.rows as Record<string, unknown>[],
      syncRows: sync.rows as Record<string, unknown>[],
    });
  } finally {
    await client.end();
  }
}

export function createPostgresHaQuerier(): PostgresHaQuerier {
  return {
    query(connectionString, timeoutMs) {
      return queryPostgresHaFacts(connectionString, timeoutMs);
    },
  };
}

export function postgresHaFactsReady(facts: PostgresHaFacts): boolean {
  return (
    facts.replicaCount > 0 || facts.synchronousStandbyNames.trim().length > 0 || facts.inRecovery
  );
}

export async function probePostgresHa(
  options: ProbePostgresHaOptions = {},
): Promise<PostgresHaProbe> {
  const env = options.env ?? process.env;
  const connectionString = options.connectionString ?? readDurableDatabaseUrl(env);
  const urlConfigured = connectionString !== undefined;
  const endpoint = parsePostgresEndpoint(connectionString);
  const timeoutMs = options.timeoutMs ?? 1_500;
  const dialer = options.dialer ?? createTcpDialer();
  const tcpReachable = await dialer.connect(endpoint.host, endpoint.port, timeoutMs);

  if (!urlConfigured) {
    return {
      urlConfigured: false,
      host: endpoint.host,
      port: endpoint.port,
      tcpReachable,
      haReady: false,
      reason: "CANTILUNE_DURABLE_DATABASE_URL unset; multi-host production fail-closed (ADR-0023)",
    };
  }

  if (!tcpReachable) {
    return {
      urlConfigured: true,
      host: endpoint.host,
      port: endpoint.port,
      tcpReachable: false,
      haReady: false,
      reason: `postgres ${endpoint.host}:${endpoint.port} is not reachable`,
    };
  }

  const querier = options.querier ?? createPostgresHaQuerier();
  try {
    const facts = await querier.query(connectionString, timeoutMs);
    const haReady = postgresHaFactsReady(facts);
    return {
      urlConfigured: true,
      host: endpoint.host,
      port: endpoint.port,
      tcpReachable: true,
      haReady,
      inRecovery: facts.inRecovery,
      replicaCount: facts.replicaCount,
      synchronousStandbyNames: facts.synchronousStandbyNames,
      ...(haReady
        ? {}
        : {
            reason:
              "postgres is reachable but HA catalog shows no replica, sync standby, or recovery peer",
          }),
    };
  } catch (error) {
    return {
      urlConfigured: true,
      host: endpoint.host,
      port: endpoint.port,
      tcpReachable: true,
      haReady: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function assertPostgresHa(
  probe: PostgresHaProbe,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!postgresHaRequired(env)) {
    return;
  }
  if (!probe.haReady) {
    throw new Error(
      `Postgres HA fail-closed: ${probe.reason ?? "operator-provided HA is not ready"}`,
    );
  }
}
