#!/usr/bin/env node
/**
 * Install the official etcd binary (ADR-0029).
 * Release: https://github.com/etcd-io/etcd/releases/tag/v3.5.21
 */
import { createWriteStream, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

export const OFFICIAL_ETCD_VERSION = "v3.5.21";

const here = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = resolve(here, "../..");
const require = createRequire(import.meta.url);

export function etcdAssetName(platform = process.platform, arch = process.arch) {
  if (platform === "win32") {
    return `etcd-${OFFICIAL_ETCD_VERSION}-windows-amd64.zip`;
  }
  if (platform === "darwin") {
    return `etcd-${OFFICIAL_ETCD_VERSION}-darwin-${arch === "arm64" ? "arm64" : "amd64"}.zip`;
  }
  return `etcd-${OFFICIAL_ETCD_VERSION}-linux-${arch === "arm64" ? "arm64" : "amd64"}.tar.gz`;
}

export function etcdBinaryName(platform = process.platform) {
  return platform === "win32" ? "etcd.exe" : "etcd";
}

export function etcdInstallDir(repoRoot = defaultRepoRoot) {
  return resolve(repoRoot, ".cantilune/bin");
}

function extract(archive, outDir) {
  if (archive.endsWith(".zip")) {
    if (process.platform === "win32") {
      const expanded = spawnSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `Expand-Archive -Force -Path "${archive}" -DestinationPath "${outDir}"`,
        ],
        { encoding: "utf8", windowsHide: true },
      );
      if (expanded.status !== 0) {
        throw new Error(expanded.stderr || expanded.stdout || "Expand-Archive failed");
      }
      return;
    }
    const unzip = spawnSync("unzip", ["-o", archive, "-d", outDir], { encoding: "utf8" });
    if (unzip.status !== 0) {
      throw new Error(unzip.stderr || unzip.stdout || "unzip failed");
    }
    return;
  }
  const tar = spawnSync("tar", ["-xzf", archive, "-C", outDir], { encoding: "utf8" });
  if (tar.status !== 0) {
    throw new Error(tar.stderr || tar.stdout || "tar failed");
  }
}

function findExtractedBinary(root, name, archive) {
  const { readdirSync, statSync, copyFileSync, chmodSync } = require("node:fs");
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = resolve(dir, entry);
      if (statSync(full).isDirectory()) {
        const found = walk(full);
        if (found !== undefined) {
          return found;
        }
        continue;
      }
      if (entry === name) {
        return full;
      }
    }
    return undefined;
  };
  const found = walk(root);
  if (found === undefined) {
    throw new Error(`official etcd binary ${name} missing from ${archive}`);
  }
  return { found, copyFileSync, chmodSync };
}

export async function installOfficialEtcd(repoRoot = defaultRepoRoot) {
  const destDir = etcdInstallDir(repoRoot);
  const name = etcdBinaryName();
  const archive = etcdAssetName();
  const dest = resolve(destDir, name);
  mkdirSync(destDir, { recursive: true });
  if (existsSync(dest)) {
    process.stdout.write(`${dest} already present (${OFFICIAL_ETCD_VERSION})\n`);
    return dest;
  }
  const url = `https://github.com/etcd-io/etcd/releases/download/${OFFICIAL_ETCD_VERSION}/${archive}`;
  const tmp = resolve(destDir, `tmp-${archive}`);
  const extractDir = resolve(destDir, `tmp-etcd-${OFFICIAL_ETCD_VERSION}`);
  mkdirSync(extractDir, { recursive: true });
  process.stdout.write(`Downloading official etcd ${OFFICIAL_ETCD_VERSION} from ${url}\n`);
  const response = await fetch(url);
  if (!response.ok || response.body === null) {
    throw new Error(`download failed: ${String(response.status)} ${url}`);
  }
  await pipeline(response.body, createWriteStream(tmp));
  extract(tmp, extractDir);
  const { found, copyFileSync, chmodSync } = findExtractedBinary(extractDir, name, archive);
  copyFileSync(found, dest);
  if (process.platform !== "win32") {
    chmodSync(dest, 0o755);
  }
  rmSync(tmp, { force: true });
  rmSync(extractDir, { recursive: true, force: true });
  process.stdout.write(`Installed ${dest}\n`);
  return dest;
}

function invokedAsCli() {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  return fileURLToPath(import.meta.url).toLowerCase() === resolve(entry).toLowerCase();
}

if (invokedAsCli()) {
  const installed = await installOfficialEtcd();
  process.stdout.write(`CANTILUNE_ETCD_BIN=${installed}\n`);
}
