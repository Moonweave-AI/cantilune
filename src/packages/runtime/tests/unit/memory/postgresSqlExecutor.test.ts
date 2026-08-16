import { Worker } from "node:worker_threads";
import { describe, expect, it } from "vitest";
import {
  createLineSqlDriver,
  createPgWorkerDriver,
  createPostgresSqlExecutor,
  createSqlExecutorFromDriver,
  createWorkerPortDriver,
  decodePgPayload,
  decodePgResponse,
  readSqlTag,
  resolvePgClientModulePath,
  taggedSql,
  type LineTransport,
  type PostgresSqlDriver,
} from "../../../src/memory/postgresSqlExecutor.js";

const FAKE_WORKER_SOURCE = `
const { parentPort } = require("node:worker_threads");
let port;
let signal;
parentPort.on("message", (message) => {
  if (message.type === "init") {
    port = message.port;
    signal = new Int32Array(message.sab);
    port.postMessage({ ok: true, op: "ready", rows: [], rowCount: 0 });
    Atomics.store(signal, 0, 1);
    Atomics.notify(signal, 0);
    return;
  }
  if (message.op === "end") {
    port.postMessage({ ok: true, op: "end", rows: [], rowCount: 0 });
    Atomics.store(signal, 0, 1);
    Atomics.notify(signal, 0);
    return;
  }
  if (message.sql === "FAIL") {
    port.postMessage({ ok: false, message: "forced" });
    Atomics.store(signal, 0, 1);
    Atomics.notify(signal, 0);
    return;
  }
  if (message.sql === "ROLLBACK") {
    port.postMessage({ ok: false, message: "rollback-failed" });
    Atomics.store(signal, 0, 1);
    Atomics.notify(signal, 0);
    return;
  }
  port.postMessage({ ok: true, rows: [{ n: 1 }], rowCount: 1 });
  Atomics.store(signal, 0, 1);
  Atomics.notify(signal, 0);
});
`;

const FAIL_HANDSHAKE_WORKER = `
const { parentPort } = require("node:worker_threads");
parentPort.on("message", (message) => {
  if (message.type === "init") {
    const signal = new Int32Array(message.sab);
    message.port.postMessage({ ok: false, message: "connect ECONNREFUSED 127.0.0.1:5432" });
    Atomics.store(signal, 0, 1);
    Atomics.notify(signal, 0);
  }
});
`;

function queueTransport(scripted: {
  handshake: string;
  onRequest?: (request: { op?: string; sql?: string }) => string;
}): LineTransport {
  const outbound: string[] = [scripted.handshake];
  return {
    readLine() {
      const line = outbound.shift();
      if (line === undefined) {
        throw new Error("connection closed");
      }
      return line;
    },
    writeLine(line) {
      const request = JSON.parse(line) as { op?: string; sql?: string };
      const reply =
        scripted.onRequest?.(request) ?? JSON.stringify({ ok: true, rows: [], rowCount: 0 });
      outbound.push(reply);
    },
    close() {},
  };
}

