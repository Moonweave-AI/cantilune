import { spawn } from "node:child_process";

export type SandboxIsolation = "hyperv" | "runsc" | "unsupported";

export interface DockerRunOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly stdin?: string;
}

export interface DockerRunResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

/** Injected docker CLI port so unit tests never need a real daemon. */
export interface DockerRunner {
  run(argv: readonly string[], options?: DockerRunOptions): Promise<DockerRunResult>;
}

export interface OsSandboxProbe {
  readonly isAvailable: boolean;
  readonly platform: string;
  readonly isolation: SandboxIsolation;
  readonly reason?: string;
}

export interface OsSandboxRunOptions {
  readonly cwd?: string;
  readonly env?: Record<string, string>;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly stdin?: string;
}

export interface OsSandboxRunResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export interface SandboxSpawnInvocation {
  readonly command: string;
  readonly args: readonly string[];
}

export interface OsSandbox {
  readonly isAvailable: boolean;
  readonly platform: string;
  readonly isolation: SandboxIsolation;
  probe(): Promise<OsSandboxProbe>;
  run(
    command: string,
    args: readonly string[],
    options?: OsSandboxRunOptions,
  ): Promise<OsSandboxRunResult>;
  /**
   * Fail-closed docker argv for long-lived stdio children (MCP).
   * Never returns a host binary when the sandbox is unavailable.
   */
  wrapSpawn(command: string, args?: readonly string[]): SandboxSpawnInvocation;
}

export interface CreateOsSandboxOptions {
  readonly platform?: string;
  readonly runner?: DockerRunner;
  readonly image?: string;
  /** Docker context for the Windows engine (`desktop-windows`) vs Linux compose. */
  readonly dockerContext?: string;
  /** Explicit isolation; otherwise `CANTILUNE_SANDBOX_ISOLATION` then platform default. */
  readonly isolation?: SandboxIsolation | string;
  /**
   * WSL distro that runs Docker Engine + official `runsc` (Linux isolation on a
   * Windows operator host). Never reported as Hyper-V.
   */
  readonly wslDistro?: string;
}

export const DEFAULT_SANDBOX_IMAGE_LINUX = "alpine:3.20";
export const DEFAULT_SANDBOX_IMAGE_WIN32 = "mcr.microsoft.com/windows/nanoserver:ltsc2022";

const UNAVAILABLE_MESSAGE = "OsSandbox unavailable: refusing host execution (ADR-0024 fail-closed)";

export function isolationForPlatform(
  platform: string,
  override: string | undefined = undefined,
): SandboxIsolation {
  const requested = override?.trim().toLowerCase();
  if (requested === "hyperv" || requested === "runsc" || requested === "unsupported") {
    return requested;
  }
  if (platform === "win32") return "hyperv";
  if (platform === "linux") return "runsc";
  return "unsupported";
}

export function isolationArgs(isolation: SandboxIsolation): readonly string[] {
  if (isolation === "hyperv") return ["--isolation=hyperv"];
  if (isolation === "runsc") return ["--runtime=runsc"];
  return [];
}

export function defaultSandboxImage(platform: string): string {
  return platform === "win32" ? DEFAULT_SANDBOX_IMAGE_WIN32 : DEFAULT_SANDBOX_IMAGE_LINUX;
}

export interface CreateProcessDockerRunnerOptions {
  readonly dockerContext?: string;
}

function runSpawnedProcess(
  command: string,
  argv: readonly string[],
  runOptions?: DockerRunOptions,
): Promise<DockerRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...argv], {
      windowsHide: true,
      env: runOptions?.env !== undefined ? { ...process.env, ...runOptions.env } : process.env,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const finish = (exitCode: number): void => {
      if (settled) return;
      settled = true;
      runOptions?.signal?.removeEventListener("abort", onAbort);
      if (timedOut) {
        reject(new Error(`${command} timed out after ${runOptions?.timeoutMs ?? 0}ms`));
        return;
      }
      if (runOptions?.signal?.aborted === true) {
        reject(new Error(`${command} aborted`));
        return;
      }
      resolve({ stdout, stderr, exitCode });
    };

    const onAbort = (): void => {
      child.kill("SIGTERM");
    };
    runOptions?.signal?.addEventListener("abort", onAbort, { once: true });

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (runOptions?.timeoutMs !== undefined) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, runOptions.timeoutMs);
    }

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      if (timer !== undefined) clearTimeout(timer);
      runOptions?.signal?.removeEventListener("abort", onAbort);
      if (settled) return;
      settled = true;
      reject(error);
    });
    child.on("close", (code) => {
      if (timer !== undefined) clearTimeout(timer);
      finish(code ?? 1);
    });

    if (runOptions?.stdin !== undefined && child.stdin !== null) {
      child.stdin.write(runOptions.stdin);
      child.stdin.end();
    }
  });
}

export function createProcessDockerRunner(
  options: CreateProcessDockerRunnerOptions = {},
): DockerRunner {
  const context = options.dockerContext?.trim();
  return {
    run(argv, runOptions) {
      const prefixed =
        context !== undefined && context.length > 0 ? ["-c", context, ...argv] : [...argv];
      return runSpawnedProcess("docker", prefixed, runOptions);
    },
  };
}

export function createWslDockerRunner(distro: string): DockerRunner {
  const name = distro.trim();
  if (name.length === 0) {
    throw new Error("WSL distro name is required for Linux runsc on Windows");
  }
  return {
    run(argv, runOptions) {
      return runSpawnedProcess("wsl", ["-d", name, "-u", "root", "--", "docker", ...argv], {
        ...runOptions,
        env: { WSL_UTF8: "1", ...runOptions?.env },
      });
    },
  };
}

