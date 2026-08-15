import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  atomicWriteFileSync,
  readFileRuntimeIdentity,
  withFileLock,
} from "@cantilune/runtime/memory";
import { requireAgentLoopHistory, type AgentLoopHistory, type LlmMessage } from "@cantilune/boot";
import type { ChatMessage, SessionState } from "../../store.js";
import { createEmptySession } from "../../store.js";

const SESSION_FORMAT_VERSION = 3 as const;
const LEGACY_SESSION_FORMAT_VERSION = 2 as const;

/**
 * Identity of the coordination world whose private LLM transcript is stored.
 *
 * A transcript is not part of CollaborationSnapshot and must never migrate to
 * another world merely because both CLI invocations share a working directory.
 */
export interface SessionWorldBinding {
  readonly durable: "file";
  readonly storagePath: string;
  readonly principalId: string;
  /** Immutable T0 snapshot reference of this durable-world generation. */
  readonly genesisRef: string;
}

interface PersistedSessionEnvelope {
  readonly version: typeof SESSION_FORMAT_VERSION;
  /** Monotonic CAS revision for independent CLI processes. */
  readonly revision: number;
  readonly world: SessionWorldBinding;
  readonly session: SessionState;
  /** Exact private history exported by the booted OS, never rebuilt from UI rows. */
  readonly history: AgentLoopHistory;
  readonly historyDigest: string;
}

interface ParsedSessionFile {
  readonly session: SessionState;
  readonly world: SessionWorldBinding | null;
  readonly revision: number;
  readonly history: AgentLoopHistory | null;
}

export interface RestoredPrivateSession {
  readonly session: SessionState;
  /** Null only for a safe-text migration from the legacy v2 envelope. */
  readonly history: AgentLoopHistory | null;
}

export interface SessionWorldConfig {
  readonly durable: "memory" | "file";
  readonly storagePath?: string;
  readonly principalId?: string;
}

export interface UseSessionResult {
  readonly world: SessionWorldBinding | null;
  /** The only read path: callers cannot obtain an unbound or mismatched transcript. */
  readonly restoreFor: (world: SessionWorldBinding | null) => RestoredPrivateSession | null;
  readonly save: (
    next: SessionState,
    history: AgentLoopHistory,
    world: SessionWorldBinding,
  ) => Promise<void>;
  readonly clear: (world: SessionWorldBinding) => Promise<void>;
  readonly loaded: boolean;
  /** Non-null means an existing private envelope was unreadable or untrusted. */
  readonly loadError: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalStoragePath(storagePath: string): string {
  // Preserve case even on Windows: case-sensitive directories are supported,
  // and conflating two differently cased paths could cross a world boundary.
  return path.normalize(path.resolve(storagePath));
}

/**
 * Derive the fail-closed identity used by session persistence.
 *
 * A memory runtime creates a new coordination world on every process start,
 * so no stable path/principal tuple can authorize cross-process transcript
 * reuse. A file world without both a path and a principal is likewise
 * ineligible for either restore or save.
 */
export function createSessionWorldBinding(config: SessionWorldConfig): SessionWorldBinding | null {
  if (config.durable === "memory") return null;
  if (config.principalId === undefined || config.principalId.trim().length === 0) return null;
  if (config.storagePath === undefined) return null;

  const storagePath = canonicalStoragePath(config.storagePath);
  const identity = readFileRuntimeIdentity(path.join(storagePath, "runtime"));
  if (identity === undefined) return null;

  return {
    durable: config.durable,
    storagePath,
    principalId: config.principalId,
    genesisRef: String(identity.genesisRef),
  };
}

export function sessionWorldBindingsEqual(
  left: SessionWorldBinding | null,
  right: SessionWorldBinding | null,
): boolean {
  if (left === null || right === null) return false;
  return (
    left.durable === right.durable &&
    left.storagePath === right.storagePath &&
    left.principalId === right.principalId &&
    left.genesisRef === right.genesisRef
  );
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!isRecord(value)) return false;
  const role = value["role"];
  return (
    (role === "user" || role === "assistant" || role === "system" || role === "error") &&
    typeof value["content"] === "string" &&
    typeof value["timestamp"] === "number" &&
    Number.isFinite(value["timestamp"])
  );
}

