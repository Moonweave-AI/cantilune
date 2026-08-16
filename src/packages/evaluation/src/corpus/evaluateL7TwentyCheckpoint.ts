import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  collectL7TwentyEvidence,
  fingerprintSuiteSources,
  fileIsNonEmpty,
  globHasMatch,
  listWorkspaceFiles,
  sha256File,
  workspaceHasForbiddenScorerName,
  type L7TaskCheckpoint,
  type L7TaskEvidence,
  type L7TaskSpec,
} from "./cantiluneL7Twenty.js";

export type L7GateId =
  | "swarmFanout"
  | "activateLoop"
  | "notLecture"
  | "horizon"
  | "artifacts"
  | "comms"
  | "observe"
  | "noSelfScore"
  | "wave1";

export type L7TaskDecision = "measured" | "notSupported";

export interface L7GateResult {
  readonly id: L7GateId;
  readonly passed: boolean;
  readonly hard: boolean;
  readonly detail: string;
  readonly value?: number;
}

export interface L7CheckpointEvaluation {
  readonly taskId: string;
  readonly passed: boolean;
  readonly decision: L7TaskDecision;
  readonly gates: readonly L7GateResult[];
}

export interface L7DurableWorld {
  readonly initiatorId: string | undefined;
  readonly peerCount: number;
  readonly activateCount: number;
  readonly registerCount: number;
  readonly sessionCount: number;
  readonly changeCount: number;
  readonly auditCount: number;
  readonly heartbeatOthers: number;
  readonly transcriptActors: number;
  readonly operationIds: readonly string[];
}

const LECTURE_HINTS = [
  "/swarm",
  "/cluster start",
  "请运行",
  "请你运行",
  "please run",
  "you should run",
  "让用户",
  "use /swarm",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function gate(
  id: L7GateId,
  passed: boolean,
  hard: boolean,
  detail: string,
  value?: number,
): L7GateResult {
  return value === undefined ? { id, passed, hard, detail } : { id, passed, hard, detail, value };
}

export function parseDurableWorld(
  bundle: unknown,
  principalId: string | undefined,
): L7DurableWorld | undefined {
  if (!isRecord(bundle)) return undefined;
  const snapshots = bundle["snapshots"];
  const changes = bundle["changes"];
  if (!Array.isArray(snapshots) || snapshots.length === 0) return undefined;
  const headRef = asString(bundle["headRef"]);
  const t0Ref = asString(bundle["t0Ref"]);
  const head =
    snapshots.find((item) => isRecord(item) && item["snapshotRef"] === headRef) ??
    snapshots[snapshots.length - 1];
  const t0 =
    snapshots.find((item) => isRecord(item) && item["snapshotRef"] === t0Ref) ?? snapshots[0];
  if (!isRecord(head) || !isRecord(t0)) return undefined;

  const headParticipants = Array.isArray(head["participants"]) ? head["participants"] : [];
  const t0Participants = Array.isArray(t0["participants"]) ? t0["participants"] : [];
  const initiatorFromT0 = t0Participants
    .map((item) => (isRecord(item) ? asString(item["actorId"]) : undefined))
    .find((id) => id !== undefined);
  const initiatorId = principalId ?? initiatorFromT0;

  let peerCount = 0;
  for (const item of headParticipants) {
    if (!isRecord(item)) continue;
    const id = asString(item["actorId"]);
    const kind = asString(item["kind"]);
    const status = asString(item["status"]);
    if (id === undefined || id === initiatorId) continue;
    if (kind !== "agent") continue;
    if (status === "active" || status === "done" || status === "waiting" || status === "blocked") {
      peerCount += 1;
    }
  }

  const operationIds: string[] = [];
  let activateCount = 0;
  let registerCount = 0;
  if (Array.isArray(changes)) {
    for (const change of changes) {
      if (!isRecord(change)) continue;
      const op = asString(change["operationTypeId"]);
      if (op === undefined) continue;
      operationIds.push(op);
      if (op === "activate_participant") activateCount += 1;
      if (op === "register_participant") registerCount += 1;
    }
  }

  const sessions = Array.isArray(head["sessions"]) ? head["sessions"] : [];
  const auditTail = Array.isArray(head["auditTail"]) ? head["auditTail"] : [];
  const heartbeatLog = Array.isArray(head["heartbeatLog"]) ? head["heartbeatLog"] : [];
  const transcripts = Array.isArray(head["transcripts"]) ? head["transcripts"] : [];

  let heartbeatOthers = 0;
  for (const beat of heartbeatLog) {
    if (!isRecord(beat)) continue;
    const actor = asString(beat["actorId"]) ?? asString(beat["from"]);
    if (actor !== undefined && actor !== initiatorId) heartbeatOthers += 1;
  }

  return {
    initiatorId,
    peerCount,
    activateCount,
    registerCount,
    sessionCount: sessions.length,
    changeCount: Array.isArray(changes) ? changes.length : 0,
    auditCount: auditTail.length,
    heartbeatOthers,
    transcriptActors: transcripts.length,
    operationIds,
  };
}

function resolveDurableBundlePath(evidence: L7TaskEvidence): string | undefined {
  if (evidence.durableBundlePath !== undefined && existsSync(evidence.durableBundlePath)) {
    return evidence.durableBundlePath;
  }
  const fallbacks = [
    join(evidence.workspaceDir, "runtime", "durable.bundle.json"),
    join(evidence.workspaceDir, "os", "runtime", "durable.bundle.json"),
  ];
  return fallbacks.find((path) => existsSync(path));
}

export function readDurableWorld(evidence: L7TaskEvidence): L7DurableWorld | undefined {
  const path = resolveDurableBundlePath(evidence);
  if (path === undefined) return undefined;
  try {
    return parseDurableWorld(
      JSON.parse(readFileSync(path, "utf8")) as unknown,
      evidence.principalId,
    );
  } catch {
    return undefined;
  }
}

export function clusterEventsMentionAgentStart(path: string | undefined): number {
  if (path === undefined || !existsSync(path)) return 0;
  const text = readFileSync(path, "utf8");
  let count = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.includes("agent_started") || line.includes('"kind":"agent_started"')) {
      count += 1;
    }
  }
  return count;
}

