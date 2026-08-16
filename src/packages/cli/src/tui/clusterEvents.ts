/**
 * Cluster → timeline/lifecycle translation.
 *
 * The cluster supervisor (`@cantilune/boot`'s `ClusterSupervisor`) emits a
 * separate `ClusterEvent` stream that the CLI does not yet start in
 * production (cluster startup is not wired into the TUI). This module is the
 * forward-looking translation layer: when cluster startup lands, the same
 * `onClusterEvent` callback can feed these translated entries into the
 * existing `eventLog` ring buffer and the per-turn lifecycle rail, so
 * multi-agent activity is presented by default with the same colour
 * language as coordination tool calls — the cluster accent (`accentAlt`)
 * for delegate/transfer/start/restart, `success` for completion, `info`
 * for heartbeats, `warning` for staleness, `danger` for retirement.
 *
 * Keeping this pure and free of React/store dependencies means it is unit
 * testable without a live cluster: each `ClusterEvent` maps to a timeline
 * label, a lifecycle stage, and a colour token name.
 */
import type { ClusterEvent } from "@cantilune/boot";
import type { LifecycleLine } from "../store.js";

/** Colour token a translated cluster line wants. */
export type ClusterColorToken = "accentAlt" | "success" | "info" | "warning" | "danger" | "muted";

export interface TranslatedClusterEvent {
  /** Label for the timeline entry. */
  readonly label: string;
  /** Colour token for both timeline and lifecycle rendering. */
  readonly color: ClusterColorToken;
  /** Lifecycle stage; cluster events surface as diagnostics on the rail. */
  readonly stage: LifecycleLine["stage"];
  /** Optional detail (e.g. staleness duration). */
  readonly detail?: string;
  /** A short glyph for the timeline (kept here so /events stays in sync). */
  readonly glyph: string;
}

/**
 * Translate a `ClusterEvent` into a presentable entry. Returns `undefined`
 * for events that carry no user-facing signal (`cluster_complete` is
 * represented by the turn close that already follows it).
 */
export function translateClusterEvent(event: ClusterEvent): TranslatedClusterEvent | undefined {
  switch (event.kind) {
    case "agent_started":
      return {
        label: `Agent ${event.actorId} started`,
        color: "accentAlt",
        stage: "diagnostic",
        glyph: "✦",
      };
    case "agent_done":
      return {
        label: `Agent ${event.actorId} done`,
        color: "success",
        stage: "diagnostic",
        glyph: "✓",
        ...(event.summary.length > 0 ? { detail: event.summary } : {}),
      };
    case "agent_stale":
      return {
        label: `Agent ${event.actorId} went stale`,
        color: "warning",
        stage: "diagnostic",
        glyph: "⚠",
        detail: `last heartbeat ${event.lastHeartbeatMs}ms ago`,
      };
    case "agent_retired":
      return {
        label: `Agent ${event.actorId} retired`,
        color: "danger",
        stage: "diagnostic",
        glyph: "✗",
      };
    case "condition_met":
      return {
        label: `Agent ${event.actorId} met a completion condition`,
        color: "accentAlt",
        stage: "diagnostic",
        glyph: "⊕",
      };
    case "heartbeat_received":
      return {
        label: `Heartbeat #${event.seq} from ${event.actorId}`,
        color: "info",
        stage: "diagnostic",
        glyph: "♥",
      };
    case "agent_queued":
      return {
        label: `Agent ${event.actorId} queued`,
        color: "muted",
        stage: "diagnostic",
        glyph: "⋯",
        detail: `priority ${event.priority}, waiting on its start condition`,
      };
    case "manifest_unresolved":
      return {
        label: `Agent ${event.actorId} has an unresolvable manifest`,
        color: "danger",
        stage: "diagnostic",
        glyph: "✗",
        detail: event.detail,
      };
    case "swarm_stalled":
      return {
        label: "Swarm stalled",
        color: "danger",
        stage: "diagnostic",
        glyph: "⊘",
        detail: event.detail,
      };
    case "budget_exhausted":
      return {
        label: `Swarm ${event.limit} budget exhausted`,
        color: "warning",
        stage: "diagnostic",
        glyph: "⌛",
        detail: event.detail,
      };
    case "cluster_complete":
      // The cluster completion is surfaced by the owning turn's close; no
      // dedicated lifecycle line is needed, so this returns nothing.
      return undefined;
    default: {
      // Exhaustiveness guard; unreachable at runtime.
      const _exhaustive: never = event;
      return undefined;
    }
  }
}
