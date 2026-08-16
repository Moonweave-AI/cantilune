import {
  postgresHaRequired,
  probePostgresHa,
  probeRaftCluster,
  raftRequired,
  type PostgresHaProbe,
  type ProbePostgresHaOptions,
  type ProbeRaftClusterOptions,
  type RaftClusterProbe,
} from "@cantilune/runtime/memory";
import {
  probeSandboxHost,
  sandboxIsolationRequired,
  type ProbeSandboxHostOptions,
  type SandboxHostProbe,
} from "@cantilune/tools";

export interface HostRequirements {
  readonly postgresHa: boolean;
  readonly raft: boolean;
  readonly sandbox: boolean;
  readonly multi: boolean;
}

export interface HostCapabilityReport {
  readonly platform: string;
  readonly postgres: PostgresHaProbe;
  readonly raft: RaftClusterProbe;
  readonly sandbox: SandboxHostProbe;
  readonly required: HostRequirements;
  readonly ok: boolean;
  readonly failClosedReasons: readonly string[];
}

export interface ProbeHostCapabilitiesOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly postgres?: ProbePostgresHaOptions;
  readonly raft?: ProbeRaftClusterOptions;
  readonly sandbox?: ProbeSandboxHostOptions;
}

export function hostRequirementsFromEnv(env: NodeJS.ProcessEnv = process.env): HostRequirements {
  return {
    postgresHa: postgresHaRequired(env),
    raft: raftRequired(env),
    sandbox: sandboxIsolationRequired(env),
    multi: env.CANTILUNE_HOST_MODE === "multi",
  };
}

export async function probeHostCapabilities(
  options: ProbeHostCapabilitiesOptions = {},
): Promise<HostCapabilityReport> {
  const env = options.env ?? process.env;
  const required = hostRequirementsFromEnv(env);
  const [postgres, raft, sandbox] = await Promise.all([
    probePostgresHa({ env, ...options.postgres }),
    probeRaftCluster({ env, ...options.raft }),
    probeSandboxHost(options.sandbox),
  ]);
  const failClosedReasons: string[] = [];
  if (required.postgresHa && !postgres.haReady) {
    failClosedReasons.push(`Postgres HA: ${postgres.reason ?? "not ready"}`);
  }
  if (required.raft && !raft.ready) {
    failClosedReasons.push(`etcd Raft: ${raft.reason ?? "not ready"}`);
  }
  if (required.multi && !postgres.haReady && !raft.ready) {
    failClosedReasons.push(
      `multi-host durable: ${postgres.reason ?? "Postgres HA not ready"}; ${raft.reason ?? "etcd Raft not ready"}`,
    );
  }
  if (required.sandbox && !sandbox.isolationReady) {
    failClosedReasons.push(`OS sandbox: ${sandbox.reason ?? "not ready"}`);
  }
  return {
    platform: sandbox.platform,
    postgres,
    raft,
    sandbox,
    required,
    ok: failClosedReasons.length === 0,
    failClosedReasons,
  };
}

export function assertHostCapabilities(report: HostCapabilityReport): void {
  if (!report.ok) {
    throw new Error(`host capability fail-closed:\n${report.failClosedReasons.join("\n")}`);
  }
}

export async function assertRequiredHostCapabilities(
  options: ProbeHostCapabilitiesOptions = {},
): Promise<HostCapabilityReport | undefined> {
  const env = options.env ?? process.env;
  const required = hostRequirementsFromEnv(env);
  if (!required.postgresHa && !required.raft && !required.sandbox && !required.multi) {
    return undefined;
  }
  const report = await probeHostCapabilities(options);
  assertHostCapabilities(report);
  return report;
}

function readinessLabel(ready: boolean, readyText: string, reason: string | undefined): string {
  if (ready) {
    return readyText;
  }
  return reason !== undefined ? `not-ready (${reason})` : "not-ready";
}

function optionalFlagLine(
  key: string,
  value: boolean | undefined,
  yes: string,
  no: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return `${key}: ${value ? yes : no}`;
}

export function formatHostCapabilityReport(report: HostCapabilityReport): string {
  const extras = [
    optionalFlagLine(
      "sandbox.hypervisorPresent",
      report.sandbox.hypervisorPresent,
      "true",
      "false",
    ),
    optionalFlagLine("sandbox.vmms", report.sandbox.vmmsRunning, "running", "not-running"),
    optionalFlagLine("sandbox.runsc", report.sandbox.runscPresent, "present", "absent"),
    optionalFlagLine(
      "sandbox.hyperVSku",
      report.sandbox.hyperVSkuSupported,
      "supported",
      "unsupported",
    ),
    report.sandbox.windowsEdition !== undefined
      ? `sandbox.windowsEdition: ${report.sandbox.windowsEdition}`
      : undefined,
    report.sandbox.wslDistro !== undefined
      ? `sandbox.wslDistro: ${report.sandbox.wslDistro}`
      : undefined,
  ].filter((line): line is string => line !== undefined);
  const firstRaft = report.raft.endpoints[0] ?? `${report.raft.host}:${String(report.raft.port)}`;
  const lines = [
    `platform: ${report.platform}`,
    `required.multi: ${report.required.multi ? "yes" : "no"}`,
    `required.postgresHa: ${report.required.postgresHa ? "yes" : "no"}`,
    `required.raft: ${report.required.raft ? "yes" : "no"}`,
    `required.sandbox: ${report.required.sandbox ? "yes" : "no"}`,
    `postgres.url: ${report.postgres.urlConfigured ? "set" : "unset"}`,
    `postgres.tcp: ${report.postgres.host}:${String(report.postgres.port)} ${report.postgres.tcpReachable ? "open" : "closed"}`,
    `postgres.ha: ${readinessLabel(report.postgres.haReady, "HA ready", report.postgres.reason)}`,
    `raft.endpoints: ${report.raft.endpointsConfigured ? firstRaft : "unset"}`,
    `raft.tcp: ${report.raft.host}:${String(report.raft.port)} ${report.raft.tcpReachable ? "open" : "closed"}`,
    `raft: ${readinessLabel(report.raft.ready, "etcd ready", report.raft.reason)}`,
    `sandbox.isolation: ${report.sandbox.isolation}`,
    `sandbox.docker: ${report.sandbox.dockerAvailable ? "available" : "unavailable"}`,
    ...extras,
    `sandbox: ${readinessLabel(report.sandbox.isolationReady, `${report.sandbox.isolation} ready`, report.sandbox.reason)}`,
    `ok: ${report.ok ? "yes" : "no"}`,
  ];
  return lines.join("\n");
}

export function isHostCapabilityReport(value: unknown): value is HostCapabilityReport {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.platform === "string" &&
    typeof record.postgres === "object" &&
    record.postgres !== null &&
    typeof record.raft === "object" &&
    record.raft !== null &&
    typeof record.sandbox === "object" &&
    record.sandbox !== null &&
    typeof record.ok === "boolean"
  );
}