export function looksLikeLecture(summary: string | undefined): boolean {
  if (summary === undefined || summary.length === 0) return false;
  const lower = summary.toLowerCase();
  return LECTURE_HINTS.some((hint) => lower.includes(hint.toLowerCase()));
}

function pathEscapesRoot(root: string, candidate: string): boolean {
  const resolved = isAbsolute(candidate) ? resolve(candidate) : resolve(root, candidate);
  const rel = relative(resolve(root), resolved);
  return rel.startsWith("..") || rel.split(sep).includes("..");
}

export function evaluateNoSelfScore(
  evidence: L7TaskEvidence,
  files: readonly string[],
): L7GateResult {
  const current = fingerprintSuiteSources(evidence.suiteRoot, evidence.scorerSourcePaths);
  for (const extra of evidence.scorerSourcePaths) {
    if (!existsSync(extra)) {
      return gate("noSelfScore", false, true, `scorer source missing: ${extra}`);
    }
    const expected = evidence.suiteFingerprints[extra];
    if (expected !== undefined && sha256File(extra) !== expected) {
      return gate("noSelfScore", false, true, `scorer source rewritten: ${extra}`);
    }
  }
  for (const [key, expected] of Object.entries(evidence.suiteFingerprints)) {
    if (evidence.scorerSourcePaths.includes(key)) continue;
    const actual = current[key];
    if (actual === undefined) {
      return gate("noSelfScore", false, true, `suite source missing after run: ${key}`);
    }
    if (actual !== expected) {
      return gate("noSelfScore", false, true, `suite source rewritten: ${key}`);
    }
  }
  if (workspaceHasForbiddenScorerName(files)) {
    return gate("noSelfScore", false, true, "workspace contains checkpoint/protocol/scorer files");
  }
  return gate("noSelfScore", true, true, "suite and scorer sources unchanged");
}

