import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { ContentDigest } from "@cantilune/core";
import { contentDigest } from "@cantilune/core";
import {
  benchmarkCaseId,
  benchmarkSuiteId,
  evaluationClaimId,
  evaluationProtocolId,
} from "../foundation/evaluationIds.js";
import type { BenchmarkCase, BenchmarkSuite } from "../benchmarks/benchmarkSuite.js";

export const CANTILUNE_L7_TWENTY_SUITE_ID = "cantilune-l7-20";
export const CANTILUNE_L7_TWENTY_PROTOCOL_ID = "evaluation.protocol.cantilune-l7-20";

export type L7Domain = "software" | "science" | "commerce" | "media" | "systems";
export type L7NetworkPolicy = "deny" | "allowlist";

export interface L7ManifestTask {
  readonly id: string;
  readonly slug: string;
  readonly domain: L7Domain;
  readonly title: string;
  readonly minPeers: number;
  readonly minTurns: number;
  readonly requireComms: boolean;
  readonly networkPolicy: L7NetworkPolicy;
  readonly filesystemPolicy: string;
  readonly engineeringTimeoutMs: number;
}

export interface L7SuiteManifest {
  readonly suiteId: string;
  readonly suiteVersion: number;
  readonly protocolId: string;
  readonly status: string;
  readonly name: string;
  readonly claimRefs: readonly string[];
  readonly isolationRoot: string;
  readonly sourceRoot: string;
  readonly runPolicy: string;
  readonly passAtK: number;
  readonly tasks: readonly L7ManifestTask[];
}

export interface L7TaskCheckpoint {
  readonly taskId: string;
  readonly failClosed: boolean;
  readonly minPeers: number;
  readonly minTurns: number;
  readonly requireActivate: boolean;
  readonly requireComms: boolean;
  readonly requireObserve: boolean;
  readonly forbidSelfScore: boolean;
  readonly requiredArtifacts: readonly string[];
  readonly requiredGlobs: readonly string[];
}

export interface L7TaskSpec {
  readonly id: string;
  readonly slug: string;
  readonly domain: L7Domain;
  readonly title: string;
  readonly networkPolicy: L7NetworkPolicy;
  readonly filesystemPolicy: string;
  readonly engineeringTimeoutMs: number;
  readonly briefPath: string;
  readonly checkpointPath: string;
  readonly brief: string;
  readonly checkpoint: L7TaskCheckpoint;
}

export interface L7LoadedSuite {
  readonly suiteRoot: string;
  readonly manifest: L7SuiteManifest;
  readonly tasks: readonly L7TaskSpec[];
  readonly fingerprints: Readonly<Record<string, string>>;
  readonly benchmark: BenchmarkSuite;
}

export interface L7TwentyRunArgs {
  readonly provider?: string;
  readonly model?: string;
  readonly baseUrl?: string;
  readonly fromId?: string;
  readonly toId?: string;
  readonly runId?: string;
  readonly maxTurns?: number;
  readonly maxTimeMs?: number;
  readonly scoreOnlyDir?: string;
  readonly planOnly: boolean;
  readonly passAtK: number;
}

export interface L7RunResultDump {
  readonly ok?: boolean;
  readonly summary?: string;
  readonly turns?: number;
  readonly elapsedMs?: number;
  readonly operations?: { readonly committed?: number; readonly rejected?: number };
}

export interface L7SwarmStatusDump {
  readonly running?: boolean;
  readonly startedTotal?: number;
  readonly completedTotal?: number;
  readonly consumedTurns?: number;
  readonly agentStarted?: number;
}

export interface L7TaskEvidence {
  readonly workspaceDir: string;
  readonly suiteRoot: string;
  readonly taskId: string;
  readonly suiteFingerprints: Readonly<Record<string, string>>;
  readonly scorerSourcePaths: readonly string[];
  readonly result?: L7RunResultDump;
  readonly swarmStatus?: L7SwarmStatusDump;
  readonly durableBundlePath?: string;
  readonly clusterEventsPath?: string;
  readonly principalId?: string;
}