function isSessionState(value: unknown): value is SessionState {
  if (!isRecord(value) || !Array.isArray(value["messages"])) return false;
  const tokenUsage = value["tokenUsage"];
  return (
    value["messages"].every(isChatMessage) &&
    typeof value["turnCount"] === "number" &&
    Number.isFinite(value["turnCount"]) &&
    typeof value["startTime"] === "number" &&
    Number.isFinite(value["startTime"]) &&
    isRecord(tokenUsage) &&
    typeof tokenUsage["prompt"] === "number" &&
    typeof tokenUsage["completion"] === "number" &&
    typeof tokenUsage["total"] === "number" &&
    typeof value["costUsd"] === "number" &&
    Number.isFinite(value["costUsd"])
  );
}

function safeLegacyMessages(session: SessionState): LlmMessage[] {
  return session.messages.flatMap((message) =>
    (message.role === "user" || message.role === "assistant") &&
    message.content.trim().length > 0 &&
    message.toolCalls === undefined
      ? [{ role: message.role, content: message.content }]
      : [],
  );
}

function parseWorldBinding(value: unknown): SessionWorldBinding | null {
  if (!isRecord(value)) return null;
  const durable = value["durable"];
  const storagePath = value["storagePath"];
  const principalId = value["principalId"];
  const genesisRef = value["genesisRef"];
  if (
    durable !== "file" ||
    typeof storagePath !== "string" ||
    typeof principalId !== "string" ||
    typeof genesisRef !== "string" ||
    genesisRef.length === 0
  ) {
    return null;
  }
  // Parse the identity recorded with the transcript without consulting the
  // current bundle. restoreFor() compares it to a separately verified current
  // generation, so a replaced bundle remains a detectable mismatch.
  return {
    durable,
    storagePath: canonicalStoragePath(storagePath),
    principalId,
    genesisRef,
  };
}

