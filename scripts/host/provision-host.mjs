#!/usr/bin/env node
/**
 * Bring up operator-provided host capabilities (ADR-0023 / ADR-0024 / ADR-0029).
 *
 * Images and the official etcd binary are pulled first (`prefetch-host.mjs`).
 * `docker compose up` uses `--pull never` so start never downloads.
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ETCD_COMPOSE,
  POSTGRES_COMPOSE,
  composeUpNoPull,
  runCommand,
} from "./dockerHost.mjs";
import { loadHostEnv, mergeHostEnv } from "./hostEnv.mjs";
import { prefetchHost } from "./prefetch-host.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
loadHostEnv(repoRoot);
const raftEndpoints =
  process.env.CANTILUNE_RAFT_ENDPOINTS ??
  "http://127.0.0.1:2379,http://127.0.0.1:22379,http://127.0.0.1:32379";
const password = process.env.CANTILUNE_POSTGRES_PASSWORD ?? "cantilune_local";
const replicaPassword = process.env.CANTILUNE_REPLICA_PASSWORD ?? "cantilune_replica";
const databaseUrl =
  process.env.CANTILUNE_DURABLE_DATABASE_URL ??
  `postgresql://cantilune:${password}@127.0.0.1:5432/cantilune`;

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

async function waitFor(label, probe, timeoutMs) {
  const started = Date.now();
  let last = "";
  while (Date.now() - started < timeoutMs) {
    const result = await probe();
    if (result.ok) return result;
    last = result.detail ?? "";
    await sleep(2000);
  }
  throw new Error(`${label} did not become ready: ${last}`);
}

function execPrimary(sql) {
  return runCommand("docker", [
    "exec",
    "cantilune-pg-primary",
    "psql",
    "-U",
    "cantilune",
    "-d",
    "cantilune",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    sql,
  ]);
}

async function enableSyncStandby() {
  const alter = execPrimary("ALTER SYSTEM SET synchronous_standby_names = 'FIRST 1 (replica)'");
  if (alter.status !== 0) {
    throw new Error(`failed to set synchronous_standby_names: ${alter.stderr || alter.stdout}`);
  }
  const reload = execPrimary("SELECT pg_reload_conf()");
  if (reload.status !== 0) {
    throw new Error(`failed to reload synchronous_standby_names: ${reload.stderr || reload.stdout}`);
  }
}

async function prefetchThenStart() {
  await prefetchHost({ repoRoot, mode: "all" });
}

async function provisionPostgresHa() {
  await prefetchThenStart();
  composeUpNoPull(repoRoot, POSTGRES_COMPOSE, {
    CANTILUNE_POSTGRES_PASSWORD: password,
    CANTILUNE_REPLICA_PASSWORD: replicaPassword,
  });
  await waitFor(
    "Postgres primary ready",
    async () => {
      const ready = runCommand("docker", [
        "exec",
        "cantilune-pg-primary",
        "pg_isready",
        "-U",
        "cantilune",
        "-d",
        "cantilune",
      ]);
      return { ok: ready.status === 0, detail: ready.stdout || ready.stderr };
    },
    90_000,
  );
  await waitFor(
    "Postgres replica streaming",
    async () => {
      const replicas = runCommand("docker", [
        "exec",
        "cantilune-pg-primary",
        "psql",
        "-U",
        "cantilune",
        "-d",
        "cantilune",
        "-tAc",
        "SELECT count(*) FROM pg_stat_replication",
      ]);
      const count = Number((replicas.stdout || "").trim());
      return { ok: replicas.status === 0 && count > 0, detail: replicas.stdout || replicas.stderr };
    },
    120_000,
  );
  await enableSyncStandby();
  mergeHostEnv(repoRoot, { CANTILUNE_DURABLE_DATABASE_URL: databaseUrl });
  process.stdout.write(`CANTILUNE_DURABLE_DATABASE_URL=${databaseUrl}\n`);
}

async function provisionEtcdRaft() {
  await prefetchThenStart();
  composeUpNoPull(repoRoot, ETCD_COMPOSE);
  await waitFor(
    "etcd Raft ready",
    async () => {
      const health = runCommand("docker", [
        "exec",
        "cantilune-etcd-1",
        "etcdctl",
        "endpoint",
        "health",
        "--endpoints=http://127.0.0.1:2379",
      ]);
      return { ok: health.status === 0, detail: health.stdout || health.stderr };
    },
    90_000,
  );
  mergeHostEnv(repoRoot, { CANTILUNE_RAFT_ENDPOINTS: raftEndpoints });
  process.stdout.write(`CANTILUNE_RAFT_ENDPOINTS=${raftEndpoints}\n`);
}

function provisionHyperV() {
  if (process.platform !== "win32") {
    process.stdout.write("Hyper-V isolated containers apply on win32; this host uses gVisor.\n");
    return;
  }
  const script = resolve(here, "enable-hyperv.ps1");
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script],
    { encoding: "utf8", windowsHide: true },
  );
  process.stdout.write(result.stdout ?? "");
  if ((result.status ?? 1) === 3) {
    process.stdout.write(
      "Hyper-V is unavailable on this Windows SKU. Linux isolation is WSL + official runsc.\n",
    );
    return;
  }
  if ((result.status ?? 1) !== 0) {
    process.stderr.write(result.stderr ?? "");
    process.stderr.write(
      "Hyper-V VMMS is not running. Re-run scripts/host/enable-hyperv.ps1 as Administrator.\n",
    );
  }
}

function wslEnv() {
  return { WSL_UTF8: "1" };
}

function wslRoot(distro, args) {
  return runCommand("wsl", ["-d", distro, "-u", "root", "--", ...args], { env: wslEnv() });
}

function listWslDistros() {
  const listed = runCommand("wsl", ["-l", "-q"], { env: wslEnv() });
  if (listed.status !== 0) return [];
  return listed.stdout
    .split(/\r?\n/)
    .map((row) => row.replace(/^\*\s*/u, "").trim())
    .filter((row) => row.length > 0 && row !== "docker-desktop");
}

