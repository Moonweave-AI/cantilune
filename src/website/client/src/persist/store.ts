/**
 * Local harness snapshot. The website is a control surface: refresh must not
 * drop configured providers, API keys, workspaces, or conversation nodes.
 * Keys stay on this origin's localStorage (local OS harness, not a shared SaaS).
 *
 * Conversation transcripts live in side keys so a large session cannot block
 * first paint. The meta key (`cln-harness-v1`) holds configure / catalog only.
 */

import type { ConfigureRequest } from "@shared/protocol";
import type { RunMode } from "../conversation/PermissionSelect";
import {
  compactConversation,
  createConversationState,
  thawConversation,
  type ConversationState,
  type NodeKind,
} from "../conversation/nodes";
import { replaceTopLevelProperty, sliceTopLevelProperty } from "./jsonSlice";

export interface SessionSummary {
  readonly id: string;
  readonly title: string;
  readonly updatedAtMs: number;
  readonly workspaceId: string;
}

export interface WorkspaceSummary {
  readonly id: string;
  readonly name: string;
  readonly path: string;
}

export interface CatalogEntry {
  readonly id: string;
  readonly provider: string;
  readonly model: string;
  readonly label: string;
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly custom?: boolean;
}

export const HARNESS_STORAGE_KEY = "cln-harness-v1";
export const HARNESS_CONVERSATIONS_KEY = "cln-harness-v1:conversations";
export const HARNESS_SCHEMA = 1 as const;
const TRANSCRIPT_PREFIX = "cln-harness-v1:c:";
const MAX_SESSIONS = 40;
const SYNC_TRANSCRIPT_MAX = 120_000;
const META_PARSE_MAX = 400_000;
const PEEL_MIN_BLOB = 8;
const META_KEYS = [
  "schema",
  "sessions",
  "activeSessionId",
  "workspaces",
  "activeWorkspaceId",
  "configure",
  "catalog",
  "view",
  "mode",
  "groupBy",
  "orderBy",
  "collapsedWorkspaceIds",
] as const;

export type SessionView = "conversation" | "trajectory";
export type GroupBy = "workspace" | "flat";
export type OrderBy = "manual" | "updated";

export interface HarnessSnapshot {
  readonly schema: typeof HARNESS_SCHEMA;
  readonly sessions: readonly SessionSummary[];
  readonly activeSessionId: string;
  readonly workspaces: readonly WorkspaceSummary[];
  readonly activeWorkspaceId: string;
  readonly conversations: Readonly<Record<string, ConversationState>>;
  readonly configure?: ConfigureRequest | undefined;
  readonly catalog: readonly CatalogEntry[];
  readonly view: SessionView;
  readonly mode: RunMode;
  readonly groupBy: GroupBy;
  readonly orderBy: OrderBy;
  readonly collapsedWorkspaceIds: readonly string[];
}

export const DEFAULT_WORKSPACE: WorkspaceSummary = {
  id: "workspace-1",
  name: "Cantilune workspace",
  path: ".",
};

export const DEFAULT_SESSION: SessionSummary = {
  id: "session-1",
  title: "新会话",
  updatedAtMs: Date.now(),
  workspaceId: DEFAULT_WORKSPACE.id,
};

