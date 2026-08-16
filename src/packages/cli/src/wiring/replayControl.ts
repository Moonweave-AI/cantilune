/**
 * Replay wiring for CLI `/replay*` — calls CoordinationRuntime.replay
 * (durable authority), not a changeLog-only render.
 */
import type { SnapshotRef } from "@cantilune/core";
import type { CoordinationRuntime, ReplayResult } from "@cantilune/runtime";

export interface CliReplayProjection {
  readonly fromRef: string;
  readonly toRef: string | undefined;
  readonly ok: boolean;
  readonly message: string;
  readonly steps: readonly {
    readonly step: string;
    readonly op: string;
    readonly bindings: string;
    readonly changeId: string;
  }[];
  readonly bundle: readonly { readonly artifact: string; readonly ref: string }[];
  readonly timeline: readonly {
    readonly timestamp: number;
    readonly label: string;
    readonly kind: string;
  }[];
}

export type ReplayControlResult =
  | { readonly ok: true; readonly projection: CliReplayProjection }
  | { readonly ok: false; readonly message: string };

export interface ReplayController {
  replay(options: {
    readonly fromRef?: string;
    readonly toRef?: string;
    readonly changeId?: string;
  }): ReplayControlResult;
}

function projectReplay(
  result: ReplayResult,
  fromRef: string,
  toRef: string | undefined,
  changeIdFilter: string | undefined,
): CliReplayProjection {
  if (!result.ok) {
    return {
      fromRef,
      toRef,
      ok: false,
      message: `${result.violation.code}: ${result.violation.message}`,
      steps: [],
      bundle: [
        { artifact: "fromRef", ref: fromRef },
        { artifact: "status", ref: "failed" },
      ],
      timeline: [],
    };
  }

  const steps = result.steps
    .filter((step) => changeIdFilter === undefined || String(step.changeId) === changeIdFilter)
    .map((step, index) => ({
      step: String(index + 1),
      op: String(step.changeId),
      bindings: `before=${String(step.beforeRef)} after=${String(step.afterRef)}`,
      changeId: String(step.changeId),
    }));

  return {
    fromRef,
    toRef: toRef ?? String(result.terminalRef),
    ok: true,
    message: `replay verified → ${String(result.terminalRef)} (${result.steps.length} steps)`,
    steps,
    bundle: [
      { artifact: "fromRef", ref: fromRef },
      { artifact: "terminalRef", ref: String(result.terminalRef) },
      { artifact: "steps", ref: String(result.steps.length) },
      { artifact: "epoch", ref: String(result.terminal.epochId) },
    ],
    timeline: result.steps.map((step, index) => ({
      timestamp: Date.now() + index,
      label: `Apply ${String(step.changeId)}`,
      kind: "replay",
    })),
  };
}

export function createReplayController(backends: {
  readonly coordinationRuntime: () => CoordinationRuntime | undefined;
}): ReplayController {
  return {
    replay(options) {
      const runtime = backends.coordinationRuntime();
      if (runtime === undefined) {
        return { ok: false, message: "no runtime connected" };
      }
      const head = runtime.getHead();
      if (head === undefined) {
        return { ok: false, message: "no snapshot on the runtime head" };
      }
      const allChanges = runtime.changes();
      const rawFrom = (options.fromRef ?? "").trim();
      const resolvedFrom =
        rawFrom.length === 0
          ? String(allChanges[0]?.beforeRef ?? head.snapshotRef)
          : rawFrom === "head" || rawFrom === "snap:head"
            ? String(head.snapshotRef)
            : rawFrom;

      const toRef =
        options.toRef === undefined || options.toRef.length === 0
          ? undefined
          : options.toRef === "head" || options.toRef === "snap:head"
            ? String(head.snapshotRef)
            : options.toRef;

      try {
        const result = runtime.replay({
          fromRef: resolvedFrom as SnapshotRef,
          ...(toRef !== undefined ? { toRef: toRef as SnapshotRef } : {}),
        });
        return {
          ok: true,
          projection: projectReplay(result, resolvedFrom, toRef, options.changeId),
        };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

export function readReplayProjection(
  viewArgs: Record<string, unknown>,
): CliReplayProjection | undefined {
  const raw = viewArgs["replayProjection"];
  if (raw === undefined || typeof raw !== "object" || raw === null) {
    return undefined;
  }
  return raw as CliReplayProjection;
}

export function readReplayError(viewArgs: Record<string, unknown>): string | undefined {
  const err = viewArgs["replayError"];
  return typeof err === "string" && err.length > 0 ? err : undefined;
}
