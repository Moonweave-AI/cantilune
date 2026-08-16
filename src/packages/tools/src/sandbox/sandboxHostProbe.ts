import { spawn } from "node:child_process";
import {
  createOsSandbox,
  isolationForPlatform,
  type OsSandbox,
  type OsSandboxProbe,
  type SandboxIsolation,
} from "./osSandbox.js";

export interface HostCommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export interface HostCommandRunner {
  run(command: string, args: readonly string[], timeoutMs?: number): Promise<HostCommandResult>;
}

export interface SandboxHostProbe {
  readonly platform: string;
  readonly isolation: SandboxIsolation;
  readonly isolationReady: boolean;
  readonly dockerAvailable: boolean;
  readonly hypervisorPresent?: boolean;
  readonly vmmsRunning?: boolean;
  readonly runscPresent?: boolean;
  readonly dockerIsolation?: string;
  readonly windowsEdition?: string;
  readonly hyperVSkuSupported?: boolean;
  readonly wslDistro?: string;
  readonly reason?: string;
}

export interface ProbeSandboxHostOptions {
  readonly platform?: string;
  readonly sandbox?: OsSandbox;
  readonly runner?: HostCommandRunner;
  readonly timeoutMs?: number;
  readonly isolation?: SandboxIsolation | string;
  readonly wslDistro?: string;
  readonly env?: NodeJS.ProcessEnv;
}

export function sandboxIsolationRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CANTILUNE_HOST_MODE === "multi" || env.CANTILUNE_REQUIRE_SANDBOX === "1";
}

export function createProcessHostCommandRunner(): HostCommandRunner {
  return {
    run(command, args, timeoutMs = 15_000) {
      return new Promise((resolve, reject) => {
        const child = spawn(command, [...args], {
          windowsHide: true,
          env: { ...process.env, WSL_UTF8: "1" },
        });
        let stdout = "";
        let stderr = "";
        let settled = false;
        let timedOut = false;

        const finish = (exitCode: number): void => {
          if (settled) return;
          settled = true;
          if (timedOut) {
            reject(new Error(`${command} timed out after ${timeoutMs}ms`));
            return;
          }
          resolve({ stdout, stderr, exitCode });
        };

        const timer = setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
        }, timeoutMs);

        child.stdout?.on("data", (chunk: Buffer | string) => {
          stdout += String(chunk);
        });
        child.stderr?.on("data", (chunk: Buffer | string) => {
          stderr += String(chunk);
        });
        child.on("error", (error) => {
          clearTimeout(timer);
          if (settled) return;
          settled = true;
          reject(error);
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          finish(code ?? 1);
        });
      });
    },
  };
}

function trimOutput(result: HostCommandResult): string {
  return `${result.stdout}\n${result.stderr}`.trim();
}

async function runOrUnavailable(
  runner: HostCommandRunner,
  command: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<HostCommandResult | undefined> {
  try {
    return await runner.run(command, args, timeoutMs);
  } catch {
    return undefined;
  }
}

function parseHypervisorPresent(text: string): boolean | undefined {
  const normalized = text.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return undefined;
}

function parseVmmsRunning(text: string): boolean | undefined {
  const normalized = text.trim().toLowerCase();
  if (normalized.length === 0) return false;
  if (normalized.includes("running")) return true;
  if (normalized.includes("stopped") || normalized.includes("paused")) return false;
  return undefined;
}

const MICROSOFT_HYPERV_HOME_SKU =
  "Microsoft Learn: The Hyper-V role can't be installed on Windows 10 Home or Windows 11 Home (https://learn.microsoft.com/windows-server/virtualization/hyper-v/get-started/install-hyper-v)";

export const DEFAULT_WSL_GVISOR_DISTROS = ["cantilune-gvisor", "Ubuntu-24.04", "Ubuntu"] as const;

export function hyperVSkuSupported(productName: string, editionId: string): boolean {
  if (/home/i.test(productName)) return false;
  if (/^core/i.test(editionId.trim())) return false;
  return true;
}

function parseWindowsSku(text: string): {
  readonly windowsEdition?: string;
  readonly hyperVSkuSupported?: boolean;
} {
  const line = text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .find((row) => row.includes("|"));
  if (line === undefined) return {};
  const [productName, editionId] = line.split("|", 2);
  if (productName === undefined || editionId === undefined) return {};
  return {
    windowsEdition: `${productName} (${editionId})`,
    hyperVSkuSupported: hyperVSkuSupported(productName, editionId),
  };
}

async function probeWindowsIsolation(
  runner: HostCommandRunner,
  timeoutMs: number,
): Promise<{
  readonly hypervisorPresent?: boolean;
  readonly vmmsRunning?: boolean;
  readonly windowsEdition?: string;
  readonly hyperVSkuSupported?: boolean;
  readonly reason?: string;
}> {
  const hypervisor = await runOrUnavailable(
    runner,
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "(Get-CimInstance -ClassName Win32_ComputerSystem).HypervisorPresent",
    ],
    timeoutMs,
  );
  const vmms = await runOrUnavailable(
    runner,
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "(Get-Service -Name vmms -ErrorAction SilentlyContinue).Status",
    ],
    timeoutMs,
  );
  const sku = await runOrUnavailable(
    runner,
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$v = Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion'; Write-Output \"$($v.ProductName)|$($v.EditionID)\"",
    ],
    timeoutMs,
  );
  const hypervisorPresent =
    hypervisor === undefined ? undefined : parseHypervisorPresent(trimOutput(hypervisor));
  const vmmsRunning = vmms === undefined ? undefined : parseVmmsRunning(trimOutput(vmms));
  const parsedSku = sku === undefined ? {} : parseWindowsSku(trimOutput(sku));
  const reasons: string[] = [];
  if (parsedSku.hyperVSkuSupported === false) {
    reasons.push(MICROSOFT_HYPERV_HOME_SKU);
  }
  if (hypervisorPresent !== true) {
    reasons.push("Win32_ComputerSystem.HypervisorPresent is not True");
  }
  if (vmmsRunning !== true) {
    reasons.push("Hyper-V VMMS service is not Running");
  }
  return {
    ...(hypervisorPresent !== undefined ? { hypervisorPresent } : {}),
    ...(vmmsRunning !== undefined ? { vmmsRunning } : {}),
    ...parsedSku,
    ...(reasons.length > 0 ? { reason: reasons.join("; ") } : {}),
  };
}