function evaluateArtifacts(
  checkpoint: L7TaskCheckpoint,
  workspaceDir: string,
  files: readonly string[],
): { artifacts: L7GateResult; wave1: L7GateResult } {
  const missing: string[] = [];
  for (const artifact of checkpoint.requiredArtifacts) {
    const normalized = artifact.split(sep).join("/");
    if (pathEscapesRoot(workspaceDir, normalized)) {
      missing.push(`${normalized} (escapes workspace)`);
      continue;
    }
    const full = join(workspaceDir, ...normalized.split("/"));
    if (!fileIsNonEmpty(full)) missing.push(normalized);
  }
  const missingGlobs: string[] = [];
  for (const pattern of checkpoint.requiredGlobs) {
    if (!globHasMatch(files, pattern)) missingGlobs.push(pattern);
  }
  const artifactsPass = missing.length === 0;
  const wave1Pass = artifactsPass && missingGlobs.length === 0;
  return {
    artifacts: gate(
      "artifacts",
      artifactsPass,
      true,
      artifactsPass ? "required artifacts present" : `missing ${missing.join(", ")}`,
      checkpoint.requiredArtifacts.length - missing.length,
    ),
    wave1: gate(
      "wave1",
      wave1Pass,
      true,
      wave1Pass
        ? "wave-1 artifacts and globs present"
        : `missing files=${missing.join(",") || "none"}; globs=${missingGlobs.join(",") || "none"}`,
    ),
  };
}

function hydrateEvidence(evidence: L7TaskEvidence): L7TaskEvidence {
  const collected = collectL7TwentyEvidence({
    workspaceDir: evidence.workspaceDir,
    suiteRoot: evidence.suiteRoot,
    taskId: evidence.taskId,
    suiteFingerprints: evidence.suiteFingerprints,
    scorerSourcePaths: evidence.scorerSourcePaths,
    ...(evidence.principalId !== undefined ? { principalId: evidence.principalId } : {}),
  });
  const result = evidence.result ?? collected.result;
  const swarmStatus = evidence.swarmStatus ?? collected.swarmStatus;
  const durableBundlePath = evidence.durableBundlePath ?? collected.durableBundlePath;
  const clusterEventsPath = evidence.clusterEventsPath ?? collected.clusterEventsPath;
  const principalId = evidence.principalId ?? collected.principalId;
  return {
    workspaceDir: evidence.workspaceDir,
    suiteRoot: evidence.suiteRoot,
    taskId: evidence.taskId,
    suiteFingerprints: evidence.suiteFingerprints,
    scorerSourcePaths: evidence.scorerSourcePaths,
    ...(principalId !== undefined ? { principalId } : {}),
    ...(result !== undefined ? { result } : {}),
    ...(swarmStatus !== undefined ? { swarmStatus } : {}),
    ...(durableBundlePath !== undefined ? { durableBundlePath } : {}),
    ...(clusterEventsPath !== undefined ? { clusterEventsPath } : {}),
  };
}