export function createOsSandbox(options: CreateOsSandboxOptions = {}): OsSandbox {
  const platform = options.platform ?? process.platform;
  const isolation = isolationForPlatform(
    platform,
    options.isolation ?? process.env.CANTILUNE_SANDBOX_ISOLATION,
  );
  const wslDistro = (options.wslDistro ?? process.env.CANTILUNE_SANDBOX_WSL_DISTRO)?.trim();
  const image =
    options.image ??
    (isolation === "runsc" ? DEFAULT_SANDBOX_IMAGE_LINUX : defaultSandboxImage(platform));
  const dockerContext = options.dockerContext ?? process.env.CANTILUNE_DOCKER_CONTEXT;
  const runner =
    options.runner ??
    (wslDistro !== undefined && wslDistro.length > 0
      ? createWslDockerRunner(wslDistro)
      : createProcessDockerRunner({
          ...(dockerContext !== undefined && dockerContext.trim().length > 0
            ? { dockerContext: dockerContext.trim() }
            : {}),
        }));

  function withContext(argv: readonly string[]): string[] {
    const context = dockerContext?.trim();
    if (context === undefined || context.length === 0 || options.runner === undefined) {
      return [...argv];
    }
    return ["-c", context, ...argv];
  }

  let available = false;
  let probed = false;
  let lastReason: string | undefined =
    isolation === "unsupported" ? `unsupported sandbox platform: ${platform}` : undefined;

  function requireAvailable(): void {
    if (!available) {
      throw new Error(
        lastReason !== undefined ? `${UNAVAILABLE_MESSAGE}: ${lastReason}` : UNAVAILABLE_MESSAGE,
      );
    }
  }

  function dockerRunArgv(
    command: string,
    args: readonly string[],
    runOptions: OsSandboxRunOptions | undefined,
    interactive: boolean,
  ): string[] {
    const envFlags: string[] = [];
    if (runOptions?.env !== undefined) {
      for (const [key, value] of Object.entries(runOptions.env)) {
        envFlags.push("-e", `${key}=${value}`);
      }
    }
    return [
      "run",
      "--rm",
      ...(interactive ? (["-i"] as const) : []),
      ...isolationArgs(isolation),
      ...(runOptions?.cwd !== undefined ? (["-w", runOptions.cwd] as const) : []),
      ...envFlags,
      image,
      command,
      ...args,
    ];
  }

  async function probe(): Promise<OsSandboxProbe> {
    probed = true;
    if (isolation === "unsupported") {
      available = false;
      lastReason = `unsupported sandbox platform: ${platform}`;
      return { isAvailable: false, platform, isolation, reason: lastReason };
    }

    try {
      const info = await runner.run(withContext(["info"]));
      if (info.exitCode !== 0) {
        available = false;
        lastReason = info.stderr.trim() || info.stdout.trim() || "docker info failed";
        return { isAvailable: false, platform, isolation, reason: lastReason };
      }

      const formatArgv =
        isolation === "hyperv"
          ? (["info", "--format", "{{.Isolation}}"] as const)
          : (["info", "--format", "{{json .Runtimes}}"] as const);
      let runtimeText = `${info.stdout}\n${info.stderr}`;
      try {
        const formatted = await runner.run(withContext(formatArgv));
        runtimeText += `\n${formatted.stdout}\n${formatted.stderr}`;
      } catch {
        // Format probe is advisory; docker info text is enough when present.
      }

      const marker = isolation === "hyperv" ? /hyperv/i : /runsc/i;
      if (!marker.test(runtimeText)) {
        available = false;
        lastReason = `required isolation ${isolation} not reported by docker info`;
        return { isAvailable: false, platform, isolation, reason: lastReason };
      }

      available = true;
      lastReason = undefined;
      return { isAvailable: true, platform, isolation };
    } catch (error) {
      available = false;
      lastReason = error instanceof Error ? error.message : String(error);
      return { isAvailable: false, platform, isolation, reason: lastReason };
    }
  }

  async function ensureProbed(): Promise<void> {
    if (!probed) {
      await probe();
    }
    requireAvailable();
  }

  return {
    get isAvailable() {
      return available;
    },
    platform,
    isolation,
    probe,
    async run(command, args, runOptions) {
      await ensureProbed();
      const argv = withContext(
        dockerRunArgv(command, args, runOptions, runOptions?.stdin !== undefined),
      );
      const result = await runner.run(argv, {
        ...(runOptions?.timeoutMs !== undefined ? { timeoutMs: runOptions.timeoutMs } : {}),
        ...(runOptions?.signal !== undefined ? { signal: runOptions.signal } : {}),
        ...(runOptions?.stdin !== undefined ? { stdin: runOptions.stdin } : {}),
        ...(runOptions?.env !== undefined ? { env: { ...process.env, ...runOptions.env } } : {}),
      });
      return result;
    },
    wrapSpawn(command, args = []) {
      if (!probed || !available) {
        throw new Error(
          lastReason !== undefined ? `${UNAVAILABLE_MESSAGE}: ${lastReason}` : UNAVAILABLE_MESSAGE,
        );
      }
      const dockerArgv = withContext(dockerRunArgv(command, args, undefined, true));
      if (wslDistro !== undefined && wslDistro.length > 0) {
        return {
          command: "wsl",
          args: ["-d", wslDistro, "-u", "root", "--", "docker", ...dockerArgv],
        };
      }
      return {
        command: "docker",
        args: dockerArgv,
      };
    },
  };
}