export function emptySnapshot(): HarnessSnapshot {
  return {
    schema: HARNESS_SCHEMA,
    sessions: [DEFAULT_SESSION],
    activeSessionId: DEFAULT_SESSION.id,
    workspaces: [DEFAULT_WORKSPACE],
    activeWorkspaceId: DEFAULT_WORKSPACE.id,
    conversations: { [DEFAULT_SESSION.id]: createConversationState() },
    catalog: [],
    view: "conversation",
    mode: "execute",
    groupBy: "workspace",
    orderBy: "updated",
    collapsedWorkspaceIds: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseWorkspace(value: unknown): WorkspaceSummary | undefined {
  if (!isRecord(value)) return undefined;
  const id = asString(value.id, "");
  const name = asString(value.name, "");
  const path = asString(value.path, "");
  if (id.length === 0 || name.length === 0) return undefined;
  return { id, name, path: path.length > 0 ? path : "." };
}

function parseSession(value: unknown, fallbackWorkspaceId: string): SessionSummary | undefined {
  if (!isRecord(value)) return undefined;
  const id = asString(value.id, "");
  if (id.length === 0) return undefined;
  const updatedAtMs = asNumber(
    value.updatedAtMs,
    typeof value.updatedAt === "number" ? value.updatedAt : Date.now(),
  );
  return {
    id,
    title: asString(value.title, "新会话"),
    updatedAtMs,
    workspaceId: asString(value.workspaceId, fallbackWorkspaceId),
  };
}

const NODE_KINDS: ReadonlySet<NodeKind> = new Set([
  "user",
  "assistant",
  "reasoning",
  "tool_call",
  "control_verdict",
  "ask_user",
  "diagnostic",
  "turn",
  "error",
  "approval",
  "run_result",
]);

function transcriptKey(sessionId: string): string {
  return `${TRANSCRIPT_PREFIX}${sessionId}`;
}

function parseTranscriptJson(raw: string): ConversationState {
  const parsed: unknown = JSON.parse(raw, (_key, value) => {
    if (typeof value === "string" && value.length > 12_000) return `${value.slice(0, 8_000)}…`;
    return value;
  });
  if (!isRecord(parsed) || !Array.isArray(parsed.nodes)) return createConversationState();
  const nodes = parsed.nodes.filter(
    (node): node is ConversationState["nodes"][number] =>
      isRecord(node) &&
      typeof node.id === "string" &&
      typeof node.kind === "string" &&
      NODE_KINDS.has(node.kind as NodeKind),
  );
  return thawConversation({ nodes });
}

/** Peel conversation nodes out of the meta key without JSON.parse. */
export function peelConversationsFromMainStore(): void {
  try {
    const raw = localStorage.getItem(HARNESS_STORAGE_KEY);
    if (raw === null || raw.length < 4_096) return;
    const stripped = replaceTopLevelProperty(raw, "conversations", "{}");
    if (stripped === undefined || stripped === raw) return;
    const blob = sliceTopLevelProperty(raw, "conversations");
    if (blob === undefined || blob.length < PEEL_MIN_BLOB) return;
    try {
      localStorage.setItem(HARNESS_CONVERSATIONS_KEY, blob);
    } catch {
      /* quota — stripping meta still unfreezes the tab */
    }
    localStorage.setItem(HARNESS_STORAGE_KEY, stripped);
  } catch {
    /* keep keys */
  }
}

export function loadSessionTranscript(sessionId: string): ConversationState {
  try {
    const per = localStorage.getItem(transcriptKey(sessionId));
    if (per !== null && per.length > 0) return parseTranscriptJson(per);
    const combined = localStorage.getItem(HARNESS_CONVERSATIONS_KEY);
    if (combined === null || combined.length === 0) return createConversationState();
    const slice = sliceTopLevelProperty(combined, sessionId);
    if (slice === undefined) return createConversationState();
    return parseTranscriptJson(slice);
  } catch {
    return createConversationState();
  }
}

export function saveSessionTranscript(sessionId: string, state: ConversationState): void {
  try {
    if (state.nodes.length === 0) return;
    localStorage.setItem(transcriptKey(sessionId), JSON.stringify(compactConversation(state)));
  } catch {
    /* quota */
  }
}

export function discardSessionTranscript(sessionId: string): void {
  try {
    localStorage.removeItem(transcriptKey(sessionId));
  } catch {
    /* private mode */
  }
}

function parseConversations(
  value: unknown,
  sessionIds: readonly string[],
): Record<string, ConversationState> {
  const out: Record<string, ConversationState> = {};
  const source = isRecord(value) ? value : {};
  for (const id of sessionIds) {
    const entry = source[id];
    if (isRecord(entry) && Array.isArray(entry.nodes)) {
      const nodes = entry.nodes.filter(
        (node): node is ConversationState["nodes"][number] =>
          isRecord(node) &&
          typeof node.id === "string" &&
          typeof node.kind === "string" &&
          NODE_KINDS.has(node.kind as NodeKind),
      );
      out[id] = thawConversation({ nodes });
    } else {
      out[id] = createConversationState();
    }
  }
  return out;
}

function parseCatalog(value: unknown, configure: ConfigureRequest | undefined): CatalogEntry[] {
  const rows: CatalogEntry[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isRecord(item)) continue;
      const provider = asString(item.provider, "");
      const model = asString(item.model, "");
      if (provider.length === 0 || model.length === 0) continue;
      rows.push({
        id: asString(item.id, `${provider}:${model}`),
        provider,
        model,
        label: asString(item.label, model),
        ...(typeof item.apiKey === "string" && item.apiKey.length > 0 ? { apiKey: item.apiKey } : {}),
        ...(typeof item.baseUrl === "string" && item.baseUrl.length > 0
          ? { baseUrl: item.baseUrl }
          : {}),
        ...(item.custom === true ? { custom: true } : {}),
      });
    }
  }
  if (rows.length === 0 && configure !== undefined) {
    rows.push({
      id: `${configure.provider}:${configure.model}`,
      provider: configure.provider,
      model: configure.model,
      label: configure.model,
      ...(configure.apiKey !== undefined && configure.apiKey.length > 0
        ? { apiKey: configure.apiKey }
        : {}),
      ...(configure.baseUrl !== undefined && configure.baseUrl.length > 0
        ? { baseUrl: configure.baseUrl }
        : {}),
    });
  }
  return rows;
}

