#!/usr/bin/env node
/**
 * Lightweight mutation gate — injects single-point mutants and requires tests to fail.
 * Engineering substitute for full Stryker on Windows/pnpm monorepos.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const cases = [
  {
    file: "src/engine/sealedAdmissionGate.ts",
    needle: "if (decision.evidenceRootDigest !== bundleDigest)",
    mutant: "if (false && decision.evidenceRootDigest !== bundleDigest)",
    test: "tests/unit/sealedAdmissionGate.test.ts",
  },
  {
    file: "src/verifier/inventoryVerifier.ts",
    needle: "if (!observed.has(ruleId))",
    mutant: "if (false && !observed.has(ruleId))",
    test: "tests/unit/inventoryVerifier.test.ts",
  },
  {
    file: "src/verifier/engineeringAdmissionVerifier.ts",
    needle: "if (!admissionSubjectsMatch(bundleSubject, input.subject))",
    mutant: "if (false && !admissionSubjectsMatch(bundleSubject, input.subject))",
    test: "tests/unit/engineeringAdmissionEvidence.test.ts",
  },
  {
    file: "src/verifier/envelopeVerifier.ts",
    needle: "if (!isSha256HexDigest(envelope.subjectDigest))",
    mutant: "if (false && !isSha256HexDigest(envelope.subjectDigest))",
    test: "tests/contract/tamper-corpus.test.ts",
  },
];

for (const entry of cases) {
  const path = resolve(root, entry.file);
  const original = readFileSync(path, "utf8");
  if (!original.includes(entry.needle)) {
    console.error(`mutation gate: needle not found in ${entry.file}`);
    process.exit(1);
  }
  writeFileSync(path, original.replace(entry.needle, entry.mutant));
  try {
    execSync(`pnpm exec vitest run ${entry.test}`, { cwd: root, stdio: "pipe" });
    console.error(`mutation gate: mutant survived in ${entry.file}`);
    process.exit(1);
  } catch {
    console.log(`mutation gate: killed ${entry.file}`);
  } finally {
    writeFileSync(path, original);
  }
}

console.log("Mutation gate passed");