async function probeLinuxRunsc(
  runner: HostCommandRunner,
  timeoutMs: number,
  wslDistro?: string,
): Promise<{ readonly runscPresent: boolean; readonly reason?: string }> {
  if (wslDistro !== undefined && wslDistro.length > 0) {
    const version = await runOrUnavailable(
      runner,
      "wsl",
      ["-d", wslDistro, "-u", "root", "--", "runsc", "--version"],
      timeoutMs,
    );
    if (version !== undefined && version.exitCode === 0) {
      return { runscPresent: true };
    }
    return { runscPresent: false, reason: `gVisor runsc is not in WSL distro ${wslDistro}` };
  }
  const version = await runOrUnavailable(runner, "runsc", ["--version"], timeoutMs);
  if (version !== undefined && version.exitCode === 0) {
    return { runscPresent: true };
  }
  const which = await runOrUnavailable(runner, "sh", ["-c", "command -v runsc"], timeoutMs);
  const present = which !== undefined && which.exitCode === 0 && which.stdout.trim().length > 0;
  return {
    runscPresent: present,
    ...(present ? {} : { reason: "gVisor runsc is not on PATH" }),
  };
}

function parseWslDistroList(text: string): readonly string[] {
  return text
    .split(/\r?\n/)
    .map((row) => row.replace(/^\*\s*/, "").trim())
    .filter((row) => row.length > 0 && !/^wsl:/i.test(row) && row !== "docker-desktop");
}

async function resolveWslDistro(
  runner: HostCommandRunner,
  timeoutMs: number,
  configured: string | undefined,
): Promise<string | undefined> {
  if (configured !== undefined && configured.trim().length > 0) {
    return configured.trim();
  }
  const listed = await runOrUnavailable(runner, "wsl", ["-l", "-q"], timeoutMs);
  if (listed === undefined || listed.exitCode !== 0) {
    return undefined;
  }
  const names = parseWslDistroList(listed.stdout);
  return DEFAULT_WSL_GVISOR_DISTROS.find((name) => names.includes(name));
}

function combineReason(
  platformReason: string | undefined,
  sandbox: OsSandboxProbe,
): string | undefined {
  const parts = [
    platformReason,
    sandbox.isAvailable ? undefined : (sandbox.reason ?? "docker isolation probe failed"),
  ].filter((part): part is string => part !== undefined && part.length > 0);
  return parts.length > 0 ? parts.join("; ") : undefined;
}

