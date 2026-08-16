import { join } from "node:path";
import type { CollaborationSnapshot } from "@cantilune/core";
import type { DurableCoordinator } from "../ports/durableCoordinator.js";
import type { ResourceLockTable } from "../ports/resourceLockTable.js";
import {
  sleepSync,
  startEmbeddedEtcd,
  type EmbeddedEtcd,
  type EtcdBinaryLocator,
  type EtcdProcessLauncher,
} from "./embedEtcd.js";
import { createEtcdRaftKv } from "./etcdRaftKv.js";
import { createRaftDurableCoordinator } from "./raftDurableCoordinator.js";
import { raftConfigured, raftEmbedRequested, readRaftEndpoints } from "./raftHostProbe.js";
import type { RaftKv } from "./raftKv.js";
import { RaftResourceLockTable } from "./raftResourceLockTable.js";

export interface RaftDurableFromEnvOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly kv?: RaftKv;
  readonly initial?: CollaborationSnapshot;
  readonly namespace?: string;
  readonly leaseOwner?: string;
  readonly leaseToken?: string;
  readonly storagePath?: string;
  readonly alreadyListening?: boolean;
  readonly locator?: EtcdBinaryLocator;
  readonly launcher?: EtcdProcessLauncher;
  readonly waitTimeoutMs?: number;
}

export interface RaftDurableBackends {
  readonly durable: DurableCoordinator;
  readonly locks: ResourceLockTable;
  readonly kv: RaftKv;
  readonly embed?: EmbeddedEtcd;
  dispose(): void;
}

export function createRaftDurableFromEnv(
  options: RaftDurableFromEnvOptions = {},
): RaftDurableBackends | undefined {
  const env = options.env ?? process.env;
  if (options.kv === undefined && !raftConfigured(env)) {
    return undefined;
  }
  const namespace = options.namespace ?? env.CANTILUNE_RAFT_NAMESPACE?.trim() ?? "cantilune";
  const opened = options.kv === undefined ? openEnvRaftKv(options, env) : { kv: options.kv };
  const durable = createRaftDurableCoordinator({
    kv: opened.kv,
    namespace,
    ...(options.initial !== undefined ? { initial: options.initial } : {}),
    ...(options.leaseOwner !== undefined ? { leaseOwner: options.leaseOwner } : {}),
    ...(options.leaseToken !== undefined ? { leaseToken: options.leaseToken } : {}),
  });
  return {
    durable,
    locks: new RaftResourceLockTable(opened.kv, namespace),
    kv: opened.kv,
    ...(opened.embed !== undefined ? { embed: opened.embed } : {}),
    dispose() {
      opened.kv.close?.();
      opened.embed?.stop();
    },
  };
}

function raftDataDir(env: NodeJS.ProcessEnv, storagePath: string): string {
  const configured = env.CANTILUNE_RAFT_DATA_DIR?.trim();
  return configured !== undefined && configured.length > 0 ? configured : join(storagePath, "etcd");
}

function openEnvRaftKv(
  options: RaftDurableFromEnvOptions,
  env: NodeJS.ProcessEnv,
): { kv: RaftKv; embed?: EmbeddedEtcd } {
  const configured = readRaftEndpoints(env);
  const embed = raftEmbedRequested(env)
    ? startEmbeddedEtcd({
        env,
        dataDir: raftDataDir(env, options.storagePath ?? ".cantilune"),
        extraBinDirs: [join(options.storagePath ?? ".cantilune", "bin"), join(".cantilune", "bin")],
        ...(options.alreadyListening !== undefined
          ? { alreadyListening: options.alreadyListening }
          : {}),
        ...(options.locator !== undefined ? { locator: options.locator } : {}),
        ...(options.launcher !== undefined ? { launcher: options.launcher } : {}),
      })
    : undefined;
  const endpoints = configured ?? embed?.endpoints;
  if (endpoints === undefined) {
    embed?.stop();
    throw new Error("CANTILUNE_RAFT_ENDPOINTS or CANTILUNE_RAFT_EMBED=1 required (ADR-0029)");
  }
  let kv: RaftKv | undefined;
  try {
    kv = createEtcdRaftKv({ endpoints });
    if (embed?.startedByUs === true) {
      const endpoint = embed.endpoints[0] ?? endpoints[0];
      if (endpoint === undefined) {
        throw new Error("embedded etcd returned no client endpoint (ADR-0029)");
      }
      waitForEtcd(kv, endpoint, options.waitTimeoutMs);
    }
    return embed === undefined ? { kv } : { kv, embed };
  } catch (error) {
    kv?.close?.();
    embed?.stop();
    throw error;
  }
}

function waitForEtcd(kv: RaftKv, endpoint: string, timeoutMs = 15_000): void {
  const deadline = Date.now() + timeoutMs;
  let last = `etcd ${endpoint} not ready`;
  while (Date.now() < deadline) {
    try {
      kv.get("__cantilune_probe__");
      return;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
      sleepSync(200);
    }
  }
  throw new Error(`embedded etcd did not become ready: ${last}`);
}
