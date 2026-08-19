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
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pnpmCli = process.env.npm_execpath;
const procs = [];
const WEBSITE_PORTS = [5173, 7474];

function loadHostEnv() {
  const file = resolve(root, ".cantilune/host.env");
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const index = raw.indexOf("=");
    if (index <= 0 || raw.trimStart().startsWith("#")) continue;
    const key = raw.slice(0, index).trim();
    const value = raw.slice(index + 1).trim();
    // The browser needs only its own deterministic cache/version settings.
    // Never fan unrelated host credentials into the website server process.
    if (
      key.startsWith("CLOAKBROWSER_") &&
      (process.env[key] === undefined || process.env[key] === "")
    ) {
      process.env[key] = value;
    }
  }
}

loadHostEnv();

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

/**
 * Return the Windows processes currently listening on the fixed website ports.
 * This deliberately inspects command lines before stopping anything: a random
 * application using 5173 or 7474 must never be killed by this development
 * helper.
 */
function windowsWebsiteListeners() {
  const script = [
    `$ports = @(${WEBSITE_PORTS.join(",")})`,
    "$listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ports -contains [int]$_.LocalPort } | Sort-Object LocalPort, OwningProcess -Unique",
    "$result = foreach ($listener in $listeners) { $process = Get-CimInstance Win32_Process -Filter (\"ProcessId = {0}\" -f $listener.OwningProcess) -ErrorAction SilentlyContinue; $commandLine = if ($null -eq $process) { '' } else { [string]$process.CommandLine }; [PSCustomObject]@{ port = [int]$listener.LocalPort; pid = [int]$listener.OwningProcess; commandLine = $commandLine } }",
    "$result | ConvertTo-Json -Compress",
  ].join("; ");
  let output = "";
  try {
    output = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      encoding: "utf8",
      windowsHide: true,
    }).trim();
  } catch {
    return [];
  }
  if (output.length === 0) return [];
  try {
    const parsed = JSON.parse(output);
    return (Array.isArray(parsed) ? parsed : [parsed]).filter(
      (item) =>
        typeof item?.port === "number" &&
        typeof item?.pid === "number" &&
        typeof item?.commandLine === "string",
    );
  } catch {
    return [];
  }
}

function isCantiluneWebsiteListener(listener) {
  const commandLine = listener.commandLine.toLowerCase().replaceAll("/", "\\");
  const workspace = root.toLowerCase().replaceAll("/", "\\");
  if (!commandLine.includes(workspace)) return false;
  if (listener.port === 5173) {
    return commandLine.includes("\\src\\website\\client\\") && commandLine.includes("vite");
  }
  return (
    listener.port === 7474 &&
    commandLine.includes("tsx") &&
    (commandLine.includes("\\src\\website\\server\\") || commandLine.includes("src\\index.ts"))
  );
}

function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

/**
 * A previous Ctrl+C or a failed child can leave Vite/tsx listening after this
 * parent exits. Remove only those stale Cantilune children before starting a
 * new pair. Foreign listeners are reported with their PID and left untouched.
 */
async function prepareWebsitePorts() {
  if (process.platform !== "win32") return;
  const listeners = windowsWebsiteListeners();
  const foreign = listeners.filter((listener) => !isCantiluneWebsiteListener(listener));
  if (foreign.length > 0) {
    const occupied = foreign.map((listener) => `${listener.port} (PID ${listener.pid})`).join(", ");
    throw new Error(
      `Website port already belongs to another application: ${occupied}. ` +
        "It was left running for safety; stop that application and run pnpm dev:website again.",
    );
  }

  const stale = listeners.filter(isCantiluneWebsiteListener);
  for (const listener of stale) {
    console.log(
      `stopping stale Cantilune website process on ${listener.port} (PID ${listener.pid})`,
    );
    spawnSync("taskkill.exe", ["/PID", String(listener.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  }
  if (stale.length === 0) return;

  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (windowsWebsiteListeners().length === 0) return;
    await wait(100);
  }
  const remaining = windowsWebsiteListeners();
  const occupied = remaining.map((listener) => `${listener.port} (PID ${listener.pid})`).join(", ");
  throw new Error(`Cantilune website ports did not close in time: ${occupied}.`);
}

function start(name, pkg, color) {
  const child = runPnpm(["--filter", pkg, "run", "dev"], { stdio: ["ignore", "pipe", "pipe"] });
  procs.push(child);
  const tag = `\x1b[${color}m[${name}]\x1b[0m`;
  child.stdout.on("data", (d) => process.stdout.write(`${tag} ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`${tag} ${d}`));
  child.on("exit", (code) => {
    console.error(`${tag} exited (code=${code})`);
    procs.forEach((p) => p !== child && stopChildTree(p));
    process.exit(code ?? 0);
  });
}

function stopChildTree(child) {
  if (child.exitCode !== null || child.pid === undefined) return;
  if (process.platform === "win32") {
    // pnpm starts Vite/tsx as descendants. Killing just its direct Node
    // process leaves their listening sockets behind, so close this known
    // child tree as one unit when the development launcher exits.
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  child.kill("SIGTERM");
}

function cleanup() {
  procs.forEach(stopChildTree);
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
await prepareWebsitePorts();

start("server", "@cantilune/website-server", "36");
start("client", "@cantilune/website-client", "35");

console.log("\n\x1b[1mCantilune website dev mode\x1b[0m");
console.log("  backend  → ws://127.0.0.1:7474");
console.log("  frontend → http://localhost:5173  ← open this in your browser\n");