const TASK_ID_RE = /^T(0[1-9]|1[0-9]|20)$/;
const FORBIDDEN_WORKSPACE_NAMES = new Set([
  "checkpoint.json",
  "PROTOCOL.md",
  "evaluateL7TwentyCheckpoint.ts",
  "cantiluneL7Twenty.ts",
]);

function digestOf(payload: unknown): ContentDigest {
  const hex = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return contentDigest(hex);
}

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function posixRel(from: string, to: string): string {
  return relative(from, to).split(sep).join("/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function requireString(record: Record<string, unknown>, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path}: missing string ${key}`);
  }
  return value;
}

function requireNumber(record: Record<string, unknown>, key: string, path: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path}: missing number ${key}`);
  }
  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string, path: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new Error(`${path}: missing boolean ${key}`);
  }
  return value;
}

function requireStringArray(
  record: Record<string, unknown>,
  key: string,
  path: string,
): readonly string[] {
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${path}: missing string[] ${key}`);
  }
  return value;
}

export function parsePositiveInt(text: string | undefined): number | undefined {
  if (text === undefined || text.length === 0) return undefined;
  const value = Number(text);
  if (!Number.isInteger(value) || value <= 0) return undefined;
  return value;
}

export function parseL7TwentyRunArgs(argv: readonly string[]): L7TwentyRunArgs {
  let provider: string | undefined;
  let model: string | undefined;
  let baseUrl: string | undefined;
  let fromId: string | undefined;
  let toId: string | undefined;
  let runId: string | undefined;
  let maxTurns: number | undefined;
  let maxTimeMs: number | undefined;
  let scoreOnlyDir: string | undefined;
  let planOnly = false;
  let passAtK = 1;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--provider") provider = argv[i + 1] ?? provider;
    else if (arg === "--model") model = argv[i + 1] ?? model;
    else if (arg === "--base-url") baseUrl = argv[i + 1] ?? baseUrl;
    else if (arg === "--from") fromId = argv[i + 1] ?? fromId;
    else if (arg === "--to") toId = argv[i + 1] ?? toId;
    else if (arg === "--run-id") runId = argv[i + 1] ?? runId;
    else if (arg === "--max-turns") maxTurns = parsePositiveInt(argv[i + 1]);
    else if (arg === "--max-time-ms") maxTimeMs = parsePositiveInt(argv[i + 1]);
    else if (arg === "--score-only") scoreOnlyDir = argv[i + 1] ?? scoreOnlyDir;
    else if (arg === "--k") passAtK = parsePositiveInt(argv[i + 1]) ?? 1;
    else if (arg === "--plan-only") {
      planOnly = true;
      continue;
    } else {
      continue;
    }
    i += 1;
  }

  return {
    ...(provider !== undefined ? { provider } : {}),
    ...(model !== undefined ? { model } : {}),
    ...(baseUrl !== undefined ? { baseUrl } : {}),
    ...(fromId !== undefined ? { fromId } : {}),
    ...(toId !== undefined ? { toId } : {}),
    ...(runId !== undefined ? { runId } : {}),
    ...(maxTurns !== undefined ? { maxTurns } : {}),
    ...(maxTimeMs !== undefined ? { maxTimeMs } : {}),
    ...(scoreOnlyDir !== undefined ? { scoreOnlyDir } : {}),
    planOnly,
    passAtK,
  };
}

export function planL7TwentyRun(
  tasks: readonly L7TaskSpec[],
  args: Pick<L7TwentyRunArgs, "fromId" | "toId">,
): readonly L7TaskSpec[] {
  if (tasks.length === 0) {
    throw new Error("L7-20 suite has no tasks");
  }
  const ids = tasks.map((task) => task.id);
  const fromId = args.fromId ?? tasks[0]!.id;
  const toId = args.toId ?? tasks[tasks.length - 1]!.id;
  const fromIndex = ids.indexOf(fromId);
  const toIndex = ids.indexOf(toId);
  if (fromIndex < 0) throw new Error(`unknown --from task ${fromId}`);
  if (toIndex < 0) throw new Error(`unknown --to task ${toId}`);
  if (fromIndex > toIndex) {
    throw new Error(`--from ${fromId} is after --to ${toId}`);
  }
  return tasks.slice(fromIndex, toIndex + 1);
}