function parseRevision(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function privateHistoryDigest(
  world: SessionWorldBinding,
  revision: number,
  history: AgentLoopHistory,
): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify({ world, revision, history }), "utf8")
    .digest("hex")}`;
}

function parseSessionFile(value: unknown): ParsedSessionFile | null {
  if (!isRecord(value)) return null;

  // Legacy files contained a bare SessionState. Preserve it for inspection,
  // but leave it unbound so restoreFor() can never inject it into a world.
  if (isSessionState(value)) return { session: value, world: null, revision: 0, history: null };
  const revisionValue = value["revision"];
  // Pre-CAS v2 envelopes have no revision and migrate from revision zero.
  const revision = revisionValue === undefined ? 0 : parseRevision(revisionValue);
  if (value["version"] === SESSION_FORMAT_VERSION && value["invalidated"] === true) {
    return revision === null
      ? null
      : { session: createEmptySession(), world: null, revision, history: null };
  }
  if (
    value["version"] !== SESSION_FORMAT_VERSION &&
    value["version"] !== LEGACY_SESSION_FORMAT_VERSION
  ) {
    return null;
  }
  if (!isSessionState(value["session"])) {
    return null;
  }
  const world = parseWorldBinding(value["world"]);
  if (world === null || revision === null) return null;
  if (value["version"] === LEGACY_SESSION_FORMAT_VERSION) {
    return {
      session: value["session"],
      world,
      revision,
      history: requireAgentLoopHistory({
        messages: safeLegacyMessages(value["session"]),
        pendingToolObservations: [],
      }),
    };
  }
  const history = requireAgentLoopHistory(value["history"]);
  if (
    typeof value["historyDigest"] !== "string" ||
    value["historyDigest"] !== privateHistoryDigest(world, revision, history)
  ) {
    throw new Error("Private history integrity check failed");
  }
  return {
    session: value["session"],
    world,
    revision,
    history,
  };
}

function sessionPaths(root: string): { readonly dir: string; readonly file: string } {
  const dir = path.join(root, ".cantilune");
  return { dir, file: path.join(dir, "session.json") };
}

function readSessionForCas(file: string): ParsedSessionFile | null {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Private transcript is unreadable; refusing to overwrite it");
  }
  const parsed = parseSessionFile(value);
  if (parsed === null) {
    throw new Error("Private transcript has an invalid envelope; refusing to overwrite it");
  }
  return parsed;
}

export function useSession(root = process.cwd()): UseSessionResult {
  const [session, setSession] = useState<SessionState>(createEmptySession());
  const [history, setHistory] = useState<AgentLoopHistory | null>(null);
  const [world, setWorld] = useState<SessionWorldBinding | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Instance-local expected revision; updated synchronously after each write. */
  const revisionRef = useRef<number | null>(null);
  const paths = useMemo(() => sessionPaths(root), [root]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await readFile(paths.file, "utf8");
        const parsed = parseSessionFile(JSON.parse(raw) as unknown);
        if (!cancelled && parsed !== null) {
          setSession(parsed.session);
          setWorld(parsed.world);
          setHistory(parsed.history);
          revisionRef.current = parsed.revision;
          setLoadError(null);
        } else if (!cancelled) {
          throw new Error("Private transcript has an invalid envelope");
        }
      } catch (error) {
        if (!cancelled) {
          setSession(createEmptySession());
          setWorld(null);
          setHistory(null);
          // A missing file and an unreadable file are distinguished again
          // under the save lock; zero is only the optimistic expected value.
          revisionRef.current = 0;
          const code = (error as NodeJS.ErrnoException).code;
          let message: string | null = null;
          if (code !== "ENOENT") message = error instanceof Error ? error.message : String(error);
          setLoadError(message);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paths.file]);

  const restoreFor = useCallback(
    (requestedWorld: SessionWorldBinding | null): RestoredPrivateSession | null =>
      sessionWorldBindingsEqual(world, requestedWorld) ? { session, history } : null,
    [history, session, world],
  );

  const save = useCallback(
    async (next: SessionState, nextHistory: AgentLoopHistory, nextWorld: SessionWorldBinding) => {
      await mkdir(paths.dir, { recursive: true });
      const expectedRevision = revisionRef.current;
      if (expectedRevision === null) {
        throw new Error("Private transcript has not finished loading; refusing to persist it");
      }

      let committedRevision: number | undefined;
      let generationChanged = false;
      const detachedHistory = requireAgentLoopHistory(nextHistory);
      withFileLock(paths.dir, () => {
        const canonicalWorld = createSessionWorldBinding(nextWorld);
        if (canonicalWorld === null || !sessionWorldBindingsEqual(canonicalWorld, nextWorld)) {
          throw new Error(
            "Cannot persist a private transcript without the current canonical file-world generation",
          );
        }

        const current = readSessionForCas(paths.file);
        const actualRevision = current?.revision ?? 0;
        if (actualRevision !== expectedRevision) {
          throw new Error(
            `Private transcript revision conflict: expected ${String(expectedRevision)}, found ${String(actualRevision)}`,
          );
        }

        const revision = actualRevision + 1;
        const envelope: PersistedSessionEnvelope = {
          version: SESSION_FORMAT_VERSION,
          revision,
          world: canonicalWorld,
          session: next,
          history: detachedHistory,
          historyDigest: privateHistoryDigest(canonicalWorld, revision, detachedHistory),
        };
        atomicWriteFileSync(paths.file, `${JSON.stringify(envelope, null, 2)}\n`);

        // Runtime and transcript use separate files. Re-read while the session
        // lock is still held. If the runtime generation changed, quarantine
        // only this writer's CAS revision; no later session writer can be
        // overwritten by the isolation marker.
        const afterWriteWorld = createSessionWorldBinding(nextWorld);
        if (!sessionWorldBindingsEqual(afterWriteWorld, canonicalWorld)) {
          atomicWriteFileSync(
            paths.file,
            `${JSON.stringify(
              { version: SESSION_FORMAT_VERSION, revision, invalidated: true },
              null,
              2,
            )}\n`,
          );
          committedRevision = revision;
          generationChanged = true;
          return;
        }
        committedRevision = revision;
      });

      if (committedRevision === undefined) {
        throw new Error("Private transcript CAS completed without a revision receipt");
      }
      revisionRef.current = committedRevision;
      if (generationChanged) {
        setSession(createEmptySession());
        setHistory(null);
        setWorld(null);
        throw new Error("File-world generation changed while persisting the private transcript");
      }
      setSession(next);
      setHistory(detachedHistory);
      setLoadError(null);
      setWorld(nextWorld);
    },
    [paths.dir, paths.file],
  );

  const clear = useCallback(
    async (nextWorld: SessionWorldBinding) => {
      await save(createEmptySession(), { messages: [], pendingToolObservations: [] }, nextWorld);
    },
    [save],
  );

  return { world, restoreFor, save, clear, loaded, loadError };
}