function parseConfigure(value: unknown): ConfigureRequest | undefined {
  if (!isRecord(value) || value.type !== "configure") return undefined;
  const provider = asString(value.provider, "");
  const model = asString(value.model, "");
  if (provider.length === 0 || model.length === 0) return undefined;
  return value as unknown as ConfigureRequest;
}

function capSessions(snapshot: HarnessSnapshot): readonly SessionSummary[] {
  if (snapshot.sessions.length <= MAX_SESSIONS) return snapshot.sessions;
  const keep = snapshot.sessions.slice(0, MAX_SESSIONS);
  if (!keep.some((item) => item.id === snapshot.activeSessionId)) {
    keep[0] = snapshot.sessions.find((item) => item.id === snapshot.activeSessionId) ?? keep[0]!;
  }
  return keep;
}

function parseMetaJson(raw: string): unknown {
  const stripped = replaceTopLevelProperty(raw, "conversations", "{}") ?? raw;
  if (stripped.length <= META_PARSE_MAX) return JSON.parse(stripped);
  const pieces = ['"conversations":{}'];
  for (const key of META_KEYS) {
    const value = sliceTopLevelProperty(raw, key);
    if (value !== undefined) pieces.push(`"${key}":${value}`);
  }
  return JSON.parse(`{${pieces.join(",")}}`);
}

function conversationsForBoot(
  parsedConversations: unknown,
  sessionIds: readonly string[],
  activeSessionId: string,
): Record<string, ConversationState> {
  const out: Record<string, ConversationState> = {};
  for (const id of sessionIds) {
    out[id] = createConversationState();
  }
  try {
    const per = localStorage.getItem(transcriptKey(activeSessionId));
    if (per !== null && per.length > 0 && per.length < SYNC_TRANSCRIPT_MAX) {
      out[activeSessionId] = parseTranscriptJson(per);
      return out;
    }
  } catch {
    /* hydrate after first paint */
  }
  if (isRecord(parsedConversations)) {
    const fromMain = parseConversations(parsedConversations, [activeSessionId]);
    out[activeSessionId] = fromMain[activeSessionId] ?? createConversationState();
  }
  return out;
}