function parseManifestTask(value: unknown, index: number): L7ManifestTask {
  if (!isRecord(value)) throw new Error(`manifest.tasks[${index}] must be an object`);
  const domain = requireString(value, "domain", `manifest.tasks[${index}]`);
  const networkPolicy = requireString(value, "networkPolicy", `manifest.tasks[${index}]`);
  if (
    domain !== "software" &&
    domain !== "science" &&
    domain !== "commerce" &&
    domain !== "media" &&
    domain !== "systems"
  ) {
    throw new Error(`manifest.tasks[${index}].domain is not a known domain`);
  }
  if (networkPolicy !== "deny" && networkPolicy !== "allowlist") {
    throw new Error(`manifest.tasks[${index}].networkPolicy must be deny|allowlist`);
  }
  return {
    id: requireString(value, "id", `manifest.tasks[${index}]`),
    slug: requireString(value, "slug", `manifest.tasks[${index}]`),
    domain,
    title: requireString(value, "title", `manifest.tasks[${index}]`),
    minPeers: requireNumber(value, "minPeers", `manifest.tasks[${index}]`),
    minTurns: requireNumber(value, "minTurns", `manifest.tasks[${index}]`),
    requireComms: requireBoolean(value, "requireComms", `manifest.tasks[${index}]`),
    networkPolicy,
    filesystemPolicy: requireString(value, "filesystemPolicy", `manifest.tasks[${index}]`),
    engineeringTimeoutMs: requireNumber(value, "engineeringTimeoutMs", `manifest.tasks[${index}]`),
  };
}

export function parseL7SuiteManifest(value: unknown): L7SuiteManifest {
  if (!isRecord(value)) throw new Error("suite.manifest.json must be an object");
  const tasksRaw = value["tasks"];
  if (!Array.isArray(tasksRaw) || tasksRaw.length === 0) {
    throw new Error("suite.manifest.json: tasks must be a non-empty array");
  }
  const claimRefs = value["claimRefs"];
  if (!Array.isArray(claimRefs) || claimRefs.some((item) => typeof item !== "string")) {
    throw new Error("suite.manifest.json: claimRefs must be string[]");
  }
  return {
    suiteId: requireString(value, "suiteId", "manifest"),
    suiteVersion: requireNumber(value, "suiteVersion", "manifest"),
    protocolId: requireString(value, "protocolId", "manifest"),
    status: requireString(value, "status", "manifest"),
    name: requireString(value, "name", "manifest"),
    claimRefs,
    isolationRoot: requireString(value, "isolationRoot", "manifest"),
    sourceRoot: requireString(value, "sourceRoot", "manifest"),
    runPolicy: requireString(value, "runPolicy", "manifest"),
    passAtK: requireNumber(value, "passAtK", "manifest"),
    tasks: tasksRaw.map(parseManifestTask),
  };
}

export function parseL7TaskCheckpoint(value: unknown, expectedId: string): L7TaskCheckpoint {
  if (!isRecord(value)) throw new Error(`${expectedId} checkpoint must be an object`);
  const taskId = requireString(value, "taskId", expectedId);
  if (taskId !== expectedId) {
    throw new Error(`${expectedId} checkpoint.taskId is ${taskId}`);
  }
  return {
    taskId,
    failClosed: requireBoolean(value, "failClosed", expectedId),
    minPeers: requireNumber(value, "minPeers", expectedId),
    minTurns: requireNumber(value, "minTurns", expectedId),
    requireActivate: requireBoolean(value, "requireActivate", expectedId),
    requireComms: requireBoolean(value, "requireComms", expectedId),
    requireObserve: requireBoolean(value, "requireObserve", expectedId),
    forbidSelfScore: requireBoolean(value, "forbidSelfScore", expectedId),
    requiredArtifacts: requireStringArray(value, "requiredArtifacts", expectedId),
    requiredGlobs: requireStringArray(value, "requiredGlobs", expectedId),
  };
}

