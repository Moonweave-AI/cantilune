#!/usr/bin/env node
/**
 * Fetch the pinned, keyless CloakBrowser binary used by the read-only
 * `web_search` provider. The wrapper verifies the signed manifest before
 * extraction; this script does not configure login, a profile, or a proxy.
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mergeHostEnv } from "./hostEnv.mjs";

export const CLOAKBROWSER_VERSION = "146.0.7680.177.5";

const here = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = resolve(here, "../..");

export function cloakBrowserEnvironment(repoRoot = defaultRepoRoot, env = process.env) {
  return {
    CLOAKBROWSER_CACHE_DIR:
      env.CLOAKBROWSER_CACHE_DIR ?? resolve(repoRoot, ".cantilune", "cloakbrowser"),
    CLOAKBROWSER_VERSION: env.CLOAKBROWSER_VERSION ?? CLOAKBROWSER_VERSION,
    CLOAKBROWSER_AUTO_UPDATE: env.CLOAKBROWSER_AUTO_UPDATE ?? "false",
    CLOAKBROWSER_WIDEVINE: env.CLOAKBROWSER_WIDEVINE ?? "0",
  };
}

export async function prefetchCloakBrowser(options = {}) {
  const repoRoot = options.repoRoot ?? defaultRepoRoot;
  const env = options.env ?? process.env;
  const configured = cloakBrowserEnvironment(repoRoot, env);
  Object.assign(process.env, configured);

  const entry = resolve(repoRoot, "src/packages/tools/node_modules/cloakbrowser/dist/index.js");
  if (!existsSync(entry)) {
    throw new Error("CloakBrowser package is missing. Run pnpm install before provisioning web search.");
  }
  const { ensureBinary } = await import(pathToFileURL(entry).href);
  const binary = await ensureBinary(undefined, configured.CLOAKBROWSER_VERSION);
  if (!existsSync(binary)) {
    throw new Error(`CloakBrowser binary was not installed: ${binary}`);
  }
  mergeHostEnv(repoRoot, configured);
  process.stdout.write(`CLOAKBROWSER_BINARY=${binary}\n`);
  return { binary, ...configured };
}

function invokedAsCli() {
  const entry = process.argv[1];
  return entry !== undefined && fileURLToPath(import.meta.url).toLowerCase() === resolve(entry).toLowerCase();
}

if (invokedAsCli()) {
  await prefetchCloakBrowser();
}
