import type { ActorRef, ContentRef, CoordinationChange, CoordinationIntent, SnapshotRef } from "@cantilune/core";
import { describeRejectReason } from "@cantilune/runtime";
import type { AdmissionRejectReason, CoordinationRuntime } from "@cantilune/runtime";
import type { SyscallRuntime, ObserveResult, ProposeResult } from "@cantilune/syscall";

/**
 * Wraps a real CoordinationRuntime into the SyscallRuntime interface.
 *
 * SyscallRuntime is a simplified, structurally typed interface
 * (ok/message pattern) consumed by the syscall translation layer.
 * This adapter delegates every call to the genuine runtime — no simulation.
 */
export function wrapCoordinationRuntime(rt: CoordinationRuntime): SyscallRuntime {
  return {
    getHead() {
      return rt.getHead();
    },

    observe(
      input: { source: unknown; payloadRef: unknown },
      options?: { principal?: unknown },
    ): ObserveResult {
      const result = rt.observe(
        input as { source: ActorRef; payloadRef: ContentRef },
        options as { principal?: ActorRef } | undefined,
      );
      if ("code" in result) {
        return { ok: false, message: result.message };
      }
      return { ok: true };
    },

    changes(since?: SnapshotRef): readonly CoordinationChange[] {
      return rt.changes(since);
    },

    proposeAndCommit(intent: unknown, options?: unknown): ProposeResult {
      const result = rt.proposeAndCommit(
        intent as CoordinationIntent,
        options as { beforeRef?: SnapshotRef; principal?: ActorRef } | undefined,
      );
      if ("code" in result) {
        return { ok: false, message: result.message };
      }
      if ("ok" in result && !result.ok) {
        // Rendered rather than reduced to `reason.kind`: the agent reads this
        // string and is expected to correct itself from it.
        const reason = (result as { ok: false; reason: AdmissionRejectReason }).reason;
        return { ok: false, message: describeRejectReason(reason) };
      }
      if (!("after" in result)) {
        return { ok: false, message: "runtime returned an uncommitted admission result" };
      }
      if (typeof result.after.snapshotRef !== "string" || result.after.snapshotRef === "") {
        return { ok: false, message: "runtime returned an invalid commit receipt" };
      }
      return { ok: true, newHeadRef: result.after.snapshotRef };
    },
  };
}
