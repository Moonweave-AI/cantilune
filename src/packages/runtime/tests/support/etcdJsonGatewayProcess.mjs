import { createServer } from "node:http";

const store = new Map();
const leases = new Map();
let revision = 0;
let leaseSeq = 0;

function encode(value) {
  return Buffer.from(value, "utf8").toString("base64");
}

function decode(value) {
  if (typeof value !== "string" || value.length === 0) {
    return "";
  }
  return Buffer.from(value, "base64").toString("utf8");
}

function expire() {
  const now = Date.now();
  for (const [leaseId, lease] of leases) {
    if (lease.expiresAt > now) {
      continue;
    }
    leases.delete(leaseId);
    for (const [key, entry] of store) {
      if (entry.leaseId === leaseId) {
        store.delete(key);
      }
    }
  }
}

function toEntry(key, stored) {
  if (stored === undefined) {
    return undefined;
  }
  return {
    key,
    value: stored.value,
    version: stored.version,
    createRevision: stored.createRevision,
    modRevision: stored.modRevision,
    ...(stored.leaseId !== undefined ? { leaseId: stored.leaseId } : {}),
  };
}

function encodeEntry(entry) {
  return {
    key: encode(entry.key),
    value: encode(entry.value),
    version: String(entry.version),
    create_revision: String(entry.createRevision),
    mod_revision: String(entry.modRevision),
    lease: entry.leaseId ?? "0",
  };
}

function matchesCompare(entry, compare) {
  if (compare.target === "CREATE") {
    const created = entry !== undefined && entry.createRevision > 0;
    return compare.result === "EQUAL" ? !created : created;
  }
  if (compare.target === "VERSION") {
    const version = entry?.version ?? 0;
    const expected = Number(compare.version ?? 0);
    return compare.result === "EQUAL" ? version === expected : version !== expected;
  }
  const value = entry?.value;
  const expected = decode(compare.value);
  return compare.result === "EQUAL" ? value === expected : value !== expected;
}

function applyOp(op) {
  const put = op.requestPut ?? op.request_put;
  if (typeof put === "object" && put !== null) {
    const key = decode(put.key);
    const value = decode(put.value);
    const leaseRaw = put.lease;
    const leaseId =
      leaseRaw === undefined || leaseRaw === 0 || leaseRaw === "0" ? undefined : String(leaseRaw);
    revision += 1;
    const previous = store.get(key);
    store.set(key, {
      value,
      version: (previous?.version ?? 0) + 1,
      createRevision: previous?.createRevision ?? revision,
      modRevision: revision,
      ...(leaseId !== undefined ? { leaseId } : {}),
    });
    return [];
  }
  const del = op.requestDeleteRange ?? op.request_delete_range;
  if (typeof del === "object" && del !== null) {
    store.delete(decode(del.key));
    return [];
  }
  const range = op.requestRange ?? op.request_range;
  if (typeof range === "object" && range !== null) {
    return rangeEntries(range);
  }
  throw new Error("unsupported etcd txn op");
}

function rangeEntries(body) {
  const key = decode(body.key);
  if (body.range_end === undefined) {
    const entry = toEntry(key, store.get(key));
    return entry === undefined ? [] : [entry];
  }
  const rangeEnd = decode(body.range_end);
  return [...store.entries()]
    .filter(([storedKey]) => storedKey.startsWith(key) && storedKey < rangeEnd)
    .map(([storedKey, stored]) => toEntry(storedKey, stored))
    .filter((entry) => entry !== undefined)
    .sort((left, right) => left.key.localeCompare(right.key));
}

function handle(path, body) {
  expire();
  if (path === "/v3/kv/range") {
    return { kvs: rangeEntries(body).map(encodeEntry) };
  }
  if (path === "/v3/kv/txn") {
    const compare = Array.isArray(body.compare) ? body.compare : [];
    const ok = compare.every((clause) =>
      matchesCompare(toEntry(decode(clause.key), store.get(decode(clause.key))), clause),
    );
    const ops = ok
      ? Array.isArray(body.success)
        ? body.success
        : []
      : Array.isArray(body.failure)
        ? body.failure
        : [];
    const entries = ops.flatMap(applyOp);
    return {
      succeeded: ok,
      responses:
        entries.length > 0 ? [{ response_range: { kvs: entries.map(encodeEntry) } }] : [],
    };
  }
  if (path === "/v3/lease/grant") {
    leaseSeq += 1;
    const leaseId = String(leaseSeq);
    const ttl = Number(body.TTL ?? 1) > 0 ? Number(body.TTL ?? 1) : 1;
    leases.set(leaseId, { expiresAt: Date.now() + ttl * 1000 });
    return { ID: leaseId, TTL: String(ttl) };
  }
  if (path === "/v3/lease/keepalive") {
    const leaseId = String(body.ID ?? "");
    const lease = leases.get(leaseId);
    if (lease === undefined) {
      return {};
    }
    lease.expiresAt = Date.now() + 30_000;
    return { result: { ID: leaseId } };
  }
  if (path === "/v3/lease/revoke") {
    const leaseId = String(body.ID ?? "");
    leases.delete(leaseId);
    for (const [key, entry] of store) {
      if (entry.leaseId === leaseId) {
        store.delete(key);
      }
    }
    return {};
  }
  if (path === "/v3/maintenance/status") {
    return { header: { raft_term: "1", cluster_id: "memory" } };
  }
  throw new Error(`unsupported etcd path ${path}`);
}

const failStatus = Number(process.env.CANTILUNE_ETCD_STUB_STATUS ?? "");
const server = createServer((request, response) => {
  const chunks = [];
  request.on("data", (chunk) => {
    chunks.push(chunk);
  });
  request.on("end", () => {
    try {
      if (Number.isInteger(failStatus) && failStatus >= 400) {
        response.writeHead(failStatus, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "member down" }));
        return;
      }
      const raw = Buffer.concat(chunks);
      const body = raw.length === 0 ? {} : JSON.parse(raw.toString("utf8"));
      const payload = handle(request.url ?? "/", body);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });
});

server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (address === null || typeof address === "string") {
    process.exit(1);
  }
  process.stdout.write(`LISTENING ${String(address.port)}\n`);
});