async function ensureUbuntuWsl(distro) {
  const ready = wslRoot(distro, ["echo", "ok"]);
  if (ready.status === 0) return distro;
  const existing = listWslDistros();
  if (existing.includes(distro)) {
    await waitFor(
      `WSL distro ${distro}`,
      async () => {
        const next = wslRoot(distro, ["echo", "ok"]);
        return { ok: next.status === 0, detail: next.stderr || next.stdout };
      },
      120_000,
    );
    return distro;
  }
  process.stdout.write(`Installing WSL distro ${distro} (official Ubuntu, web download)...\n`);
  const install = runCommand("wsl", ["--install", "-d", distro, "--web-download", "--no-launch"], {
    env: wslEnv(),
  });
  process.stdout.write(install.stdout);
  if (install.status !== 0) process.stderr.write(install.stderr);
  await waitFor(
    `WSL distro ${distro}`,
    async () => {
      const next = wslRoot(distro, ["echo", "ok"]);
      return { ok: next.status === 0, detail: next.stderr || next.stdout };
    },
    300_000,
  );
  return distro;
}

function windowsPathToWsl(windowsPath) {
  const normalized = windowsPath.replace(/\\/g, "/");
  const match = /^([A-Za-z]):\/(.*)$/.exec(normalized);
  if (match === null) return normalized;
  return `/mnt/${match[1].toLowerCase()}/${match[2]}`;
}

async function provisionGvisor() {
  if (process.platform === "linux") {
    const script = resolve(here, "install-gvisor.sh");
    const result = runCommand("bash", [script]);
    process.stdout.write(result.stdout);
    if (result.status !== 0) process.stderr.write(result.stderr);
    return;
  }
  if (process.platform !== "win32") {
    process.stdout.write("gVisor runsc is Linux-only.\n");
    return;
  }
  const distro = process.env.CANTILUNE_SANDBOX_WSL_DISTRO ?? "Ubuntu-24.04";
  await ensureUbuntuWsl(distro);
  const script = windowsPathToWsl(resolve(here, "install-gvisor-wsl.sh"));
  process.stdout.write(`Installing official gVisor runsc + Docker Engine in WSL ${distro}...\n`);
  const install = wslRoot(distro, ["bash", script]);
  process.stdout.write(install.stdout);
  if (install.status !== 0) {
    process.stderr.write(install.stderr);
    throw new Error(`WSL gVisor install failed in ${distro}`);
  }
  mergeHostEnv(repoRoot, {
    CANTILUNE_SANDBOX_ISOLATION: "runsc",
    CANTILUNE_SANDBOX_WSL_DISTRO: distro,
  });
  process.stdout.write(`CANTILUNE_SANDBOX_ISOLATION=runsc\n`);
  process.stdout.write(`CANTILUNE_SANDBOX_WSL_DISTRO=${distro}\n`);
}

const target = process.argv[2] ?? "all";
const jobs = {
  prefetch: async () => {
    await prefetchHost({ repoRoot, mode: "all" });
  },
  postgres: provisionPostgresHa,
  etcd: provisionEtcdRaft,
  hyperv: async () => provisionHyperV(),
  gvisor: async () => {
    await provisionGvisor();
  },
  all: async () => {
    await provisionPostgresHa();
    await provisionEtcdRaft();
    provisionHyperV();
    await provisionGvisor();
  },
};

if (!(target in jobs)) {
  throw new Error(`unknown target ${target}; use prefetch|postgres|etcd|hyperv|gvisor|all`);
}

await jobs[target]();