describe("postgres SqlExecutor", () => {
  it("tags SQL and resolves the pg package", () => {
    const sql = taggedSql("select_head", "SELECT 1");
    expect(readSqlTag(sql)).toBe("select_head");
    expect(readSqlTag("SELECT 1")).toBeUndefined();
    expect(readSqlTag("/* unknown_tag */ SELECT 1")).toBeUndefined();
    expect(resolvePgClientModulePath()).toMatch(/pg/);
  });

  it("decodes child protocol responses", () => {
    expect(decodePgResponse("{")).toEqual({ ok: false, message: "invalid pg child response" });
    expect(decodePgResponse("null")).toEqual({ ok: false, message: "invalid pg child response" });
    expect(decodePgPayload(null)).toEqual({ ok: false, message: "invalid pg child response" });
    expect(decodePgResponse(JSON.stringify({ ok: false }))).toEqual({
      ok: false,
      message: "pg query failed",
    });
    expect(decodePgResponse(JSON.stringify({ ok: true, op: "ready" }))).toEqual({
      ok: true,
      rows: [],
      rowCount: 0,
    });
    expect(decodePgResponse(JSON.stringify({ ok: true, rows: [{ a: 1 }], rowCount: 2 }))).toEqual({
      ok: true,
      rows: [{ a: 1 }],
      rowCount: 2,
    });
  });

  it("runs queries and transactions through an injected driver", () => {
    const statements: string[] = [];
    const driver: PostgresSqlDriver = {
      query(sql) {
        statements.push(sql);
        if (sql === "BOOM") {
          throw new Error("boom");
        }
        return { rows: [{ sql }], rowCount: 1 };
      },
      end() {
        statements.push("end");
      },
    };
    const executor = createPostgresSqlExecutor({
      connectionString: "postgres://unused",
      driver,
    });
    expect(executor.query("SELECT 1").rowCount).toBe(1);
    expect(executor.transaction((tx) => tx.query("SELECT 2").rowCount)).toBe(1);
    expect(() =>
      executor.transaction(() => {
        throw new Error("inner");
      }),
    ).toThrow("inner");
    executor.end?.();
    expect(statements).toContain("BEGIN");
    expect(statements).toContain("COMMIT");
    expect(statements).toContain("ROLLBACK");
    expect(statements).toContain("end");
  });

  it("preserves the original error when rollback itself fails", () => {
    const driver: PostgresSqlDriver = {
      query(sql) {
        if (sql === "ROLLBACK") {
          throw new Error("rollback-failed");
        }
        if (sql !== "BEGIN") {
          throw new Error("work-failed");
        }
        return { rows: [], rowCount: 0 };
      },
      end() {},
    };
    const executor = createSqlExecutorFromDriver(driver);
    expect(() =>
      executor.transaction(() => {
        throw new Error("work-failed");
      }),
    ).toThrow("work-failed");
  });

  it("speaks the line protocol through an in-memory transport", () => {
    const transport = queueTransport({
      handshake: JSON.stringify({ ok: true, op: "ready" }),
      onRequest(request) {
        if (request.sql === "FAIL") {
          return JSON.stringify({ ok: false, message: "forced" });
        }
        if (request.sql === "BADJSON") {
          return "not-json";
        }
        return JSON.stringify({ ok: true, rows: [{ n: 1 }], rowCount: 1 });
      },
    });
    const executor = createSqlExecutorFromDriver(createLineSqlDriver(transport));
    expect(executor.query("SELECT 1").rows).toEqual([{ n: 1 }]);
    expect(() => executor.query("FAIL")).toThrow("forced");
    expect(() => executor.query("BADJSON")).toThrow(/invalid pg child response/);
    expect(executor.transaction((tx) => tx.query("SELECT 2").rowCount)).toBe(1);
    executor.end?.();
  });

  it("swallows transport errors while ending a line driver", () => {
    let closed = false;
    const driver = createLineSqlDriver({
      readLine() {
        return JSON.stringify({ ok: true, op: "ready" });
      },
      writeLine() {
        throw new Error("stdin closed");
      },
      close() {
        closed = true;
      },
    });
    driver.end();
    expect(closed).toBe(true);
  });

  it("fails closed when the line handshake reports a refused connection", () => {
    expect(() =>
      createLineSqlDriver(
        queueTransport({
          handshake: JSON.stringify({
            ok: false,
            message: "connect ECONNREFUSED 127.0.0.1:5432",
          }),
        }),
      ),
    ).toThrow(/CANTILUNE_DURABLE_DATABASE_URL/);
  });

  it("fails closed when the line transport is already closed", () => {
    expect(() =>
      createLineSqlDriver({
        readLine() {
          throw new Error("connection closed");
        },
        writeLine() {},
        close() {},
      }),
    ).toThrow(/connection closed/);
  });

  it("speaks the worker Atomics protocol with a fake worker", () => {
    const worker = new Worker(FAKE_WORKER_SOURCE, { eval: true });
    const executor = createSqlExecutorFromDriver(createWorkerPortDriver(worker));
    expect(executor.query("SELECT 1").rows).toEqual([{ n: 1 }]);
    expect(() => executor.query("FAIL")).toThrow("forced");
    expect(executor.transaction((tx) => tx.query("SELECT 2").rowCount)).toBe(1);
    expect(() =>
      executor.transaction(() => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    executor.end?.();
  });

  it("swallows a second end after the worker is gone", () => {
    const worker = new Worker(FAKE_WORKER_SOURCE, { eval: true });
    const driver = createWorkerPortDriver(worker, 50);
    driver.end();
    expect(() => driver.end()).not.toThrow();
  });

  it("fails closed when the worker handshake reports a refused connection", () => {
    const worker = new Worker(FAIL_HANDSHAKE_WORKER, { eval: true });
    expect(() => createWorkerPortDriver(worker)).toThrow(/CANTILUNE_DURABLE_DATABASE_URL/);
  });

  it("fails closed when the worker handshake times out", () => {
    const worker = new Worker(
      `
const { parentPort } = require("node:worker_threads");
parentPort.on("message", () => {});
`,
      { eval: true },
    );
    expect(() => createWorkerPortDriver(worker, 20)).toThrow(/timed out/);
    void worker.terminate();
  });

  it("fails closed when the worker notifies without a reply payload", () => {
    const worker = new Worker(
      `
const { parentPort } = require("node:worker_threads");
parentPort.on("message", (message) => {
  if (message.type === "init") {
    const signal = new Int32Array(message.sab);
    Atomics.store(signal, 0, 1);
    Atomics.notify(signal, 0);
  }
});
`,
      { eval: true },
    );
    expect(() => createWorkerPortDriver(worker, 1000)).toThrow(/closed/);
    void worker.terminate();
  });

  it("rejects an empty connection string before starting a pg worker", () => {
    expect(() => createPgWorkerDriver("")).toThrow(/non-empty connectionString/);
    expect(() => createPgWorkerDriver("   ")).toThrow(/non-empty connectionString/);
  });
});