export function fingerprintSuiteSources(
  suiteRoot: string,
  extraPaths: readonly string[] = [],
): Record<string, string> {
  const fingerprints: Record<string, string> = {};
  const protocol = join(suiteRoot, "PROTOCOL.md");
  const manifest = join(suiteRoot, "suite.manifest.json");
  if (existsSync(protocol)) fingerprints[posixRel(suiteRoot, protocol)] = sha256File(protocol);
  if (existsSync(manifest)) fingerprints[posixRel(suiteRoot, manifest)] = sha256File(manifest);
  const tasksDir = join(suiteRoot, "tasks");
  if (existsSync(tasksDir)) {
    for (const entry of readdirSync(tasksDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      for (const name of ["brief.md", "checkpoint.json"] as const) {
        const path = join(tasksDir, entry.name, name);
        if (existsSync(path)) fingerprints[posixRel(suiteRoot, path)] = sha256File(path);
      }
    }
  }
  for (const extra of extraPaths) {
    if (existsSync(extra)) fingerprints[extra] = sha256File(extra);
  }
  return fingerprints;
}

function loadTaskSpec(suiteRoot: string, task: L7ManifestTask): L7TaskSpec {
  if (!TASK_ID_RE.test(task.id)) {
    throw new Error(`invalid task id ${task.id}`);
  }
  const dir = join(suiteRoot, "tasks", `${task.id}-${task.slug}`);
  const briefPath = join(dir, "brief.md");
  const checkpointPath = join(dir, "checkpoint.json");
  if (!existsSync(briefPath)) throw new Error(`missing brief for ${task.id}: ${briefPath}`);
  if (!existsSync(checkpointPath)) {
    throw new Error(`missing checkpoint for ${task.id}: ${checkpointPath}`);
  }
  const checkpoint = parseL7TaskCheckpoint(readJsonFile(checkpointPath), task.id);
  return {
    id: task.id,
    slug: task.slug,
    domain: task.domain,
    title: task.title,
    networkPolicy: task.networkPolicy,
    filesystemPolicy: task.filesystemPolicy,
    engineeringTimeoutMs: task.engineeringTimeoutMs,
    briefPath,
    checkpointPath,
    brief: readFileSync(briefPath, "utf8"),
    checkpoint,
  };
}

function toBenchmarkCase(
  suiteId: ReturnType<typeof benchmarkSuiteId>,
  spec: L7TaskSpec,
): BenchmarkCase {
  return {
    caseId: benchmarkCaseId(spec.id),
    suiteId,
    caseVersion: 1,
    caseKind: "modelBacked",
    claimRefs: [
      evaluationClaimId("evaluation.c1"),
      evaluationClaimId("evaluation.c2"),
      evaluationClaimId("evaluation.c5"),
    ],
    tags: [spec.domain, spec.slug, "l7-20"],
    stratum: "wave1",
    inputArtifactRefs: [`l7-20:${spec.id}:brief`],
    initialSnapshotRef: "snap:t0",
    schemaBindingRef: "schema:production",
    policyRef: "policy:template-aware",
    requiredCapabilities: ["register_participant", "activate_participant", "write_content"],
    requiredTools: ["filesystem", "shell"],
    networkPolicy: spec.networkPolicy,
    filesystemPolicy: spec.filesystemPolicy,
    semanticOracleRefs: [],
    successPredicateRef: `l7-20:${spec.id}:checkpoint`,
    expectedTerminalClasses: ["measured"],
    resourceCaps: {
      maxTokensInput: 200_000,
      maxTokensOutput: 64_000,
      maxToolCalls: 2_000,
      maxNetworkRequests: spec.networkPolicy === "deny" ? 0 : 200,
      maxFilesystemOps: 10_000,
      maxCostCents: 0,
    },
    maxStructuralSteps: spec.checkpoint.minTurns,
    maxExecutionEpochs: 1,
    engineeringTimeout: spec.engineeringTimeoutMs,
    redactionPolicyRef: "redact:eval",
    caseDigest: digestOf({ id: spec.id, slug: spec.slug, checkpoint: spec.checkpoint }),
  };
}

export function loadCantiluneL7TwentySuite(suiteRoot: string): L7LoadedSuite {
  const manifestPath = join(suiteRoot, "suite.manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`L7-20 suite root is missing suite.manifest.json: ${suiteRoot}`);
  }
  const manifest = parseL7SuiteManifest(readJsonFile(manifestPath));
  if (manifest.suiteId !== CANTILUNE_L7_TWENTY_SUITE_ID) {
    throw new Error(`unexpected suiteId ${manifest.suiteId}`);
  }
  if (manifest.protocolId !== CANTILUNE_L7_TWENTY_PROTOCOL_ID) {
    throw new Error(`unexpected protocolId ${manifest.protocolId}`);
  }
  if (manifest.tasks.length !== 20) {
    throw new Error(`L7-20 suite must declare 20 tasks, found ${manifest.tasks.length}`);
  }
  const seen = new Set<string>();
  for (const task of manifest.tasks) {
    if (seen.has(task.id)) throw new Error(`duplicate task id ${task.id}`);
    seen.add(task.id);
  }
  const tasks = manifest.tasks.map((task) => loadTaskSpec(suiteRoot, task));
  const suiteId = benchmarkSuiteId(manifest.suiteId);
  const cases = tasks.map((task) => toBenchmarkCase(suiteId, task));
  const benchmark: BenchmarkSuite = {
    suiteId,
    suiteVersion: manifest.suiteVersion,
    name: manifest.name,
    description: "Proposed L7-20 long-horizon swarm suite. Not a public claim.",
    claimRefs: manifest.claimRefs.map((ref) => evaluationClaimId(ref)),
    caseManifestRefs: cases.map((item) => item.caseId),
    datasetRefs: [],
    coverageTaxonomy: ["software", "science", "commerce", "media", "systems"],
    requiredStrata: ["wave1"],
    samplingPolicy: "all",
    defaultRunPolicy: manifest.runPolicy,
    defaultScoringPolicy: "l7-20-checkpoint",
    defaultBudgetPolicy: "engineering-timeout",
    provenanceRef: evaluationProtocolId(manifest.protocolId),
    licenseRef: "Apache-2.0",
    privacyReviewRef: "synthetic-only",
    suiteDigest: digestOf({ suiteId: manifest.suiteId, tasks: tasks.map((task) => task.id) }),
    status: "draft",
    frozenAt: undefined,
    supersedes: undefined,
  };
  return {
    suiteRoot,
    manifest,
    tasks,
    fingerprints: fingerprintSuiteSources(suiteRoot),
    benchmark,
  };
}

/** @deprecated Use {@link loadCantiluneL7TwentySuite} */
export function createCantiluneL7TwentySuite(suiteRoot: string): L7LoadedSuite {
  return loadCantiluneL7TwentySuite(suiteRoot);
}

export function composeL7TwentyInstruction(spec: L7TaskSpec): string {
  const commsLine = spec.checkpoint.requireComms
    ? "必须至少建立一条通信会话（create_session 或 comms 投递），否则任务失败。"
    : "通信会话按任务需要自决。";
  return [
    `Cantilune L7-20 任务 ${spec.id}（${spec.title}）。`,
    "你在真实 Cantilune OS 中工作。这是一个多 Agent swarm 任务：你必须先 write_content 写 AgentManifest，再 register_participant，再 activate_participant，组建 swarm 后由 peer 协作完成 Wave-1。",
    "直接用 filesystem 工具自己写所有产物而不组建 swarm，视为任务失败——本任务评测的就是 swarm 自构建与协作能力。",
    "集群拓扑（角色、编制、串/并/反馈环）由你自决，但必须有 swarm：先建 swarm，再分配任务给 peer。",
    "startCondition 必须是表达式树（operator/atom/evaluator），不能写自然语言；缺省或无法解析视为 always。",
    "Wave-1 列出的路径是工作区相对路径，目录类产物写在 artifacts/ 下（例如 artifacts/legacy/），不要写到工作区根。peer 也可写 artifacts/。",
    "Wave-1 每个产物必须用 filesystem 工具写成磁盘文件（路径以 artifacts/ 开头），不是 write_content + introduce_artifact——评分器只认磁盘文件。",
    "brief 中列出的每个产物路径必须各自独立存在为一个非空磁盘文件；不能把多个产物的内容合并到一个文件里。逐项检查 brief 的 Wave-1 清单，每条对应一个文件。",
    "你必须确保 brief 中 Wave-1 列出的每一个产物都有 peer 负责或你自己完成，缺一个即任务失败。",
    "不要要求用户执行 /swarm、/cluster 或任何 slash 命令，也不要只口头讲解工具。",
    "所有文件写在当前工作区。不要改 checkpoint.json、PROTOCOL.md 或评分源码。",
    `硬性门禁：必须 register + activate 至少 ${spec.checkpoint.minPeers} 个非发起方 active peer，至少 ${spec.checkpoint.minTurns} 轮（含 peer 轮次），否则任务失败。`,
    commsLine,
    "目标合同是全愿景；本轮必须交付 brief 中 Wave-1 列出的产物。由 peer 分工完成，不要全部自己写。",
    "",
    spec.brief,
  ].join("\n");
}

export function listWorkspaceFiles(root: string): readonly string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "runtime" || entry.name === "content" || entry.name === "node_modules") {
          continue;
        }
        walk(full);
        continue;
      }
      if (entry.isFile()) files.push(posixRel(root, full));
    }
  };
  walk(root);
  return files;
}