export function loadHarness(): HarnessSnapshot {
  peelConversationsFromMainStore();
  const fallback = emptySnapshot();
  try {
    const raw = localStorage.getItem(HARNESS_STORAGE_KEY);
    if (raw === null) return fallback;
    const parsed: unknown = parseMetaJson(raw);
    if (!isRecord(parsed) || parsed.schema !== HARNESS_SCHEMA) return fallback;
    const workspaces = Array.isArray(parsed.workspaces)
      ? parsed.workspaces
          .map(parseWorkspace)
          .filter((item): item is WorkspaceSummary => item !== undefined)
      : [];
    const resolvedWorkspaces = workspaces.length > 0 ? workspaces : fallback.workspaces;
    const fallbackWorkspaceId = resolvedWorkspaces[0]?.id ?? DEFAULT_WORKSPACE.id;
    const sessions = Array.isArray(parsed.sessions)
      ? parsed.sessions
          .map((item) => parseSession(item, fallbackWorkspaceId))
          .filter((item): item is SessionSummary => item !== undefined)
      : [];
    const resolvedSessions = sessions.length > 0 ? sessions : fallback.sessions;
    const sessionIds = resolvedSessions.map((item) => item.id);
    const activeSessionId = sessionIds.includes(asString(parsed.activeSessionId, ""))
      ? asString(parsed.activeSessionId, sessionIds[0]!)
      : sessionIds[0]!;
    const workspaceIds = resolvedWorkspaces.map((item) => item.id);
    const activeWorkspaceId = workspaceIds.includes(asString(parsed.activeWorkspaceId, ""))
      ? asString(parsed.activeWorkspaceId, workspaceIds[0]!)
      : workspaceIds[0]!;
    const mode =
      parsed.mode === "plan" || parsed.mode === "observe" || parsed.mode === "execute"
        ? parsed.mode
        : "execute";
    const groupBy = parsed.groupBy === "flat" ? "flat" : "workspace";
    const orderBy = parsed.orderBy === "manual" ? "manual" : "updated";
    const collapsedWorkspaceIds = Array.isArray(parsed.collapsedWorkspaceIds)
      ? parsed.collapsedWorkspaceIds.filter((item): item is string => typeof item === "string")
      : [];
    const configure = parseConfigure(parsed.configure);
    return {
      schema: HARNESS_SCHEMA,
      sessions: resolvedSessions,
      activeSessionId,
      workspaces: resolvedWorkspaces,
      activeWorkspaceId,
      conversations: conversationsForBoot(parsed.conversations, sessionIds, activeSessionId),
      configure,
      catalog: parseCatalog(parsed.catalog, configure),
      view: "conversation",
      mode,
      groupBy,
      orderBy,
      collapsedWorkspaceIds,
    };
  } catch {
    return fallback;
  }
}

function removeOrphanTranscripts(sessionIds: ReadonlySet<string>): void {
  const stale: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key === null || !key.startsWith(TRANSCRIPT_PREFIX)) continue;
    const id = key.slice(TRANSCRIPT_PREFIX.length);
    if (!sessionIds.has(id)) stale.push(key);
  }
  for (const key of stale) localStorage.removeItem(key);
}

function maybeDropCombinedTranscripts(sessionIds: readonly string[]): void {
  try {
    if (localStorage.getItem(HARNESS_CONVERSATIONS_KEY) === null) return;
    for (const id of sessionIds) {
      if (localStorage.getItem(transcriptKey(id)) === null) return;
    }
    localStorage.removeItem(HARNESS_CONVERSATIONS_KEY);
  } catch {
    /* private mode */
  }
}

export function saveHarness(snapshot: HarnessSnapshot): void {
  try {
    const sessions = capSessions(snapshot);
    const meta: HarnessSnapshot = { ...snapshot, sessions, conversations: {}, view: "conversation" };
    localStorage.setItem(HARNESS_STORAGE_KEY, JSON.stringify(meta));
    const active = snapshot.conversations[snapshot.activeSessionId];
    if (active !== undefined) saveSessionTranscript(snapshot.activeSessionId, active);
    const ids = sessions.map((item) => item.id);
    removeOrphanTranscripts(new Set(ids));
    maybeDropCombinedTranscripts(ids);
  } catch {
    /* private mode / quota */
  }
}
