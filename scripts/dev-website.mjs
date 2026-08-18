#!/usr/bin/env node
/**
 * dev:website — start the Cantilune website (backend bridge + Vite frontend)
 * with one command. Cross-platform (works on PowerShell + bash).
 *
 * Backend:  @cantilune/website-server dev  (tsx watch, WS on 127.0.0.1:7474)
 * Frontend: @cantilune/website-client dev (Vite,        http on 127.0.0.1:5173)
 *
 * Open http://localhost:5173 in your browser once both are ready.
 * Ctrl+C kills both.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pnpmCli = process.env.npm_execpath;
const procs = [];

function runPnpm(args, { stdio = "inherit", extraEnv = {} } = {}) {
  if (typeof pnpmCli !== "string" || pnpmCli.length === 0) {
    throw new Error("dev:website must be launched via pnpm so npm_execpath is set.");
  }
  return spawn(process.execPath, [pnpmCli, ...args], {
    cwd: root,
    stdio,
    shell: false,
    env: { ...process.env, ...extraEnv },
    windowsHide: true,
  });
}

function runPnpmOnce(args, extraEnv = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = runPnpm(args, { extraEnv });
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`pnpm ${args.join(" ")} exited ${code ?? 1}`));
    });
    child.on("error", reject);
  });
}

function websiteBinsReady() {
  return (
    existsSync(resolve(root, "src/website/client/node_modules/vite/package.json")) &&
    existsSync(resolve(root, "src/website/server/node_modules/tsx/package.json"))
  );
}

function websiteBuilt() {
  return existsSync(resolve(root, "src/packages/cli/dist/lib.js"));
}

async function ensureReady() {
  if (!websiteBinsReady()) {
    console.log("website dependencies missing — running pnpm install…\n");
    await runPnpmOnce(["install"], {
      CANTILUNE_HOST_PREFETCH: process.env.CANTILUNE_HOST_PREFETCH ?? "bin",
    });
    if (!websiteBinsReady()) {
      throw new Error(
        "pnpm install finished but vite/tsx are still missing. Check src/website/{client,server} workspace wiring.",
      );
    }
  }
  if (!websiteBuilt()) {
    console.log(
      "workspace dist missing — building @cantilune/website-server and its dependencies…\n",
    );
    await runPnpmOnce(["--filter", "@cantilune/website-server...", "run", "build"]);
    if (!websiteBuilt()) {
      throw new Error(
        "build finished but @cantilune/cli/dist/lib.js is still missing. The website bridge cannot start.",
      );
    }
  }
}

function start(name, pkg, color) {
  const child = runPnpm(["--filter", pkg, "run", "dev"], { stdio: ["ignore", "pipe", "pipe"] });
  procs.push(child);
  const tag = `\x1b[${color}m[${name}]\x1b[0m`;
  child.stdout.on("data", (d) => process.stdout.write(`${tag} ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`${tag} ${d}`));
  child.on("exit", (code) => {
    console.error(`${tag} exited (code=${code})`);
    procs.forEach((p) => p !== child && !p.killed && p.kill());
    process.exit(code ?? 0);
  });
}

function cleanup() {
  procs.forEach((p) => !p.killed && p.kill());
}
process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

await ensureReady();

start("server", "@cantilune/website-server", "36");
start("client", "@cantilune/website-client", "35");

console.log("\n\x1b[1mCantilune website dev mode\x1b[0m");
console.log("  backend  → ws://127.0.0.1:7474");
console.log("  frontend → http://localhost:5173  ← open this in your browser\n");
