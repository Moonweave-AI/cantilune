import { createRequire } from "node:module";
import {
  Worker,
  MessageChannel,
  receiveMessageOnPort,
  type MessagePort,
} from "node:worker_threads";

const require = createRequire(import.meta.url);

/**
 * Tagged SQL the durable coordinator issues. The in-memory test executor
 * dispatches on the tag; Postgres ignores the comment.
 */
export const SQL_TAGS = [
  "ensure_ddl",
  "select_lease",
  "upsert_lease",
  "select_head",
  "write_head",
  "seed_head",
  "select_snapshot",
  "insert_snapshot",
  "upsert_snapshot",
  "select_changes",
  "select_last_change",
  "select_change_id",
  "insert_change",
  "insert_recipe",
  "select_recipe",
  "select_binding",
  "upsert_binding",
] as const;

export type SqlTag = (typeof SQL_TAGS)[number];

export interface SqlQueryResult {
  readonly rows: readonly Record<string, unknown>[];
  readonly rowCount: number;
}

/**
 * Synchronous SQL port. Production uses `pg` on a dedicated worker so
 * BEGIN/CAS/COMMIT stay on one connection; unit tests inject an in-memory
 * implementation and never open a socket.
 */
export interface SqlExecutor {
  query(sql: string, params?: readonly unknown[]): SqlQueryResult;
  transaction<T>(work: (tx: SqlExecutor) => T): T;
  end?(): void;
}

export interface PostgresSqlDriver {
  query(sql: string, params?: readonly unknown[]): SqlQueryResult;
  end(): void;
}

export interface PostgresSqlExecutorOptions {
  readonly connectionString: string;
  readonly driver?: PostgresSqlDriver;
}

export interface LineTransport {
  readLine(): string;
  writeLine(line: string): void;
  close(): void;
}

export type PgChildSuccess = {
  readonly ok: true;
  readonly rows: readonly Record<string, unknown>[];
  readonly rowCount: number;
};

export type PgChildFailure = {
  readonly ok: false;
  readonly message: string;
};

export type PgChildResponse = PgChildSuccess | PgChildFailure;

const HANDSHAKE_TIMEOUT_MS = 30_000;

/**
 * CJS worker body (`eval: true`). Owns one `pg.Client` so a transaction is
 * one connection. The main thread blocks with Atomics.wait.
 */
const PG_WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
const { createRequire } = require("node:module");

let port;
let signal;
let client;

parentPort.on("message", (message) => {
  if (message.type === "init") {
    port = message.port;
    signal = new Int32Array(message.sab);
    connectAndReady();
    return;
  }
  handleRequest(message);
});

