import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { VerificationDecision } from "../../foundation/verificationDecision.js";
import {
  cacheKeyString,
  type VerificationCache,
  type VerificationCacheKey,
} from "../../ports/verificationCache.js";
import { withFileLock } from "./fileLock.js";

const CACHE_FILE = "verification-cache.json";

export interface FileVerificationCacheOptions {
  readonly dir: string;
}

function cachePath(dir: string): string {
  return join(dir, CACHE_FILE);
}

function isDecision(value: unknown): value is VerificationDecision {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.runId === "string" &&
    typeof record.profile === "string" &&
    typeof record.evidenceRootDigest === "string" &&
    typeof record.decidedAt === "string" &&
    typeof record.status === "object" &&
    record.status !== null &&
    Array.isArray(record.violations)
  );
}

function readEntries(dir: string): Map<string, VerificationDecision> {
  const path = cachePath(dir);
  const entries = new Map<string, VerificationDecision>();
  if (!existsSync(path)) return entries;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (typeof raw !== "object" || raw === null) return entries;
    for (const [key, value] of Object.entries(raw)) {
      if (isDecision(value)) entries.set(key, value);
    }
  } catch {
    return entries;
  }
  return entries;
}

function writeEntries(dir: string, entries: Map<string, VerificationDecision>): void {
  writeFileSync(cachePath(dir), JSON.stringify(Object.fromEntries(entries)), "utf8");
}

export function createFileVerificationCache(
  options: FileVerificationCacheOptions,
): VerificationCache {
  const { dir } = options;
  mkdirSync(dir, { recursive: true });

  return {
    get(key: VerificationCacheKey) {
      return withFileLock(dir, () => readEntries(dir).get(cacheKeyString(key)));
    },
    set(key: VerificationCacheKey, decision: VerificationDecision) {
      withFileLock(dir, () => {
        const entries = readEntries(dir);
        entries.set(cacheKeyString(key), decision);
        writeEntries(dir, entries);
      });
    },
    invalidateAll() {
      withFileLock(dir, () => {
        writeEntries(dir, new Map());
      });
    },
  };
}
