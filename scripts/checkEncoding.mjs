/**
 * Guards against mojibake creeping into the tree.
 *
 * Editors and shells on Windows can round-trip a file through a non-UTF-8
 * codepage, which silently mangles characters such as the em dash into an
 * invalid byte sequence. A broken package.json is then unreadable by Node and
 * the failure surfaces far from its cause, so this runs as part of the static
 * gate instead.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src", "scripts", "docs", "diagrams"];
const SKIP_DIRS = new Set(["node_modules", "dist", "dist-tests", "coverage", ".git", ".lake"]);
const CHECKED = /\.(ts|tsx|js|mjs|cjs|json|md)$/;
const REPLACEMENT_CHAR = "\uFFFD";

const decoder = new TextDecoder("utf-8", { fatal: true });
const failures = [];

function inspect(file) {
  const bytes = readFileSync(file);
  let text;
  try {
    text = decoder.decode(bytes);
  } catch {
    failures.push(`${file}: not valid UTF-8`);
    return;
  }
  if (text.includes(REPLACEMENT_CHAR)) {
    failures.push(`${file}: contains U+FFFD replacement character`);
  }
}

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(path);
    } else if (CHECKED.test(entry.name)) {
      inspect(path);
    }
  }
}

for (const root of ROOTS) {
  try {
    walk(root);
  } catch {
    // An absent optional root is not an error.
  }
}

if (failures.length > 0) {
  console.error(`Encoding check failed for ${failures.length} file(s):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log("Encoding check passed: all scanned files are clean UTF-8.");
