/**
 * Bind evaluation replay to a runtime-public `replay()` surface (structural).
 * Does not import `@cantilune/runtime` so the peer stays optional.
 */
import { createHash } from "node:crypto";
import { contentDigest } from "@cantilune/core";
import type { ReplayPort } from "./cantiluneReplayAdapter.js";

export interface PublicRuntimeReplay {
  replay(options: {
    readonly fromRef: string;
    readonly changes?: readonly unknown[];
  }):
    | { readonly ok: true; readonly terminalRef: string; readonly steps: readonly unknown[] }
    | { readonly ok: false; readonly violation: { readonly message: string } };
}

export function createRuntimePublicReplayPort(runtime: PublicRuntimeReplay): ReplayPort {
  return {
    async replayFromSnapshot(snapshotRef, events) {
      const result = runtime.replay({
        fromRef: snapshotRef,
        ...(events.length > 0 ? { changes: events } : {}),
      });
      if (!result.ok) {
        throw new Error(result.violation.message);
      }
      return {
        terminalSnapshotRef: result.terminalRef,
        stepCount: result.steps.length,
        resultDigest: contentDigest(
          createHash("sha256")
            .update(`${result.terminalRef}|${result.steps.length}`)
            .digest("hex"),
        ),
      };
    },
  };
}
