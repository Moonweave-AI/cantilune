/**
 * Cluster-aware perceive extension — adds cluster status, inbox messages,
 * and heartbeat info to the standard perception result.
 */
import type {
  SyscallRuntime,
  SyscallPrincipal,
  PerceptionResult,
  OperationSchemaProvider,
} from "./syscall.js";
import { perceive as basePerceive } from "./perceive.js";

/** Extended perception result with cluster awareness. */
export interface ClusterPerceptionResult extends PerceptionResult {
  readonly clusterStatus: string;
  readonly inboxSummary: string;
  readonly ownHeartbeatSeq: number;
}

export interface ClusterPerceiveContext {
  readonly inboxMessages?: readonly InboxMessageSummary[];
  readonly heartbeatSeq?: number;
}

export interface InboxMessageSummary {
  readonly from: string;
  readonly content: string;
  readonly receivedAt: string;
}

/**
 * Enhanced perceive that includes cluster-level information.
 * Falls back to base perceive with cluster sections appended.
 */
export async function clusterPerceive(
  runtime: SyscallRuntime,
  principal: SyscallPrincipal,
  schemaProvider: OperationSchemaProvider,
  clusterCtx?: ClusterPerceiveContext,
): Promise<ClusterPerceptionResult> {
  const base = await basePerceive(runtime, principal, schemaProvider);

  const clusterStatus = renderClusterStatus(runtime, principal);
  const inboxSummary = renderInbox(clusterCtx?.inboxMessages ?? []);
  const ownHeartbeatSeq = clusterCtx?.heartbeatSeq ?? 0;

  const enhancedWorldSummary = [
    base.worldSummary,
    "",
    "=== Cluster Status ===",
    clusterStatus,
    "",
    "=== Inbox Messages ===",
    inboxSummary,
    "",
    `[Heartbeat] own_seq=${ownHeartbeatSeq}`,
  ].join("\n");

  return {
    worldSummary: enhancedWorldSummary,
    recentObservations: base.recentObservations,
    availableOperations: base.availableOperations,
    headRef: base.headRef,
    clusterStatus,
    inboxSummary,
    ownHeartbeatSeq,
  };
}

function renderClusterStatus(runtime: SyscallRuntime, principal: SyscallPrincipal): string {
  const snapshot = runtime.getHead();
  if (snapshot === undefined) return "No cluster state available.";

  const participants = snapshot.participants as ReadonlyMap<
    string,
    { status: string; kind: string }
  >;
  if (participants.size <= 1) return "Single-agent mode (no cluster peers).";

  const lines: string[] = [`Cluster: ${participants.size} participants`];
  for (const [id, p] of participants) {
    const isSelf = id === principal.actorId;
    const marker = isSelf ? " (YOU)" : "";
    lines.push(`  - ${id} [${p.kind}] status=${p.status}${marker}`);
  }
  return lines.join("\n");
}

function renderInbox(messages: readonly InboxMessageSummary[]): string {
  if (messages.length === 0) return "No unread messages.";
  const lines = messages.map(
    (msg) =>
      `[From: ${msg.from}] ${msg.content.slice(0, 200)}${msg.content.length > 200 ? "..." : ""} (at ${msg.receivedAt})`,
  );
  return lines.join("\n");
}