export function globHasMatch(relativeFiles: readonly string[], pattern: string): boolean {
  const normalized = pattern.split(sep).join("/");
  if (normalized.endsWith("/**")) {
    const prefix = normalized.slice(0, -3);
    const needle = prefix.endsWith("/") ? prefix : `${prefix}/`;
    return relativeFiles.some((file) => file.startsWith(needle) && file.length > needle.length);
  }
  return relativeFiles.includes(normalized);
}

export function workspaceHasForbiddenScorerName(relativeFiles: readonly string[]): boolean {
  return relativeFiles.some((file) => {
    const base = file.split("/").pop() ?? file;
    return FORBIDDEN_WORKSPACE_NAMES.has(base);
  });
}

function readOptionalJson(path: string | undefined): unknown {
  if (path === undefined || !existsSync(path)) return undefined;
  try {
    return readJsonFile(path);
  } catch {
    return undefined;
  }
}

/**
 * Recover a headless RunResult from captured stdout.
 *
 * `--json` used to pretty-print, so a line-oriented collector that looked for
 * `{...turns...}` on one line silently stored `turns: 0`. Parse the last
 * complete object that names `turns` instead of trusting a single line.
 */
export function extractRunResultJson(stdout: string): unknown | undefined {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    const value = JSON.parse(stdout.slice(start, end + 1)) as unknown;
    if (isRecord(value) && typeof value["turns"] === "number") return value;
  } catch {
    return undefined;
  }
  return undefined;
}

