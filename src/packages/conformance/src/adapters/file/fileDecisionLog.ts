import { err, ok } from "@cantilune/core";
import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { computeEvidenceDigest, isSha256HexDigest } from "../../canonical/evidenceDigest.js";
import type {
  DecisionAppendInput,
  DecisionLogEntry,
  DecisionStore,
} from "../../ports/decisionStore.js";
import { withFileLock } from "./fileLock.js";

const LOG_FILE = "decisions.jsonl";

function logPath(dir: string): string {
  return join(dir, LOG_FILE);
}

function parseLine(line: string): DecisionLogEntry | undefined {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  try {
    const raw = JSON.parse(trimmed) as DecisionLogEntry;
    if (
      typeof raw.sequence !== "number" ||
      typeof raw.runId !== "string" ||
      typeof raw.entryDigest !== "string" ||
      !isSha256HexDigest(raw.entryDigest)
    ) {
      return undefined;
    }
    const expected = computeEvidenceDigest({
      sequence: raw.sequence,
      runId: raw.runId,
      decisionDigest: raw.decisionDigest,
      profile: raw.profile,
      recordedAt: raw.recordedAt,
      previousEntryDigest: raw.previousEntryDigest,
    }) as string;
    if (raw.entryDigest !== expected) {
      return undefined;
    }
    return raw;
  } catch {
    return undefined;
  }
}

function readEntries(dir: string): DecisionLogEntry[] {
  const path = logPath(dir);
  if (!existsSync(path)) {
    return [];
  }
  const content = readFileSync(path, "utf8");
  const lines = content.split("\n");
  const entries: DecisionLogEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const entry = parseLine(lines[i] ?? "");
    if (entry === undefined && (lines[i]?.trim().length ?? 0) > 0) {
      throw new Error(`corrupt decision log at line ${i + 1}`);
    }
    if (entry !== undefined) {
      if (entry.sequence !== entries.length + 1) {
        throw new Error(`decision log sequence gap at ${entry.sequence}`);
      }
      entries.push(entry);
    }
  }
  return entries;
}

export interface FileDecisionLogOptions {
  readonly dir: string;
}

export function createFileDecisionLog(options: FileDecisionLogOptions): DecisionStore {
  const { dir } = options;
  mkdirSync(dir, { recursive: true });

  return {
    async append(input: DecisionAppendInput) {
      try {
        return withFileLock(dir, () => {
          const prior = readEntries(dir);
          const sequence = prior.length + 1;
          const previousEntryDigest = prior.at(-1)?.entryDigest ?? "0".repeat(64);
          const entryDigest = computeEvidenceDigest({
            sequence,
            runId: input.runId,
            decisionDigest: input.decisionDigest,
            profile: input.profile,
            recordedAt: input.recordedAt,
            previousEntryDigest,
          }) as string;
          const entry: DecisionLogEntry = {
            sequence,
            entryDigest,
            previousEntryDigest,
            ...input,
          };
          appendFileSync(logPath(dir), `${JSON.stringify(entry)}\n`, "utf8");
          return ok(entry);
        });
      } catch {
        return err("unavailable");
      }
    },

    async readAll() {
      try {
        return withFileLock(dir, () => ok(readEntries(dir)));
      } catch {
        return err("unavailable");
      }
    },
  };
}
