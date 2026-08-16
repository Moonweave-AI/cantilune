#!/usr/bin/env node
/**
 * Download every host artifact before any service starts.
 * Invoked by `pnpm install` (prepare) and `pnpm host:prefetch`.
 *
 * Always: official etcd v3.5.21 → `.cantilune/bin`.
 * Local default: also `docker compose pull` + sandbox image.
 * `CANTILUNE_HOST_PREFETCH=bin` or GitHub Actions: binary only
 * (workflow `services:` / job containers already pull their images).
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ETCD_COMPOSE,
  POSTGRES_COMPOSE,
  composePull,
  ensureDocker,
  pullHostImages,
  runCommand,
} from "./dockerHost.mjs";
import { mergeHostEnv } from "./hostEnv.mjs";
import { installOfficialEtcd } from "./install-etcd.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = resolve(here, "../..");

export function prefetchMode(env = process.env) {
  if (env.CANTILUNE_HOST_PREFETCH === "bin") {
    return "bin";
  }
  if (env.GITHUB_ACTIONS === "true") {
    return "bin";
  }
  return "all";
}

function pullAlpineInWsl(env = process.env) {
  if (process.platform !== "win32") {
    return;
  }
  const distro = env.CANTILUNE_SANDBOX_WSL_DISTRO ?? "Ubuntu-24.04";
  const listed = runCommand("wsl", ["-l", "-q"], { env: { WSL_UTF8: "1" } });
  if (listed.status !== 0) {
    return;
  }
  const names = listed.stdout
    .split(/\r?\n/)
    .map((row) => row.replace(/^\*\s*/u, "").trim())
    .filter((row) => row.length > 0);
  if (!names.includes(distro)) {
    return;
  }
  process.stdout.write(`Pulling alpine:3.20 inside WSL ${distro}\n`);
  const pulled = runCommand(
    "wsl",
    ["-d", distro, "-u", "root", "--", "docker", "pull", "alpine:3.20"],
    { env: { WSL_UTF8: "1" } },
  );
  if (pulled.status !== 0) {
    throw new Error(
      `WSL ${distro} docker pull alpine:3.20 failed: ${pulled.stderr || pulled.stdout}`,
    );
  }
}

export async function prefetchHost(options = {}) {
  const repoRoot = options.repoRoot ?? defaultRepoRoot;
  const env = options.env ?? process.env;
  const mode = options.mode ?? prefetchMode(env);
  const etcdBin = await installOfficialEtcd(repoRoot);
  mergeHostEnv(repoRoot, { CANTILUNE_ETCD_BIN: etcdBin });
  process.stdout.write(`CANTILUNE_ETCD_BIN=${etcdBin}\n`);
  if (mode === "bin") {
    process.stdout.write(
      "Host prefetch: official etcd binary only (CI/workflow images are declared on the job).\n",
    );
    return { etcdBin, mode };
  }
  await ensureDocker();
  process.stdout.write(`Pulling ${POSTGRES_COMPOSE}\n`);
  composePull(repoRoot, POSTGRES_COMPOSE);
  process.stdout.write(`Pulling ${ETCD_COMPOSE}\n`);
  composePull(repoRoot, ETCD_COMPOSE);
  pullHostImages();
  pullAlpineInWsl(env);
  process.stdout.write("Host prefetch complete. Services are not started.\n");
  return { etcdBin, mode };
}

function invokedAsCli() {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  return fileURLToPath(import.meta.url).toLowerCase() === resolve(entry).toLowerCase();
}

if (invokedAsCli()) {
  await prefetchHost();
}