function asRunResult(value: unknown): L7RunResultDump | undefined {
  if (!isRecord(value)) return undefined;
  if (value["summary"] === "no-json-result") return undefined;
  const operations = isRecord(value["operations"]) ? value["operations"] : undefined;
  return {
    ...(typeof value["ok"] === "boolean" ? { ok: value["ok"] } : {}),
    ...(typeof value["summary"] === "string" ? { summary: value["summary"] } : {}),
    ...(typeof value["turns"] === "number" ? { turns: value["turns"] } : {}),
    ...(typeof value["elapsedMs"] === "number" ? { elapsedMs: value["elapsedMs"] } : {}),
    ...(operations !== undefined
      ? {
          operations: {
            ...(typeof operations["committed"] === "number"
              ? { committed: operations["committed"] }
              : {}),
            ...(typeof operations["rejected"] === "number"
              ? { rejected: operations["rejected"] }
              : {}),
          },
        }
      : {}),
  };
}

function asSwarmStatus(value: unknown): L7SwarmStatusDump | undefined {
  if (!isRecord(value)) return undefined;
  const scheduler = isRecord(value["scheduler"]) ? value["scheduler"] : undefined;
  return {
    ...(typeof value["running"] === "boolean" ? { running: value["running"] } : {}),
    ...(typeof scheduler?.["startedTotal"] === "number"
      ? { startedTotal: scheduler["startedTotal"] }
      : typeof value["startedTotal"] === "number"
        ? { startedTotal: value["startedTotal"] }
        : {}),
    ...(typeof scheduler?.["completedTotal"] === "number"
      ? { completedTotal: scheduler["completedTotal"] }
      : typeof value["completedTotal"] === "number"
        ? { completedTotal: value["completedTotal"] }
        : {}),
    ...(typeof scheduler?.["consumedTurns"] === "number"
      ? { consumedTurns: scheduler["consumedTurns"] }
      : typeof value["consumedTurns"] === "number"
        ? { consumedTurns: value["consumedTurns"] }
        : {}),
    ...(typeof value["agentStarted"] === "number" ? { agentStarted: value["agentStarted"] } : {}),
  };
}

