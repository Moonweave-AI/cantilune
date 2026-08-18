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
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const procs = [];

function start(name, pkg, color) {
  const child = spawn("pnpm", ["--filter", pkg, "run", "dev"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });
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

start("server", "@cantilune/website-server", "36");
start("client", "@cantilune/website-client", "35");

console.log("\n\x1b[1mCantilune website dev mode\x1b[0m");
console.log("  backend  → ws://127.0.0.1:7474");
console.log("  frontend → http://localhost:5173  ← open this in your browser\n");

function cleanup() {
  procs.forEach((p) => !p.killed && p.kill());
}
process.on("SIGINT", () => { cleanup(); process.exit(0); });
process.on("SIGTERM", () => { cleanup(); process.exit(0); });
