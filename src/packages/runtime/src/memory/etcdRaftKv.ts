import {
  Worker,
  MessageChannel,
  receiveMessageOnPort,
  type MessagePort,
} from "node:worker_threads";
import {
  decodeEtcdEntries,
  decodeEtcdLeaseId,
  encodeEtcdKey,
  encodeEtcdTxn,
  etcdRangeEnd,
  type EtcdJsonClient,
} from "./etcdJson.js";
import type { RaftCompare, RaftKv, RaftKvEntry, RaftLease, RaftOp, RaftTxnResult } from "./raftKv.js";

export interface EtcdRaftKvOptions {
  readonly endpoints: readonly string[];
  readonly client?: EtcdJsonClient;
}

const HANDSHAKE_TIMEOUT_MS = 30_000;

/**
 * CJS worker body (`eval: true`). Owns one official etcd v3 JSON gateway
 * session. The main thread stays synchronous with Atomics.wait.
 */
const ETCD_WORKER_SOURCE = `
const { parentPort } = require("node:worker_threads");
let port;
let signal;
let endpoint;

parentPort.on("message", (message) => {
  if (message.type === "init") {
    port = message.port;
    signal = new Int32Array(message.sab);
    endpoint = message.endpoint;
    reply({ ok: true, op: "ready" });
    return;
  }
  handleRequest(message);
});

async function handleRequest(request) {
  try {
    if (request.op === "end") {
      reply({ ok: true, op: "end" });
      return;
    }
    const response = await fetch(endpoint + request.path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request.body ?? {}),
    });
    const text = await response.text();
    let payload = {};
    if (text.length > 0) {
      payload = JSON.parse(text);
    }
    if (!response.ok) {
      const detail =
        typeof payload.error === "string"
          ? payload.error
          : typeof payload.message === "string"
            ? payload.message
            : text;
      reply({ ok: false, message: "etcd " + request.path + " " + String(response.status) + " " + detail });
      return;
    }
    if (typeof payload.error === "string" && payload.error.length > 0) {
      reply({ ok: false, message: payload.error });
      return;
    }
    reply({ ok: true, payload });
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

interface EtcdWorkerReply {
  readonly ok: boolean;
  readonly message?: string;
  readonly payload?: Record<string, unknown>;
}

export function decodeEtcdWorkerReply(parsed: unknown): EtcdWorkerReply {
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, message: "invalid etcd worker response" };
  }
  const record = parsed as Record<string, unknown>;
  if (record.ok === false) {
    return {
      ok: false,
      message: typeof record.message === "string" ? record.message : "etcd request failed",
    };
  }
  const payload =
    typeof record.payload === "object" && record.payload !== null
      ? (record.payload as Record<string, unknown>)
      : {};
  return { ok: true, payload };
}

export function collectTxnEntries(payload: Record<string, unknown>): RaftKvEntry[] {
  const responses = Array.isArray(payload.responses) ? payload.responses : [];
  const entries: RaftKvEntry[] = [];
  for (const response of responses) {
    if (typeof response !== "object" || response === null) {
      continue;
    }
    const record = response as Record<string, unknown>;
    const range =
      (record.responseRange as Record<string, unknown> | undefined) ??
      (record.response_range as Record<string, unknown> | undefined);
    if (range !== undefined) {
      entries.push(...decodeEtcdEntries(range));
    }
  }
  return entries;
}

class WorkerEtcdJsonClient implements EtcdJsonClient {
  private readonly worker: Worker;
  private readonly port: MessagePort;
  private readonly signal: Int32Array;
  private closed = false;

  constructor(endpoint: string) {
    const { port1, port2 } = new MessageChannel();
    const sab = new SharedArrayBuffer(4);
    this.signal = new Int32Array(sab);
    this.port = port1;
    this.worker = new Worker(ETCD_WORKER_SOURCE, { eval: true });
    this.worker.postMessage({ type: "init", port: port2, sab, endpoint }, [port2]);
    const ready = waitForEtcdReply(this.signal, this.port, "handshake");
    if (!ready.ok) {
      void this.worker.terminate();
      throw new Error(`etcd Raft worker failed: ${ready.message ?? "handshake failed"}`);
    }
  }

  post(path: string, body: Record<string, unknown>): Record<string, unknown> {
    Atomics.store(this.signal, 0, 0);
    this.worker.postMessage({ op: "post", path, body });
    const reply = waitForEtcdReply(this.signal, this.port, path);
    if (!reply.ok || reply.payload === undefined) {
      throw new Error(reply.message ?? "etcd request failed");
    }
    return reply.payload;
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    try {
      Atomics.store(this.signal, 0, 0);
      this.worker.postMessage({ op: "end" });
      waitForEtcdReply(this.signal, this.port, "end");
    } catch {
      // worker already gone
    }
    void this.worker.terminate();
  }
}

export class EtcdRaftKv implements RaftKv {
  private readonly client: EtcdJsonClient;
  private readonly owned?: WorkerEtcdJsonClient;

  constructor(options: EtcdRaftKvOptions) {
    const endpoint = options.endpoints[0];
    if (endpoint === undefined || endpoint.trim().length === 0) {
      throw new Error("etcd Raft requires at least one endpoint (ADR-0029)");
    }
    if (options.client !== undefined) {
      this.client = options.client;
      return;
    }
    this.owned = new WorkerEtcdJsonClient(endpoint.replace(/\/$/, ""));
    this.client = this.owned;
  }

  get(key: string): RaftKvEntry | undefined {
    const payload = this.client.post("/v3/kv/range", { key: encodeEtcdKey(key) });
    return decodeEtcdEntries(payload)[0];
  }

  range(prefix: string): readonly RaftKvEntry[] {
    const payload = this.client.post("/v3/kv/range", {
      key: encodeEtcdKey(prefix),
      range_end: encodeEtcdKey(etcdRangeEnd(prefix)),
    });
    return decodeEtcdEntries(payload);
  }

  txn(
    compare: readonly RaftCompare[],
    success: readonly RaftOp[],
    failure: readonly RaftOp[] = [],
  ): RaftTxnResult {
    const payload = this.client.post("/v3/kv/txn", encodeEtcdTxn(compare, success, failure));
    return { succeeded: payload.succeeded === true, entries: collectTxnEntries(payload) };
  }

  grantLease(ttlSeconds: number): RaftLease {
    const payload = this.client.post("/v3/lease/grant", { TTL: ttlSeconds > 0 ? ttlSeconds : 1 });
    const leaseId = decodeEtcdLeaseId(payload.ID ?? payload.id);
    if (leaseId === undefined) {
      throw new Error("etcd lease grant returned no ID");
    }
    return { leaseId, ttlSeconds: Number(payload.TTL ?? ttlSeconds) };
  }

  keepAlive(leaseId: string): boolean {
    const payload = this.client.post("/v3/lease/keepalive", { ID: leaseId });
    const result = payload.result as Record<string, unknown> | undefined;
    return decodeEtcdLeaseId(result?.ID ?? payload.ID ?? payload.id) !== undefined;
  }

  revokeLease(leaseId: string): void {
    this.client.post("/v3/lease/revoke", { ID: leaseId });
  }

  close(): void {
    this.owned?.close();
  }
}

export function createEtcdRaftKv(options: EtcdRaftKvOptions): RaftKv {
  return new EtcdRaftKv(options);
}

function waitForEtcdReply(signal: Int32Array, port: MessagePort, phase: string): EtcdWorkerReply {
  const waitResult = Atomics.wait(signal, 0, 0, HANDSHAKE_TIMEOUT_MS);
  if (waitResult === "timed-out") {
    throw new Error(`etcd Raft worker ${phase} timed out`);
  }
  const received = receiveMessageOnPort(port);
  if (received === undefined) {
    throw new Error(`etcd Raft worker ${phase} closed`);
  }
  return decodeEtcdWorkerReply(received.message);
}
