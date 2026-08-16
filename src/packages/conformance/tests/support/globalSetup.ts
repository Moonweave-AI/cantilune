import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Assert the built package the CLI and cross-process suites import from.
 *
 * This used to run `pnpm build` here. Under `pnpm test` that spawned a nested
 * build that raced the workspace build already in flight and deleted `dist/`
 * out from under sibling suites reading it. The `pretest`/`pretest:coverage`
 * hooks now own the build; this only checks the precondition, so a missing
 * dist fails with an actionable message rather than a cascade of import errors.
 */
export default function globalSetup(): void {
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const distEntry = path.join(packageRoot, "dist", "index.js");
  if (!existsSync(distEntry)) {
    throw new Error(
      `@cantilune/conformance tests require a built package: ${distEntry} is missing. ` +
        `Run \`pnpm --filter @cantilune/conformance... build\` first.`,
    );
  }
}
