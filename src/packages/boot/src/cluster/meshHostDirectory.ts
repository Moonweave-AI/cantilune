/**
 * Multi-host mesh directory (ADR-0019 S4): actorId → listen address + fingerprint.
 * Production is deny-by-default: entries without fingerprints are unpublished.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ActorId } from "@cantilune/core";

export type MeshHostRole = "supervisor" | "worker";

export interface MeshHostEntry {
  readonly actorId: ActorId;
  readonly host: string;
  readonly port: number;
  /** Certificate fingerprint (sha256 hex). Required to publish. */
  readonly fingerprint: string;
  readonly role: MeshHostRole;
  readonly admissionReceiptRef?: string;
}

export interface MeshHostDirectory {
  list(): readonly MeshHostEntry[];
  get(actorId: ActorId): MeshHostEntry | undefined;
  /** Publish fails closed when fingerprint is empty. */
  publish(entry: MeshHostEntry): void;
  remove(actorId: ActorId): void;
}

export function createMemoryMeshHostDirectory(
  initial: readonly MeshHostEntry[] = [],
): MeshHostDirectory {
  const entries = new Map<string, MeshHostEntry>();
  for (const entry of initial) {
    if (entry.fingerprint.length === 0) {
      throw new Error("MeshHostEntry.fingerprint is required");
    }
    entries.set(entry.actorId as string, entry);
  }
  return {
    list: () => [...entries.values()],
    get: (actorId) => entries.get(actorId as string),
    publish(entry) {
      if (entry.fingerprint.length === 0) {
        throw new Error("MeshHostEntry.fingerprint is required");
      }
      entries.set(entry.actorId as string, entry);
    },
    remove(actorId) {
      entries.delete(actorId as string);
    },
  };
}

export function loadMeshHostDirectory(path: string): MeshHostDirectory {
  const absolute = resolve(path);
  const dir = createMemoryMeshHostDirectory();
  if (!existsSync(absolute)) {
    return dir;
  }
  const raw = JSON.parse(readFileSync(absolute, "utf8")) as { hosts?: MeshHostEntry[] };
  for (const entry of raw.hosts ?? []) {
    dir.publish(entry);
  }
  return dir;
}

export function saveMeshHostDirectory(path: string, directory: MeshHostDirectory): void {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(
    absolute,
    JSON.stringify({ hosts: directory.list() }, null, 2),
    "utf8",
  );
}