async function connectAndReady() {
  try {
    const requirePg = createRequire(workerData.pgPath);
    const pg = requirePg(workerData.pgPath);
    client = new pg.Client({ connectionString: workerData.connectionString });
    await client.connect();
    reply({ ok: true, op: "ready", rows: [], rowCount: 0 });
  } catch (error) {
    reply({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
}

async function handleRequest(request) {
  try {
    if (request.op === "end") {
      if (client !== undefined) {
        await client.end();
      }
      reply({ ok: true, op: "end", rows: [], rowCount: 0 });
      return;
    }
    const result = await client.query(request.sql, request.params ?? []);
    const rowCount =
      result.rowCount === null || result.rowCount === undefined
        ? result.rows.length
        : result.rowCount;
    reply({ ok: true, rows: result.rows, rowCount });
  } catch (error) {
    reply({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
}

function reply(payload) {
  port.postMessage(payload);
  Atomics.store(signal, 0, 1);
  Atomics.notify(signal, 0);
}
`;

export function taggedSql(tag: SqlTag, sql: string): string {
  return `/* ${tag} */ ${sql}`;
}

export function readSqlTag(sql: string): SqlTag | undefined {
  const match = /^\/\* ([a-z_]+) \*\//.exec(sql.trim());
  if (match === null) {
    return undefined;
  }
  return SQL_TAGS.find((known) => known === match[1]);
}

/** Resolves the installed `pg` package so the query worker can `require` it. */
export function resolvePgClientModulePath(): string {
  return require.resolve("pg");
}

export function decodePgResponse(line: string): PgChildResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return { ok: false, message: "invalid pg child response" };
  }
  return decodePgPayload(parsed);
}

export function decodePgPayload(parsed: unknown): PgChildResponse {
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, message: "invalid pg child response" };
  }
  const record = parsed as Record<string, unknown>;
  if (record.ok === false) {
    const message = typeof record.message === "string" ? record.message : "pg query failed";
    return { ok: false, message };
  }
  const rows = Array.isArray(record.rows) ? (record.rows as Record<string, unknown>[]) : [];
  const rowCount = typeof record.rowCount === "number" ? record.rowCount : rows.length;
  return { ok: true, rows, rowCount };
}

export function createSqlExecutorFromDriver(driver: PostgresSqlDriver): SqlExecutor {
  const run = (sql: string, params: readonly unknown[] = []): SqlQueryResult =>
    driver.query(sql, params);

  const asTx = (): SqlExecutor => ({
    query: run,
    transaction: (inner) => inner(asTx()),
  });

  return {
    query: run,
    transaction(work) {
      run("BEGIN");
      try {
        const result = work(asTx());
        run("COMMIT");
        return result;
      } catch (error) {
        try {
          run("ROLLBACK");
        } catch {
          // Preserve the original failure; a rollback error is secondary.
        }
        throw error;
      }
    },
    end() {
      driver.end();
    },
  };
}

export function createLineSqlDriver(transport: LineTransport): PostgresSqlDriver {
  const ready = decodePgResponse(transport.readLine());
  if (!ready.ok) {
    transport.close();
    throw connectFailed(ready.message);
  }
  return {
    query(sql, params = []) {
      transport.writeLine(JSON.stringify({ op: "query", sql, params }));
      const response = decodePgResponse(transport.readLine());
      if (!response.ok) {
        throw new Error(response.message);
      }
      return { rows: response.rows, rowCount: response.rowCount };
    },
    end() {
      try {
        transport.writeLine(JSON.stringify({ op: "end" }));
        transport.readLine();
      } catch {
        // Transport already closed.
      }
      transport.close();
    },
  };
}

export function createWorkerPortDriver(
  worker: Worker,
  timeoutMs: number = HANDSHAKE_TIMEOUT_MS,
): PostgresSqlDriver {
  const { port1, port2 } = new MessageChannel();
  const sab = new SharedArrayBuffer(4);
  const signal = new Int32Array(sab);
  worker.postMessage({ type: "init", port: port2, sab }, [port2]);
  const ready = waitForWorkerReply(signal, port1, "handshake", timeoutMs);
  if (!ready.ok) {
    void worker.terminate();
    throw connectFailed(ready.message);
  }
  return {
    query(sql, params = []) {
      Atomics.store(signal, 0, 0);
      worker.postMessage({ op: "query", sql, params });
      const response = waitForWorkerReply(signal, port1, "query", timeoutMs);
      if (!response.ok) {
        throw new Error(response.message);
      }
      return { rows: response.rows, rowCount: response.rowCount };
    },
    end() {
      try {
        Atomics.store(signal, 0, 0);
        worker.postMessage({ op: "end" });
        waitForWorkerReply(signal, port1, "end", timeoutMs);
      } catch {
        // Worker already gone.
      }
      void worker.terminate();
    },
  };
}

export function createPgWorkerDriver(connectionString: string): PostgresSqlDriver {
  if (connectionString.trim() === "") {
    throw new Error("createPostgresSqlExecutor requires a non-empty connectionString");
  }
  const worker = new Worker(PG_WORKER_SOURCE, {
    eval: true,
    workerData: {
      connectionString,
      pgPath: resolvePgClientModulePath(),
    },
  });
  return createWorkerPortDriver(worker);
}

export function createPostgresSqlExecutor(options: PostgresSqlExecutorOptions): SqlExecutor {
  const driver = options.driver ?? createPgWorkerDriver(options.connectionString);
  return createSqlExecutorFromDriver(driver);
}

function waitForWorkerReply(
  signal: Int32Array,
  port: MessagePort,
  phase: string,
  timeoutMs: number,
): PgChildResponse {
  const waitResult = Atomics.wait(signal, 0, 0, timeoutMs);
  if (waitResult === "timed-out") {
    throw connectFailed(`pg worker ${phase} timed out`);
  }
  const received = receiveMessageOnPort(port);
  if (received === undefined) {
    throw connectFailed(`pg worker ${phase} closed`);
  }
  return decodePgPayload(received.message);
}

function connectFailed(detail: string): Error {
  return new Error(
    `Postgres durable coordinator failed to connect: ${detail}. ` +
      "Provide a reachable CANTILUNE_DURABLE_DATABASE_URL (operator-provided Postgres HA).",
  );
}
