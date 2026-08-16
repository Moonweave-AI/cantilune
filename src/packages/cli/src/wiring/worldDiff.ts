/**
 * World-diff helper — loads two CollaborationSnapshots by ref (fail-closed).
 */
import type { CollaborationSnapshot } from "@cantilune/core";
import { snapshotToData } from "../runtimeSync.js";
import type { SnapshotData } from "../store.js";

export type WorldDiffResult =
  | {
      readonly ok: true;
      readonly refA: string;
      readonly refB: string;
      readonly left: string;
      readonly right: string;
    }
  | { readonly ok: false; readonly message: string };

function summarizeSnapshot(data: SnapshotData): string {
  const participants = data.participants.map((p) => p.id).join(", ") || "(none)";
  const artifacts =
    data.artifacts.map((a) => `${a.id} (${a.lifecycle})`).join(", ") || "(none)";
  const capabilities =
    data.capabilities.map((c) => `${c.kind} → ${c.holder}`).join(", ") || "(none)";
  const sessions =
    data.sessions.map((s) => `${s.id} (${s.status})`).join(", ") || "(none)";
  const links = data.links.map((l) => `${l.from}→${l.to}:${l.kind}`).join(", ") || "(none)";
  return [
    `snapshot=${data.snapshotRef}`,
    `epoch=${data.epochId}`,
    `participants: ${participants}`,
    `artifacts: ${artifacts}`,
    `sessions: ${sessions}`,
    `capabilities: ${capabilities}`,
    `links: ${links}`,
  ].join("\n");
}

export function diffSnapshotsByRef(backends: {
  readonly getSnapshot: (ref: string) => CollaborationSnapshot | undefined;
  readonly headRef?: () => string | undefined;
}, args: {
  readonly refA?: string;
  readonly refB?: string;
}): WorldDiffResult {
  const head = backends.headRef?.();
  const refA = (args.refA ?? head ?? "").trim();
  const refB = (args.refB ?? head ?? "").trim();
  if (refA.length === 0 || refB.length === 0) {
    return {
      ok: false,
      message: "world diff requires refA and refB (or a connected runtime head)",
    };
  }
  const snapA = backends.getSnapshot(refA === "head" || refA === "snap:head" ? (head ?? refA) : refA);
  const snapB = backends.getSnapshot(refB === "head" || refB === "snap:head" ? (head ?? refB) : refB);
  if (snapA === undefined) {
    return { ok: false, message: `snapshot not found: ${refA}` };
  }
  if (snapB === undefined) {
    return { ok: false, message: `snapshot not found: ${refB}` };
  }
  return {
    ok: true,
    refA: String(snapA.snapshotRef),
    refB: String(snapB.snapshotRef),
    left: summarizeSnapshot(snapshotToData(snapA)),
    right: summarizeSnapshot(snapshotToData(snapB)),
  };
}