export async function probeSandboxHost(
  options: ProbeSandboxHostOptions = {},
): Promise<SandboxHostProbe> {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const requested = options.isolation ?? env.CANTILUNE_SANDBOX_ISOLATION;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const runner = options.runner ?? createProcessHostCommandRunner();
  const wslDistro = await resolveWslDistro(
    runner,
    timeoutMs,
    options.wslDistro ?? env.CANTILUNE_SANDBOX_WSL_DISTRO,
  );
  const windows = platform === "win32" ? await probeWindowsIsolation(runner, timeoutMs) : undefined;
  let isolation = isolationForPlatform(platform, requested);
  const runsc =
    isolation === "runsc" || platform === "linux" || wslDistro !== undefined
      ? await probeLinuxRunsc(runner, timeoutMs, platform === "win32" ? wslDistro : undefined)
      : { runscPresent: false as const };

  if (
    requested === undefined &&
    platform === "win32" &&
    windows?.hyperVSkuSupported === false &&
    wslDistro !== undefined &&
    runsc.runscPresent
  ) {
    isolation = "runsc";
  }

  const sandbox =
    options.sandbox ??
    createOsSandbox({
      platform: isolation === "runsc" && platform === "win32" ? "linux" : platform,
      isolation,
      ...(wslDistro !== undefined && isolation === "runsc" ? { wslDistro } : {}),
    });
  const sandboxProbe = await sandbox.probe();

  if (isolation === "unsupported") {
    return {
      platform,
      isolation,
      isolationReady: false,
      dockerAvailable: sandboxProbe.isAvailable,
      reason: `unsupported sandbox platform: ${platform}`,
    };
  }

  if (isolation === "runsc") {
    return assembleLinuxProbe(platform, isolation, sandboxProbe, runsc, {
      ...(windows?.windowsEdition !== undefined ? { windowsEdition: windows.windowsEdition } : {}),
      ...(windows?.hyperVSkuSupported !== undefined
        ? { hyperVSkuSupported: windows.hyperVSkuSupported }
        : {}),
      ...(wslDistro !== undefined ? { wslDistro } : {}),
    });
  }

  return assembleWindowsProbe(platform, isolation, sandboxProbe, windows ?? {});
}

function assembleWindowsProbe(
  platform: string,
  isolation: SandboxIsolation,
  sandboxProbe: OsSandboxProbe,
  windows: {
    readonly hypervisorPresent?: boolean;
    readonly vmmsRunning?: boolean;
    readonly windowsEdition?: string;
    readonly hyperVSkuSupported?: boolean;
    readonly reason?: string;
  },
): SandboxHostProbe {
  const isolationReady =
    windows.hyperVSkuSupported !== false &&
    windows.hypervisorPresent === true &&
    windows.vmmsRunning === true &&
    sandboxProbe.isAvailable;
  const reason = isolationReady ? undefined : combineReason(windows.reason, sandboxProbe);
  return {
    platform,
    isolation,
    isolationReady,
    dockerAvailable: sandboxProbe.isAvailable,
    ...(windows.hypervisorPresent !== undefined
      ? { hypervisorPresent: windows.hypervisorPresent }
      : {}),
    ...(windows.vmmsRunning !== undefined ? { vmmsRunning: windows.vmmsRunning } : {}),
    ...(windows.windowsEdition !== undefined ? { windowsEdition: windows.windowsEdition } : {}),
    ...(windows.hyperVSkuSupported !== undefined
      ? { hyperVSkuSupported: windows.hyperVSkuSupported }
      : {}),
    ...(sandboxProbe.isolation !== "unsupported"
      ? { dockerIsolation: sandboxProbe.isolation }
      : {}),
    ...(reason !== undefined ? { reason } : {}),
  };
}

function assembleLinuxProbe(
  platform: string,
  isolation: SandboxIsolation,
  sandboxProbe: OsSandboxProbe,
  linux: { readonly runscPresent: boolean; readonly reason?: string },
  extras: {
    readonly windowsEdition?: string;
    readonly hyperVSkuSupported?: boolean;
    readonly wslDistro?: string;
  } = {},
): SandboxHostProbe {
  const runscPresent =
    linux.runscPresent || (sandboxProbe.isAvailable && sandboxProbe.isolation === "runsc");
  const isolationReady = runscPresent && sandboxProbe.isAvailable;
  const reason = isolationReady ? undefined : combineReason(linux.reason, sandboxProbe);
  return {
    platform,
    isolation,
    isolationReady,
    dockerAvailable: sandboxProbe.isAvailable,
    runscPresent,
    dockerIsolation: sandboxProbe.isolation,
    ...(extras.windowsEdition !== undefined ? { windowsEdition: extras.windowsEdition } : {}),
    ...(extras.hyperVSkuSupported !== undefined
      ? { hyperVSkuSupported: extras.hyperVSkuSupported }
      : {}),
    ...(extras.wslDistro !== undefined ? { wslDistro: extras.wslDistro } : {}),
    ...(reason !== undefined ? { reason } : {}),
  };
}

export function assertSandboxIsolation(
  probe: SandboxHostProbe,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!sandboxIsolationRequired(env)) {
    return;
  }
  if (!probe.isolationReady) {
    throw new Error(
      `OS sandbox fail-closed: ${probe.reason ?? `${probe.isolation} isolation is not ready`}`,
    );
  }
}