function firstExisting(paths: readonly string[]): string | undefined {
  return paths.find((path) => existsSync(path));
}

export function collectL7TwentyEvidence(input: {
  readonly workspaceDir: string;
  readonly suiteRoot: string;
  readonly taskId: string;
  readonly suiteFingerprints: Readonly<Record<string, string>>;
  readonly scorerSourcePaths?: readonly string[];
  readonly principalId?: string;
}): L7TaskEvidence {
  const workspaceDir = input.workspaceDir;
  const resultPath = firstExisting([
    join(workspaceDir, "result.json"),
    join(workspaceDir, "eval-trace", "result.json"),
  ]);
  const swarmPath = firstExisting([
    join(workspaceDir, "swarm-status.json"),
    join(workspaceDir, "eval-trace", "swarm-status.json"),
  ]);
  const durableBundlePath = firstExisting([
    join(workspaceDir, "runtime", "durable.bundle.json"),
    join(workspaceDir, "os", "runtime", "durable.bundle.json"),
  ]);
  const clusterEventsPath = firstExisting([
    join(workspaceDir, "cluster-events.jsonl"),
    join(workspaceDir, "eval-trace", "cluster-events.jsonl"),
    join(workspaceDir, "events.jsonl"),
  ]);
  const result = asRunResult(readOptionalJson(resultPath));
  const swarmStatus = asSwarmStatus(readOptionalJson(swarmPath));
  return {
    workspaceDir,
    suiteRoot: input.suiteRoot,
    taskId: input.taskId,
    suiteFingerprints: input.suiteFingerprints,
    scorerSourcePaths: input.scorerSourcePaths ?? [],
    ...(result !== undefined ? { result } : {}),
    ...(swarmStatus !== undefined ? { swarmStatus } : {}),
    ...(durableBundlePath !== undefined ? { durableBundlePath } : {}),
    ...(clusterEventsPath !== undefined ? { clusterEventsPath } : {}),
    ...(input.principalId !== undefined ? { principalId: input.principalId } : {}),
  };
}

export function fileIsNonEmpty(path: string): boolean {
  if (!existsSync(path)) return false;
  return statSync(path).size > 0;
}

export function isL7TaskId(id: string): boolean {
  return TASK_ID_RE.test(id);
}
