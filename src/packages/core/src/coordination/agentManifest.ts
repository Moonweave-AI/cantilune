/**
 * Agent manifest — describes an autonomous agent's configuration.
 *
 * Stored in the Content Store (content-addressed); a participant holds
 * a `manifestRef: ContentRef` linking to its serialized manifest.
 */
import type { ActorId } from "../primitives/ids.js";
import type { ContentRef } from "../primitives/refs.js";
import type { ActorKind } from "../nodes/participant.js";
import { normalizeStartCondition, type StartConditionExpression } from "./startCondition.js";

/** Hint for the OS about which coordination entities this agent will touch. */
export interface FootprintHint {
  readonly artifactIds?: readonly string[];
  readonly participantIds?: readonly string[];
  readonly sessionIds?: readonly string[];
}

export interface AgentManifest {
  readonly agentId: string;
  readonly kind: ActorKind;
  readonly systemPrompt: string;
  readonly assignedTask: string;
  readonly model?: string;
  readonly provider?: string;
  readonly startCondition: StartConditionExpression;
  readonly footprintHint?: FootprintHint;
  readonly maxTurns?: number;
  readonly maxTimeMs?: number;
  /**
   * Dispatch priority when more agents are eligible than the swarm's
   * concurrency ceiling allows. Higher runs first; equal priorities keep
   * admission order. Absent means {@link DEFAULT_AGENT_PRIORITY}, so a manifest
   * written before priorities existed schedules exactly as it did before.
   *
   * Priority orders a queue; it never bypasses a start condition, a footprint
   * conflict, or any admission rule.
   */
  readonly priority?: number;
  /** Required: Agent must emit heartbeat at this interval (ms) to prove liveness. */
  readonly heartbeatIntervalMs: number;
  /** ActorId of the agent that designed/registered this agent. */
  readonly designedBy: ActorId;
}

/** Priority assumed for a manifest that declares none. */
export const DEFAULT_AGENT_PRIORITY = 0;

/** Read a manifest's dispatch priority, defaulting when it declares none. */
export function manifestPriority(manifest: AgentManifest): number {
  const declared = manifest.priority;
  return declared === undefined || !Number.isFinite(declared) ? DEFAULT_AGENT_PRIORITY : declared;
}

/** Branded reference to a manifest stored in content-addressed storage. */
export type ManifestRef = ContentRef;

/** Serialize an AgentManifest to a JSON string (for content store put). */
export function serializeManifest(manifest: AgentManifest): string {
  return JSON.stringify(manifest);
}

/** Deserialize a JSON string back to AgentManifest. */
export function deserializeManifest(json: string): AgentManifest {
  const parsed = JSON.parse(json) as AgentManifest;
  return {
    ...parsed,
    startCondition: normalizeStartCondition(parsed.startCondition),
  };
}
