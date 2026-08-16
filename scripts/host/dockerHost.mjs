import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const POSTGRES_COMPOSE = "deploy/postgres-ha/docker-compose.yml";
export const ETCD_COMPOSE = "deploy/etcd-raft/docker-compose.yml";

/** Images every clone must have locally before any container starts. */
export const HOST_IMAGES = Object.freeze([
  "postgres:16",
  "quay.io/coreos/etcd:v3.5.21",
  "alpine:3.20",
]);

export function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    windowsHide: true,
    shell: options.shell === true,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function dockerAvailable() {
  return runCommand("docker", ["info"]).status === 0;
}

export async function ensureDocker(options = {}) {
  if (dockerAvailable()) {
    return;
  }
  if (process.platform === "win32") {
    const desktop = "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe";
    if (!existsSync(desktop)) {
      throw new Error(
        "Docker is not installed. Install Docker Desktop (or a Linux engine) then re-run pnpm install / pnpm host:prefetch.",
      );
    }
    spawn(desktop, [], { detached: true, stdio: "ignore" }).unref();
    const timeoutMs = options.timeoutMs ?? 180_000;
    const started = Date.now();
    let last = "";
    while (Date.now() - started < timeoutMs) {
      const next = runCommand("docker", ["info"]);
      if (next.status === 0) {
        return;
      }
      last = next.stderr || next.stdout;
      await new Promise((resolveSleep) => {
        setTimeout(resolveSleep, 2000);
      });
    }
    throw new Error(`Docker engine did not become ready: ${last}`);
  }
  throw new Error("docker info failed; start the Docker engine then re-run pnpm host:prefetch");
}

export function composePull(repoRoot, composeRel) {
  const file = resolve(repoRoot, composeRel);
  const pulled = runCommand("docker", ["compose", "-f", file, "pull"], { cwd: repoRoot });
  if (pulled.status !== 0) {
    throw new Error(`docker compose pull ${composeRel} failed: ${pulled.stderr || pulled.stdout}`);
  }
}

export function composeUpNoPull(repoRoot, composeRel, env = {}) {
  const file = resolve(repoRoot, composeRel);
  const up = runCommand("docker", ["compose", "-f", file, "up", "-d", "--pull", "never"], {
    cwd: repoRoot,
    env,
  });
  if (up.status !== 0) {
    throw new Error(
      `docker compose up --pull never ${composeRel} failed: ${up.stderr || up.stdout}. Images must already be local (pnpm install / pnpm host:prefetch).`,
    );
  }
}

export function dockerPull(image) {
  const pulled = runCommand("docker", ["pull", image]);
  if (pulled.status !== 0) {
    throw new Error(`docker pull ${image} failed: ${pulled.stderr || pulled.stdout}`);
  }
}

export function pullHostImages() {
  for (const image of HOST_IMAGES) {
    process.stdout.write(`Pulling ${image}\n`);
    dockerPull(image);
  }
}