export function evaluateL7TwentyCheckpoint(
  spec: L7TaskSpec,
  evidence: L7TaskEvidence,
): L7CheckpointEvaluation {
  const resolved = hydrateEvidence(evidence);
  const checkpoint = spec.checkpoint;
  const files = listWorkspaceFiles(resolved.workspaceDir);
  const world = readDurableWorld(resolved);
  const started =
    resolved.swarmStatus?.startedTotal ??
    resolved.swarmStatus?.agentStarted ??
    clusterEventsMentionAgentStart(resolved.clusterEventsPath);
  const committed = resolved.result?.operations?.committed ?? world?.changeCount ?? 0;
  const turns = Math.max(resolved.result?.turns ?? 0, resolved.swarmStatus?.consumedTurns ?? 0);
  const peers = world?.peerCount ?? 0;
  const activateCount = world?.activateCount ?? 0;
  const sessions = world?.sessionCount ?? 0;
  const hasCreateSession = world?.operationIds.includes("create_session") ?? false;
  const artifactCount = files.filter((file) => file.startsWith("artifacts/")).length;

  const swarmFanout = gate(
    "swarmFanout",
    peers >= checkpoint.minPeers,
    true,
    `active-or-terminal non-initiator peers=${peers} min=${checkpoint.minPeers}`,
    peers,
  );
  const activateLoop = gate(
    "activateLoop",
    (!checkpoint.requireActivate || activateCount > 0) && started > 0,
    true,
    `activate_participant=${activateCount} supervisorStarts=${started}`,
    started,
  );
  const lectured = looksLikeLecture(resolved.result?.summary);
  const acted = committed > 0 || started > 0 || artifactCount > 0;
  const notLecture = gate(
    "notLecture",
    acted,
    true,
    !acted && lectured
      ? "lecture without tool/act"
      : acted
        ? "tool/act or workspace artifacts present"
        : "no tool/act and no artifacts",
  );
  const horizon = gate(
    "horizon",
    turns >= checkpoint.minTurns,
    true,
    `turns=${turns} min=${checkpoint.minTurns}`,
    turns,
  );
  const { artifacts, wave1 } = evaluateArtifacts(checkpoint, resolved.workspaceDir, files);
  const commsNeeded = checkpoint.requireComms;
  const commsPass = !commsNeeded || sessions > 0 || hasCreateSession;
  const comms = gate(
    "comms",
    commsPass,
    commsNeeded,
    commsNeeded
      ? `sessions=${sessions} create_session=${hasCreateSession}`
      : "comms not required for this task",
    sessions,
  );
  const observePass =
    !checkpoint.requireObserve ||
    (world !== undefined && (world.changeCount > 0 || world.auditCount > 0));
  const observe = gate(
    "observe",
    observePass,
    checkpoint.requireObserve,
    world === undefined
      ? "durable bundle missing or unreadable"
      : `changes=${world.changeCount} audit=${world.auditCount}`,
    world?.changeCount,
  );
  const noSelfScore = checkpoint.forbidSelfScore
    ? evaluateNoSelfScore(resolved, files)
    : gate("noSelfScore", true, false, "self-score guard disabled");

  const gates = [
    swarmFanout,
    activateLoop,
    notLecture,
    horizon,
    artifacts,
    comms,
    observe,
    noSelfScore,
    wave1,
  ];
  const hardFailed = gates.some((item) => item.hard && !item.passed);
  const passed = !hardFailed;
  return {
    taskId: spec.id,
    passed,
    decision: passed ? "measured" : "notSupported",
    gates,
  };
}

export function nextL7TwentyAction(evaluation: L7CheckpointEvaluation): "continue" | "stop-repair" {
  return evaluation.passed ? "continue" : "stop-repair";
}

export function writeL7RepairMarkdown(evaluation: L7CheckpointEvaluation): string {
  const failed = evaluation.gates.filter((gateResult) => gateResult.hard && !gateResult.passed);
  const lines = [
    `# REPAIR ${evaluation.taskId}`,
    "",
    "本任务硬门失败。整轮已按 PROTOCOL §3 停止。不要改评分器或 checkpoint 来消红。",
    "",
    "## 失败门",
    "",
    ...failed.map((gateResult) => `- \`${gateResult.id}\`: ${gateResult.detail}`),
    "",
    "## PROTOCOL §6 检修顺序",
    "",
    "1. 启动路径：CLI 是否在 runtime 就绪后只挂一份 swarm。",
    "2. 工具是否真调用：register_participant / activate_participant / write_content。",
    "3. supervisor：activate 之后是否出现第二个 CantilunOS loop。",
    "4. durable / private history：是否 UI-only persist 拒写。",
    "5. comms / observe：session 与可重放轨迹。",
    "6. 对照 LangGraph durable、SWE-agent trajectory、Inspect transcript、A2A、ADR-0015/0019/0021/0025 后改生产路径，从本任务重跑。",
    "",
  ];
  return `${lines.join("\n")}\n`;
}
