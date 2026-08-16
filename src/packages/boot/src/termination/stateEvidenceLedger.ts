import type { LlmMessage } from "../types.js";
import type {
  AgentState,
  ArtifactSet,
  EnvironmentState,
  Evidence,
  EvidenceSet,
  EvidenceTier,
  ExecutionTrace,
  PendingReply,
} from "./types.js";

/**
 * StateEvidenceLedger — collects the complete agent state `x_t = (S, A, E, T, R)`
 * for evaluation. The object of evaluation is the full state, not the reply,
 * so a model cannot fake completion by paraphrasing the goal.
 *
 * This module is a pure projection: it never reads the LLM and never decides.
 * It only assembles state from sources the loop already trusts.
 */

/** A minimal world-snapshot projection the loop can hand in without coupling to core. */
export interface WorldSnapshot {
  readonly worldSummary: string;
  readonly headRef: string | undefined;
  readonly epochId: string | undefined;
  readonly participantCount: number;
  readonly artifactCount: number;
  readonly auditTailLength: number;
}

/** Trace counts the loop accumulates; passed in rather than re-derived here. */
export interface TraceCounts {
  readonly conversationTurns: number;
  readonly plainTextTurns: number;
  readonly toolCallTurns: number;
  readonly recentAssistantTexts: readonly string[];
  readonly committedOperations: number;
  readonly rejectedOperations: number;
}

/** Content refs written + artifact ids committed during this run. */
export interface RunProduce {
  readonly artifactIds: readonly string[];
  readonly contentRefs: readonly string[];
}

/** Evidence-tiered trust: highest priority first. */
const TIER_RHO: Readonly<Record<EvidenceTier, number>> = Object.freeze({
  environment: 1,
  tool: 0.9,
  artifact: 0.8,
  user: 0.5,
  agent_self: 0.3,
});

/** Tier of a conversation message, for evidence aggregation. */
function messageTier(message: LlmMessage): EvidenceTier | undefined {
  switch (message.role) {
    case "tool":
      return "tool";
    case "user":
      return "user";
    case "assistant":
      return "agent_self";
    default:
      return undefined;
  }
}

function refForMessage(message: LlmMessage): string | undefined {
  if (message.role === "tool") return message.toolCallId;
  return undefined;
}

/**
 * Collect the full agent state. `pendingReply` is the reply the agent is about to
 * send this turn; `messages` is the validated evidence transcript the loop owns.
 */
export function collectAgentState(input: {
  readonly world: WorldSnapshot;
  readonly traceCounts: TraceCounts;
  readonly produce: RunProduce;
  readonly messages: readonly LlmMessage[];
  readonly pendingReply: PendingReply;
}): AgentState {
  const environment: EnvironmentState = {
    worldSummary: input.world.worldSummary,
    headRef: input.world.headRef,
    epochId: input.world.epochId,
    participantCount: input.world.participantCount,
    artifactCount: input.world.artifactCount,
    auditTailLength: input.world.auditTailLength,
  };

  const artifacts: ArtifactSet = {
    artifactIds: input.produce.artifactIds,
    contentRefs: input.produce.contentRefs,
  };

  const evidenceItems: Evidence[] = [];
  for (const message of input.messages) {
    const tier = messageTier(message);
    if (tier === undefined) continue;
    const ref = refForMessage(message) ?? `msg:${evidenceItems.length}`;
    evidenceItems.push({
      ref,
      tier,
      rho: TIER_RHO[tier],
      summary: message.content.slice(0, 120),
    });
  }
  // Content refs are checkable artifacts — stronger than agent self-report.
  for (const ref of input.produce.contentRefs) {
    evidenceItems.push({
      ref,
      tier: "artifact",
      rho: TIER_RHO.artifact,
      summary: "written content",
    });
  }
  const evidence: EvidenceSet = { items: evidenceItems };

  const trace: ExecutionTrace = {
    conversationTurns: input.traceCounts.conversationTurns,
    plainTextTurns: input.traceCounts.plainTextTurns,
    toolCallTurns: input.traceCounts.toolCallTurns,
    recentAssistantTexts: input.traceCounts.recentAssistantTexts,
    committedOperations: input.traceCounts.committedOperations,
    rejectedOperations: input.traceCounts.rejectedOperations,
  };

  return { environment, artifacts, evidence, trace, pendingReply: input.pendingReply };
}

/** Aggregate evidence credibility `ρ` for a criterion evaluation fallback. */
export function maxCredibility(evidence: EvidenceSet): number {
  if (evidence.items.length === 0) return 0;
  return Math.max(...evidence.items.map((e) => e.rho));
}
