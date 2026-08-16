import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { delimiter, join } from "node:path";

export const DEFAULT_ETCD_CLIENT_URL = "http://127.0.0.1:2379";
export const DEFAULT_ETCD_PEER_URL = "http://127.0.0.1:2380";
export const OFFICIAL_ETCD_VERSION = "v3.5.21";

export interface EmbeddedEtcd {
  readonly endpoints: readonly string[];
  readonly startedByUs: boolean;
  readonly pid?: number;
  stop(): void;
}

export interface EtcdBinaryLocator {
  locate(env: NodeJS.ProcessEnv, extraDirs?: readonly string[]): string | undefined;
}

export interface EtcdProcessHandle {
  readonly pid?: number | undefined;
  kill(): void;
}

export interface EtcdProcessLauncher {
  spawn(bin: string, args: readonly string[], cwd: string): EtcdProcessHandle;
}

export interface EmbedEtcdOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly dataDir: string;
  readonly clientUrl?: string;
  readonly peerUrl?: string;
  readonly extraBinDirs?: readonly string[];
  readonly locator?: EtcdBinaryLocator;
  readonly launcher?: EtcdProcessLauncher;
  readonly alreadyListening?: boolean;
}

export function etcdBinaryName(platform: NodeJS.Platform = process.platform): string {
  return platform === "win32" ? "etcd.exe" : "etcd";
}

export function resolveEtcdBinary(
  env: NodeJS.ProcessEnv = process.env,
  extraDirs: readonly string[] = [],
): string | undefined {
  const configured = env.CANTILUNE_ETCD_BIN?.trim();
  if (configured !== undefined && configured.length > 0 && existsSync(configured)) {
    return configured;
  }
  const name = etcdBinaryName();
  for (const dir of extraDirs) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  const pathValue = env.PATH ?? env.Path;
  if (pathValue === undefined) {
    return undefined;
  }
  for (const dir of pathValue.split(delimiter)) {
    if (dir.length === 0) {
      continue;
    }
    const candidate = join(dir, name);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export function createPathEtcdLocator(): EtcdBinaryLocator {
  return {
    locate(env, extraDirs = []) {
      return resolveEtcdBinary(env, extraDirs);
    },
  };
}

export function createProcessEtcdLauncher(): EtcdProcessLauncher {
  return {
    spawn(bin, args, cwd) {
      const child: ChildProcess = spawn(bin, [...args], {
        cwd,
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      child.unref();
      return {
        pid: child.pid,
        kill() {
          if (child.pid !== undefined) {
            try {
              process.kill(child.pid);
            } catch {
              // already gone
            }
          }
        },
      };
    },
  };
}

export function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function startEmbeddedEtcd(options: EmbedEtcdOptions): EmbeddedEtcd {
  const env = options.env ?? process.env;
  const clientUrl = options.clientUrl ?? env.CANTILUNE_RAFT_CLIENT_URL ?? DEFAULT_ETCD_CLIENT_URL;
  const peerUrl = options.peerUrl ?? env.CANTILUNE_RAFT_PEER_URL ?? DEFAULT_ETCD_PEER_URL;
  if (options.alreadyListening === true) {
    return { endpoints: [clientUrl], startedByUs: false, stop() {} };
  }
  const locator = options.locator ?? createPathEtcdLocator();
  const bin = locator.locate(env, options.extraBinDirs);
  if (bin === undefined) {
    throw new Error(
      `official etcd ${OFFICIAL_ETCD_VERSION} binary not found. pnpm install / pnpm host:prefetch writes it to .cantilune/bin (ADR-0029)`,
    );
  }
  mkdirSync(options.dataDir, { recursive: true });
  const launcher = options.launcher ?? createProcessEtcdLauncher();
  const child = launcher.spawn(
    bin,
    [
      "--name",
      "cantilune-embed",
      "--data-dir",
      options.dataDir,
      "--listen-client-urls",
      clientUrl,
      "--advertise-client-urls",
      clientUrl,
      "--listen-peer-urls",
      peerUrl,
      "--initial-advertise-peer-urls",
      peerUrl,
      "--initial-cluster",
      `cantilune-embed=${peerUrl}`,
      "--initial-cluster-state",
      "new",
    ],
    options.dataDir,
  );
  return {
    endpoints: [clientUrl],
    startedByUs: true,
    ...(child.pid !== undefined ? { pid: child.pid } : {}),
    stop() {
      child.kill();
    },
  };
}
