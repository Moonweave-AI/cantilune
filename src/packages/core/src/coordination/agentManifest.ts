/**
 * Agent manifest — describes an autonomous agent's configuration.
 *
 * Stored in the Content Store (content-addressed); a participant holds
 * a `manifestRef: ContentRef` linking to its serialized manifest.
 */
import type { ActorId } from "../primitives/ids.js";
import type { ContentRef } from "../primitives/refs.js";
import type { ActorKind } from "../nodes/participant.js";
import type { StartConditionExpression } from "./startCondition.js";

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
  /** Required: Agent must emit heartbeat at this interval (ms) to prove liveness. */
  readonly heartbeatIntervalMs: number;
  /** ActorId of the agent that designed/registered this agent. */
  readonly designedBy: ActorId;
}

/** Branded reference to a manifest stored in content-addressed storage. */
export type ManifestRef = ContentRef;

/** Serialize an AgentManifest to a JSON string (for content store put). */
export function serializeManifest(manifest: AgentManifest): string {
  return JSON.stringify(manifest);
}

/** Deserialize a JSON string back to AgentManifest. */
export function deserializeManifest(json: string): AgentManifest {
  return JSON.parse(json) as AgentManifest;
}
