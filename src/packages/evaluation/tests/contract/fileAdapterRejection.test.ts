import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { createFileRunStore } from "../../src/adapters/file/fileRunStore.js";
import { createFileClaimLedger } from "../../src/adapters/file/fileClaimLedger.js";
import { evaluationClaimId } from "../../src/foundation/evaluationIds.js";
import type {
  EvaluationRunId,
  EvaluationRunPlanId,
  EvaluationSubjectId,
} from "../../src/foundation/evaluationIds.js";
import type { ClaimLedgerEntry } from "../../src/ports/stateGovernance.js";
import type { ContentDigest } from "@cantilune/core";

const d = (s: string) => s as ContentDigest;

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function makeEntry(digest: string, previous?: string): ClaimLedgerEntry {
  return {
    claimRef: evaluationClaimId("c1"),
    action: "protocolFrozen",
    decision: undefined,
    previousDigest: previous !== undefined ? d(previous) : undefined,
    entryDigest: d(digest),
    timestamp: "2026-01-01",
  };
}

describe("File adapter contract rejections", () => {
  it("run store rejects path traversal in run id", async () => {
    const store = createFileRunStore(await makeTempDir("eval-contract-run-"));
    const result = await store.save({
      runId: "../../etc/passwd" as EvaluationRunId,
      planRef: "plan-1" as EvaluationRunPlanId,
      planDigest: d("pd"),
      subjectRef: "sub-1" as EvaluationSubjectId,
      status: "admitted",
      attemptIds: [],
      currentAttemptId: undefined,
      startedAt: "2026-01-01",
      endedAt: undefined,
      runDigest: d("rd"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations[0]!.code).toBe("invalid_input");
  });

  it("claim ledger rejects out-of-order append", async () => {
    const ledger = createFileClaimLedger(await makeTempDir("eval-contract-ledger-"));
    await ledger.append(makeEntry("d1"));
    const result = await ledger.append(makeEntry("d2", "not-d1"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations[0]!.code).toBe("ledger_chain_broken");
  });

  it("claim ledger verifyChain fails on tampered file", async () => {
    const baseDir = await makeTempDir("eval-contract-verify-");
    const ledger = createFileClaimLedger(baseDir);
    await ledger.append(makeEntry("d1"));
    const ledgerFile = path.join(baseDir, "claim-ledger.jsonl");
    await fs.appendFile(ledgerFile, JSON.stringify(makeEntry("d2", "tampered")) + "\n");
    const result = await ledger.verifyChain();
    expect(result.ok).toBe(false);
  });
});
