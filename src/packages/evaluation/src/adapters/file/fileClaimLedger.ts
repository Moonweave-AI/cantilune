import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { EvaluationClaimId } from "../../foundation/evaluationIds.js";
import {
  ok,
  violations,
  violation,
  type EvaluationResult,
} from "../../foundation/evaluationResult.js";
import type { ClaimDecision } from "../../review/claimDecision.js";
import type { ClaimLedger, ClaimLedgerEntry } from "../../ports/stateGovernance.js";

async function readAllEntries(ledgerFile: string): Promise<ClaimLedgerEntry[]> {
  try {
    const data = await fs.readFile(ledgerFile, "utf-8");
    const lines = data.trim().split("\n").filter(Boolean);
    return lines.map((l) => {
      try {
        return JSON.parse(l) as ClaimLedgerEntry;
      } catch {
        throw new Error(`Corrupted ledger entry: ${l.slice(0, 100)}`);
      }
    });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export function createFileClaimLedger(baseDir: string): ClaimLedger {
  const ledgerFile = path.join(baseDir, "claim-ledger.jsonl");

  return {
    async append(entry: ClaimLedgerEntry): Promise<EvaluationResult<void>> {
      await fs.mkdir(baseDir, { recursive: true });

      const existing = await readAllEntries(ledgerFile);
      const expectedPrevious = existing.length > 0 ? existing.at(-1)!.entryDigest : undefined;

      if (entry.previousDigest !== expectedPrevious) {
        return violations([
          violation(
            "ledger_chain_broken",
            "entry.previousDigest",
            `Expected previous digest ${expectedPrevious ?? "(none)"}, got ${entry.previousDigest ?? "(none)"}`,
          ),
        ]);
      }

      const line = JSON.stringify(entry) + "\n";
      const tmpFile = ledgerFile + `.tmp.${Date.now()}`;
      try {
        const currentData = await fs.readFile(ledgerFile, "utf-8").catch(() => "");
        await fs.writeFile(tmpFile, currentData + line);
        await fs.rename(tmpFile, ledgerFile);
      } catch (err) {
        await fs.unlink(tmpFile).catch(() => {});
        return violations([
          violation(
            "store_write_failed",
            "ledger",
            `Failed to append: ${err instanceof Error ? err.message : String(err)}`,
          ),
        ]);
      }
      return ok(undefined);
    },

    async getHistory(claimRef: EvaluationClaimId): Promise<readonly ClaimLedgerEntry[]> {
      const entries = await readAllEntries(ledgerFile);
      return entries.filter((e) => e.claimRef === claimRef);
    },

    async getLatestDecision(claimRef: EvaluationClaimId): Promise<ClaimDecision | undefined> {
      const history = await this.getHistory(claimRef);
      const withDecision = history.filter((e) => e.decision !== undefined);
      return withDecision.length > 0 ? withDecision.at(-1)!.decision : undefined;
    },

    async verifyChain(): Promise<EvaluationResult<void>> {
      const entries = await readAllEntries(ledgerFile);
      for (let i = 1; i < entries.length; i++) {
        const current = entries[i]!;
        const previous = entries[i - 1]!;
        if (current.previousDigest !== previous.entryDigest) {
          return violations([
            violation(
              "ledger_chain_broken",
              `entry[${i}].previousDigest`,
              `Chain broken at index ${i}: expected ${previous.entryDigest}, got ${current.previousDigest ?? "(none)"}`,
            ),
          ]);
        }
      }
      return ok(undefined);
    },
  };
}
