import { createTcpDialer, scalarString, type TcpDialer } from "./postgresHostProbe.js";
import { DEFAULT_ETCD_CLIENT_URL } from "./embedEtcd.js";
import type { EtcdJsonClient } from "./etcdJson.js";

export const DEFAULT_RAFT_HOST = "127.0.0.1";
export const DEFAULT_RAFT_PORT = 2379;

export interface RaftEndpoint {
  readonly url: string;
  readonly host: string;
  readonly port: number;
}

export interface RaftClusterFacts {
  readonly raftTerm: string;
  readonly clusterId: string;
}

export interface RaftStatusQuerier {
  status(endpoint: string, timeoutMs?: number): Promise<RaftClusterFacts>;
}

export interface RaftClusterProbe {
  readonly endpointsConfigured: boolean;
  readonly embedRequested: boolean;
  readonly endpoints: readonly string[];
  readonly host: string;
  readonly port: number;
  readonly tcpReachable: boolean;
  readonly ready: boolean;
  readonly raftTerm?: string;
  readonly clusterId?: string;
  readonly reason?: string;
}

export interface ProbeRaftClusterOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly endpoints?: readonly string[];
  readonly dialer?: TcpDialer;
  readonly querier?: RaftStatusQuerier;
  readonly timeoutMs?: number;
}

export function raftRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CANTILUNE_REQUIRE_RAFT === "1";
}

export function raftEmbedRequested(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CANTILUNE_RAFT_EMBED === "1";
}

export function readRaftEndpoints(env: NodeJS.ProcessEnv = process.env): readonly string[] | undefined {
  const raw = env.CANTILUNE_RAFT_ENDPOINTS;
  if (raw === undefined) {
    return undefined;
  }
  const endpoints = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return endpoints.length === 0 ? undefined : endpoints;
}

export function raftConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return readRaftEndpoints(env) !== undefined || raftEmbedRequested(env);
}

export function parseRaftEndpoint(url: string | undefined): RaftEndpoint {
  const fallback = DEFAULT_ETCD_CLIENT_URL;
  const raw = url === undefined || url.trim().length === 0 ? fallback : url.trim();
  try {
    const parsed = new URL(raw);
    const port = parsed.port === "" ? DEFAULT_RAFT_PORT : Number(parsed.port);
    return {
      url: raw,
      host: parsed.hostname.length > 0 ? parsed.hostname : DEFAULT_RAFT_HOST,
      port: Number.isInteger(port) && port > 0 ? port : DEFAULT_RAFT_PORT,
    };
  } catch {
    return { url: fallback, host: DEFAULT_RAFT_HOST, port: DEFAULT_RAFT_PORT };
  }
}

export function decodeRaftClusterFacts(payload: Record<string, unknown>): RaftClusterFacts {
  const header =
    typeof payload.header === "object" && payload.header !== null
      ? (payload.header as Record<string, unknown>)
      : payload;
  return {
    raftTerm: scalarString(header.raft_term ?? header.raftTerm),
    clusterId: scalarString(header.cluster_id ?? header.clusterId),
  };
}

export function createEtcdStatusQuerier(client?: EtcdJsonClient): RaftStatusQuerier {
  return {
    async status(endpoint) {
      if (client !== undefined) {
        return decodeRaftClusterFacts(client.post("/v3/maintenance/status", {}));
      }
      const response = await fetch(`${endpoint.replace(/\/$/, "")}/v3/maintenance/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const payload = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(`etcd status ${String(response.status)}`);
      }
      return decodeRaftClusterFacts(payload);
    },
  };
}

export async function probeRaftCluster(
  options: ProbeRaftClusterOptions = {},
): Promise<RaftClusterProbe> {
  const env = options.env ?? process.env;
  const configured = options.endpoints ?? readRaftEndpoints(env);
  const embedRequested = raftEmbedRequested(env);
  const endpoints = configured ?? (embedRequested ? [DEFAULT_ETCD_CLIENT_URL] : []);
  const endpointsConfigured = configured !== undefined || embedRequested;
  const first = parseRaftEndpoint(endpoints[0]);
  const timeoutMs = options.timeoutMs ?? 1_500;
  const dialer = options.dialer ?? createTcpDialer();
  const tcpReachable = await dialer.connect(first.host, first.port, timeoutMs);

  if (!endpointsConfigured) {
    return {
      endpointsConfigured: false,
      embedRequested,
      endpoints,
      host: first.host,
      port: first.port,
      tcpReachable,
      ready: false,
      reason: "CANTILUNE_RAFT_ENDPOINTS unset and CANTILUNE_RAFT_EMBED!=1 (ADR-0029)",
    };
  }

  if (!tcpReachable) {
    return {
      endpointsConfigured: true,
      embedRequested,
      endpoints,
      host: first.host,
      port: first.port,
      tcpReachable: false,
      ready: false,
      reason: `etcd ${first.host}:${String(first.port)} is not reachable`,
    };
  }

  const querier = options.querier ?? createEtcdStatusQuerier();
  try {
    const facts = await querier.status(first.url, timeoutMs);
    const ready = facts.raftTerm.length > 0 || facts.clusterId.length > 0;
    return {
      endpointsConfigured: true,
      embedRequested,
      endpoints,
      host: first.host,
      port: first.port,
      tcpReachable: true,
      ready,
      raftTerm: facts.raftTerm,
      clusterId: facts.clusterId,
      ...(ready
        ? {}
        : { reason: "etcd is reachable but /v3/maintenance/status returned no raft term" }),
    };
  } catch (error) {
    return {
      endpointsConfigured: true,
      embedRequested,
      endpoints,
      host: first.host,
      port: first.port,
      tcpReachable: true,
      ready: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function assertRaftCluster(
  probe: RaftClusterProbe,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!raftRequired(env)) {
    return;
  }
  if (!probe.ready) {
    throw new Error(`etcd Raft fail-closed: ${probe.reason ?? "official etcd is not ready"}`);
  }
}
